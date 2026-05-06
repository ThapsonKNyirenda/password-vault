from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_agent
from app.db.session import get_db
from app.domain.models import Agent, Credential, SyncSource, TargetServer
from app.core.config import get_settings
from app.domain.schemas import (
    AgentAccountSyncRequest,
    AgentCredentialAssignment,
    AgentCredentialSyncRequest,
    AgentCredentialSyncResponse,
    AgentRevealCredentialResponse,
)
from app.services.audit_service import record_audit
from app.services.encryption_service import EnvelopeCipher
from app.services.tracking_service import sync_credential_password


settings = get_settings()
cipher = EnvelopeCipher(settings.vault_master_key)


router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/credentials", response_model=list[AgentCredentialAssignment])
def list_assigned_credentials(
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
) -> list[AgentCredentialAssignment]:
    rows = db.execute(
        select(
            Credential.id,
            TargetServer.id,
            TargetServer.name,
            TargetServer.site,
            Credential.managed_account,
            Credential.version,
            Credential.last_synced_at,
            Credential.last_sync_source,
        )
        .join(TargetServer, TargetServer.id == Credential.server_id)
        .where(TargetServer.agent_id == agent.id)
        .order_by(TargetServer.site.asc(), TargetServer.name.asc())
    ).all()

    return [
        AgentCredentialAssignment(
            credential_id=row[0],
            server_id=row[1],
            server_name=row[2],
            site=row[3],
            managed_account=row[4],
            version=row[5],
            last_synced_at=row[6],
            last_sync_source=row[7],
        )
        for row in rows
    ]


@router.post("/credentials/{credential_id}/sync", response_model=AgentCredentialSyncResponse)
def sync_credential(
    credential_id: str,
    payload: AgentCredentialSyncRequest,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
) -> AgentCredentialSyncResponse:
    credential = db.scalar(
        select(Credential)
        .join(TargetServer, TargetServer.id == Credential.server_id)
        .where(
            Credential.id == credential_id,
            TargetServer.agent_id == agent.id,
        )
    )
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    changed = sync_credential_password(credential, plaintext=payload.password, source=SyncSource.AGENT)
    record_audit(
        db,
        actor_type="agent",
        actor_id=agent.id,
        action="sync_credential",
        resource_type="credential",
        resource_id=credential.id,
        details={"changed": changed, "version": credential.version},
    )
    db.commit()
    db.refresh(credential)

    return AgentCredentialSyncResponse(
        credential_id=credential.id,
        changed=changed,
        version=credential.version,
        last_synced_at=credential.last_synced_at,
        last_sync_source=credential.last_sync_source,
    )


@router.post("/credentials/sync-by-account", response_model=AgentCredentialSyncResponse)
def sync_credential_by_account(
    payload: AgentAccountSyncRequest,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
) -> AgentCredentialSyncResponse:
    # Find the credential based on agent_id, server_name, and managed_account
    credential = db.scalar(
        select(Credential)
        .join(TargetServer, TargetServer.id == Credential.server_id)
        .where(
            TargetServer.agent_id == agent.id,
            TargetServer.name == payload.server_name,
            Credential.managed_account == payload.managed_account,
        )
    )
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Credential for server '{payload.server_name}' and account '{payload.managed_account}' not found for this agent",
        )

    changed = sync_credential_password(credential, plaintext=payload.password, source=SyncSource.AGENT)
    record_audit(
        db,
        actor_type="agent",
        actor_id=agent.id,
        action="sync_credential",
        resource_type="credential",
        resource_id=credential.id,
        details={
            "changed": changed,
            "version": credential.version,
            "sync_method": "account_intercept",
        },
    )
    db.commit()
    db.refresh(credential)

    return AgentCredentialSyncResponse(
        credential_id=credential.id,
        changed=changed,
        version=credential.version,
        last_synced_at=credential.last_synced_at,
        last_sync_source=credential.last_sync_source,
    )


@router.get("/credentials/{credential_id}/reveal", response_model=AgentRevealCredentialResponse)
def reveal_credential(
    credential_id: str,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
) -> AgentRevealCredentialResponse:
    # Find the credential AND ensure it belongs to a server managed by THIS agent
    result = db.execute(
        select(Credential, TargetServer)
        .join(TargetServer, TargetServer.id == Credential.server_id)
        .where(
            Credential.id == credential_id,
            TargetServer.agent_id == agent.id,
        )
    ).first()

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found or not managed by this agent",
        )

    credential, server = result

    plaintext = cipher.decrypt_secret(
        ciphertext=credential.ciphertext,
        ciphertext_nonce=credential.ciphertext_nonce,
        encrypted_dek=credential.encrypted_dek,
        encrypted_dek_nonce=credential.encrypted_dek_nonce,
    )

    record_audit(
        db,
        actor_type="agent",
        actor_id=agent.id,
        action="agent_reveal_password",
        resource_type="credential",
        resource_id=credential.id,
        details={
            "server_name": server.name,
            "managed_account": credential.managed_account,
        },
    )
    db.commit()

    return AgentRevealCredentialResponse(
        credential_id=credential.id,
        server_host=server.host,
        server_port=server.port,
        managed_account=credential.managed_account,
        connection_username=server.connection_username,
        connection_profile=server.connection_profile,
        password=plaintext,
    )
