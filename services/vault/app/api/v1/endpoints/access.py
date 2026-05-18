from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import inspect, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.domain.models import Credential, SystemSetting, TargetServer, User, UserRole, utcnow
from app.domain.schemas import (
    CredentialCatalogItem,
    CredentialSshStatusResponse,
    DirectRevealRequest,
    RevealCredentialResponse,
    RevealPolicy,
)
from app.services.audit_service import record_audit
from app.services.ssh_status_service import check_ssh_credential, ssh_status_checked_at
from app.services.tracking_service import decrypt_credential


router = APIRouter(prefix="/access-requests", tags=["access"])

settings = get_settings()


def clamp_direct_reveal_minutes(minutes: int) -> int:
    if minutes < 1:
        return 1
    if minutes > 120:
        return 120
    return minutes


def get_direct_reveal_minutes(db: Session) -> int:
    minutes = settings.direct_reveal_minutes

    try:
        if inspect(db.get_bind()).has_table(SystemSetting.__tablename__):
            setting = db.get(SystemSetting, "direct_reveal_minutes")
            if setting and setting.value.strip().isdigit():
                minutes = int(setting.value)
    except SQLAlchemyError:
        db.rollback()

    return clamp_direct_reveal_minutes(minutes)


@router.get("/catalog", response_model=list[CredentialCatalogItem])
def credential_catalog(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> list[CredentialCatalogItem]:
    rows = db.execute(
        select(
            Credential.id,
            TargetServer.name,
            TargetServer.site,
            Credential.managed_account,
            TargetServer.os_type,
            Credential.version,
            Credential.last_synced_at,
            Credential.last_sync_source,
        )
        .join(TargetServer, TargetServer.id == Credential.server_id)
        .order_by(TargetServer.site.asc(), TargetServer.name.asc())
    ).all()

    return [
        CredentialCatalogItem(
            credential_id=row[0],
            server_name=row[1],
            site=row[2],
            managed_account=row[3],
            os_type=row[4],
            version=row[5],
            last_synced_at=row[6],
            last_sync_source=row[7],
        )
        for row in rows
    ]


@router.post("/direct-reveal", response_model=RevealCredentialResponse)
def direct_reveal_credential(
    payload: DirectRevealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> RevealCredentialResponse:
    credential = db.get(Credential, payload.credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    server = db.get(TargetServer, credential.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    plaintext = decrypt_credential(credential)
    now = utcnow()
    minutes = get_direct_reveal_minutes(db)
    expires_at = now + timedelta(minutes=minutes)

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="direct_reveal_credential",
        resource_type="credential",
        resource_id=credential.id,
        details={
            "credential_id": credential.id,
            "server_id": server.id,
            "expires_at": expires_at.isoformat(),
            "minutes": minutes,
        },
    )
    db.commit()

    return RevealCredentialResponse(
        credential_id=credential.id,
        server_name=server.name,
        managed_account=credential.managed_account,
        expires_at=expires_at,
        password=plaintext,
    )


@router.post("/credentials/{credential_id}/ssh-status", response_model=CredentialSshStatusResponse)
def check_credential_ssh_status(
    credential_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> CredentialSshStatusResponse:
    credential = db.get(Credential, credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    server = db.get(TargetServer, credential.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    result = check_ssh_credential(server=server, credential=credential)
    checked_at = ssh_status_checked_at()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="check_ssh_status",
        resource_type="credential",
        resource_id=credential.id,
        details={
            "server_id": server.id,
            "server_name": server.name,
            "managed_account": credential.managed_account,
            "ok": result.ok,
            "status": result.status,
        },
    )
    db.commit()

    return CredentialSshStatusResponse(
        credential_id=credential.id,
        server_name=server.name,
        host=server.host,
        port=server.port,
        managed_account=credential.managed_account,
        ok=result.ok,
        status=result.status,
        message=result.message,
        checked_at=checked_at,
    )


@router.get("/reveal-policy", response_model=RevealPolicy)
def get_reveal_policy(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> RevealPolicy:
    return RevealPolicy(minutes=get_direct_reveal_minutes(db))



