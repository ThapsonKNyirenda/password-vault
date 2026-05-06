import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.security import hash_delivery_token
from app.db.session import get_db
from app.domain.models import AccessRequest, AccessStatus, Credential, TargetServer, User, UserRole, ensure_utc, utcnow
from app.domain.schemas import (
    AccessDecisionRequest,
    AccessRequestCreate,
    AccessRequestOut,
    CredentialCatalogItem,
    DirectRevealRequest,
    RevealCredentialResponse,
)
from app.services.audit_service import record_audit
from app.services.tracking_service import decrypt_credential


router = APIRouter(prefix="/access-requests", tags=["access"])

DIRECT_REVEAL_MINUTES = 5


@router.get("/catalog", response_model=list[CredentialCatalogItem])
def credential_catalog(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER, UserRole.AUDITOR)),
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


@router.post("/", response_model=AccessRequestOut, status_code=status.HTTP_201_CREATED)
def create_access_request(
    payload: AccessRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> AccessRequest:
    credential = db.get(Credential, payload.credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    req = AccessRequest(
        requester_id=current_user.id,
        credential_id=payload.credential_id,
        status=AccessStatus.PENDING,
        reason=payload.reason,
    )
    db.add(req)
    db.flush()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="create_access_request",
        resource_type="access_request",
        resource_id=req.id,
        details={"credential_id": payload.credential_id},
    )
    db.commit()
    db.refresh(req)
    return req


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
    expires_at = now + timedelta(minutes=DIRECT_REVEAL_MINUTES)

    req = AccessRequest(
        requester_id=current_user.id,
        credential_id=credential.id,
        status=AccessStatus.FULFILLED,
        reason="direct_reveal",
        expires_at=expires_at,
        approved_by=current_user.id,
        approved_at=now,
        revealed_at=now,
    )
    db.add(req)
    db.flush()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="direct_reveal_credential",
        resource_type="access_request",
        resource_id=req.id,
        details={
            "credential_id": credential.id,
            "server_id": server.id,
            "expires_at": expires_at.isoformat(),
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


@router.get("/mine", response_model=list[AccessRequestOut])
def list_my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER, UserRole.AUDITOR)),
) -> list[AccessRequest]:
    if current_user.role == UserRole.ADMIN:
        return db.scalars(select(AccessRequest).order_by(AccessRequest.created_at.desc())).all()

    return db.scalars(
        select(AccessRequest)
        .where(AccessRequest.requester_id == current_user.id)
        .order_by(AccessRequest.created_at.desc())
    ).all()


@router.get("/pending", response_model=list[AccessRequestOut])
def list_pending_requests(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[AccessRequest]:
    return db.scalars(
        select(AccessRequest)
        .where(AccessRequest.status == AccessStatus.PENDING)
        .order_by(AccessRequest.created_at.asc())
    ).all()


@router.post("/{request_id}/approve", response_model=AccessRequestOut)
def approve_request(
    request_id: str,
    payload: AccessDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AccessRequest:
    req = db.get(AccessRequest, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")
    if req.status != AccessStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request is not pending")

    credential = db.get(Credential, req.credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    now = utcnow()
    req.status = AccessStatus.APPROVED
    req.approved_by = current_user.id
    req.approved_at = now
    req.expires_at = now + timedelta(minutes=payload.expires_minutes)
    req.delivery_token_hash = hash_delivery_token(secrets.token_urlsafe(24))

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="approve_access_request",
        resource_type="access_request",
        resource_id=req.id,
        details={"credential_id": req.credential_id, "expires_minutes": payload.expires_minutes},
    )
    db.commit()
    db.refresh(req)
    return req


@router.post("/{request_id}/deny", response_model=AccessRequestOut)
def deny_request(
    request_id: str,
    payload: AccessDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AccessRequest:
    req = db.get(AccessRequest, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")
    if req.status != AccessStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request is not pending")

    req.status = AccessStatus.DENIED
    req.approved_by = current_user.id
    req.approved_at = utcnow()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="deny_access_request",
        resource_type="access_request",
        resource_id=req.id,
        details={"note": payload.note or ""},
    )
    db.commit()
    db.refresh(req)
    return req


@router.post("/{request_id}/reveal", response_model=RevealCredentialResponse)
def reveal_credential(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.ENGINEER)),
) -> RevealCredentialResponse:
    req = db.get(AccessRequest, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")

    if current_user.role != UserRole.ADMIN and req.requester_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your access request")

    if req.status != AccessStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request is not approved")
    if req.revealed_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Credential already revealed")

    now = utcnow()
    expires_at = ensure_utc(req.expires_at)
    if expires_at is not None and expires_at < now:
        req.status = AccessStatus.EXPIRED
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Access request expired")

    credential = db.get(Credential, req.credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    server = db.get(TargetServer, credential.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    plaintext = decrypt_credential(credential)

    req.revealed_at = now
    req.status = AccessStatus.FULFILLED

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="reveal_credential",
        resource_type="access_request",
        resource_id=req.id,
        details={"credential_id": credential.id, "server_id": server.id},
    )
    db.commit()

    return RevealCredentialResponse(
        credential_id=credential.id,
        server_name=server.name,
        managed_account=credential.managed_account,
        expires_at=expires_at,
        password=plaintext,
    )
