from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.core.security import generate_agent_token, hash_agent_token, hash_password
from app.db.session import get_db
from app.domain.models import Agent, Credential, SyncSource, TargetServer, User, UserRole
from app.domain.schemas import (
    AgentCreateRequest,
    AgentCreateResponse,
    AgentOut,
    CredentialCreate,
    CredentialOut,
    CredentialPasswordUpdateRequest,
    RevealCredentialResponse,
    TargetServerCreate,
    TargetServerOut,
    UserCreate,
    UserOut,
)
from app.services.audit_service import record_audit
from app.services.encryption_service import EnvelopeCipher
from app.services.tracking_service import sync_credential_password


settings = get_settings()
cipher = EnvelopeCipher(settings.vault_master_key)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> User:
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        active=True,
    )
    db.add(user)
    db.flush()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="create_user",
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username, "role": user.role.value},
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/agents", response_model=AgentCreateResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AgentCreateResponse:
    existing = db.scalar(select(Agent).where(Agent.name == payload.name))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Agent name already exists")

    api_token = generate_agent_token()
    agent = Agent(
        name=payload.name,
        site=payload.site,
        token_hash=hash_agent_token(api_token),
        active=True,
    )
    db.add(agent)
    db.flush()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="create_agent",
        resource_type="agent",
        resource_id=agent.id,
        details={"name": payload.name, "site": payload.site},
    )
    db.commit()
    db.refresh(agent)
    return AgentCreateResponse(agent=AgentOut.model_validate(agent), api_token=api_token)


@router.get("/agents", response_model=list[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR)),
) -> list[Agent]:
    return db.scalars(select(Agent).order_by(Agent.created_at.desc())).all()


@router.post("/servers", response_model=TargetServerOut, status_code=status.HTTP_201_CREATED)
def create_server(
    payload: TargetServerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> TargetServer:
    existing = db.scalar(select(TargetServer).where(TargetServer.name == payload.name))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Server name already exists")

    agent = db.get(Agent, payload.agent_id)
    if agent is None or not agent.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent not found or inactive")

    server = TargetServer(
        name=payload.name,
        site=payload.site,
        agent_id=payload.agent_id,
        os_type=payload.os_type,
        host=payload.host,
        port=payload.port,
        managed_account=payload.managed_account,
        connection_username=payload.connection_username,
        connection_profile=payload.connection_profile,
    )
    db.add(server)
    db.flush()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="create_server",
        resource_type="server",
        resource_id=server.id,
        details={"name": server.name, "os_type": server.os_type.value, "site": server.site},
    )
    db.commit()
    db.refresh(server)
    return server


@router.get("/servers", response_model=list[TargetServerOut])
def list_servers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR)),
) -> list[TargetServer]:
    return db.scalars(select(TargetServer).order_by(TargetServer.created_at.desc())).all()


@router.post("/credentials", response_model=CredentialOut, status_code=status.HTTP_201_CREATED)
def create_credential(
    payload: CredentialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> Credential:
    server = db.get(TargetServer, payload.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    existing = db.scalar(
        select(Credential).where(
            Credential.server_id == payload.server_id,
            Credential.managed_account == payload.managed_account,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Credential already exists")

    encrypted = cipher.encrypt_secret(payload.initial_password)
    credential = Credential(
        server_id=payload.server_id,
        managed_account=payload.managed_account,
        ciphertext=encrypted.ciphertext,
        ciphertext_nonce=encrypted.ciphertext_nonce,
        encrypted_dek=encrypted.encrypted_dek,
        encrypted_dek_nonce=encrypted.encrypted_dek_nonce,
        version=1,
        last_sync_source=SyncSource.ADMIN,
    )
    db.add(credential)
    db.flush()

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="create_credential",
        resource_type="credential",
        resource_id=credential.id,
        details={"server_id": credential.server_id, "managed_account": credential.managed_account},
    )
    db.commit()
    db.refresh(credential)
    return credential


@router.get("/credentials", response_model=list[CredentialOut])
def list_credentials(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR)),
) -> list[Credential]:
    return db.scalars(select(Credential).order_by(Credential.created_at.desc())).all()


@router.put("/credentials/{credential_id}/password", response_model=CredentialOut)
def update_credential_password(
    credential_id: str,
    payload: CredentialPasswordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> Credential:
    credential = db.get(Credential, credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    changed = sync_credential_password(credential, plaintext=payload.password, source=SyncSource.ADMIN)
    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="update_credential_password",
        resource_type="credential",
        resource_id=credential.id,
        details={"changed": changed},
    )
    db.commit()
    db.refresh(credential)
    return credential


@router.get("/credentials/{credential_id}/reveal", response_model=RevealCredentialResponse)
def reveal_credential_password(
    credential_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> RevealCredentialResponse:
    credential = db.get(Credential, credential_id)
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    server = db.get(TargetServer, credential.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found for credential")

    plaintext = cipher.decrypt_secret(
        ciphertext=credential.ciphertext,
        ciphertext_nonce=credential.ciphertext_nonce,
        encrypted_dek=credential.encrypted_dek,
        encrypted_dek_nonce=credential.encrypted_dek_nonce,
    )

    record_audit(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        action="admin_reveal_password",
        resource_type="credential",
        resource_id=credential.id,
        details={
            "server_name": server.name,
            "managed_account": credential.managed_account,
        },
    )
    db.commit()

    return RevealCredentialResponse(
        credential_id=credential.id,
        server_name=server.name,
        managed_account=credential.managed_account,
        expires_at=None,
        password=plaintext,
    )
