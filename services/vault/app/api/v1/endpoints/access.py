from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.domain.models import Credential, SystemSetting, TargetServer, User, UserRole, utcnow
from app.domain.schemas import (
    CredentialCatalogItem,
    DirectRevealRequest,
    RevealCredentialResponse,
    RevealPolicy,
)
from app.services.audit_service import record_audit
from app.services.tracking_service import decrypt_credential


router = APIRouter(prefix="/access-requests", tags=["access"])

settings = get_settings()


def get_direct_reveal_minutes(db: Session) -> int:
    setting = db.get(SystemSetting, "direct_reveal_minutes")
    if setting and setting.value.strip().isdigit():
        minutes = int(setting.value)
    else:
        minutes = settings.direct_reveal_minutes

    if minutes < 1:
        return 1
    if minutes > 120:
        return 120
    return minutes


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


@router.get("/reveal-policy", response_model=RevealPolicy)
def get_reveal_policy(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> RevealPolicy:
    return RevealPolicy(minutes=get_direct_reveal_minutes(db))





