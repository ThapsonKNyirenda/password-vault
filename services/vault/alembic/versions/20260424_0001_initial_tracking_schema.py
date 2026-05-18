"""Initial password tracking schema.

Revision ID: 20260424_0001
Revises:
Create Date: 2026-04-24 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260424_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role_enum = sa.Enum("ADMIN", "ENGINEER", name="userrole")
server_os_enum = sa.Enum("UNIX", "WINDOWS", name="serveros")

sync_source_enum = sa.Enum("ADMIN", "AGENT", name="syncsource")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "agents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("site", sa.String(length=120), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_agents_name"), "agents", ["name"], unique=True)
    op.create_index(op.f("ix_agents_site"), "agents", ["site"], unique=False)

    op.create_table(
        "target_servers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("site", sa.String(length=120), nullable=False),
        sa.Column("agent_id", sa.String(length=36), nullable=False),
        sa.Column("os_type", server_os_enum, nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("managed_account", sa.String(length=120), nullable=False),
        sa.Column("connection_username", sa.String(length=120), nullable=False),
        sa.Column("connection_profile", sa.String(length=255), nullable=False, server_default="default"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_target_servers_agent_id"), "target_servers", ["agent_id"], unique=False)
    op.create_index(op.f("ix_target_servers_name"), "target_servers", ["name"], unique=True)
    op.create_index(op.f("ix_target_servers_os_type"), "target_servers", ["os_type"], unique=False)
    op.create_index(op.f("ix_target_servers_site"), "target_servers", ["site"], unique=False)

    op.create_table(
        "credentials",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("server_id", sa.String(length=36), nullable=False),
        sa.Column("managed_account", sa.String(length=120), nullable=False),
        sa.Column("ciphertext", sa.Text(), nullable=False),
        sa.Column("ciphertext_nonce", sa.String(length=255), nullable=False),
        sa.Column("encrypted_dek", sa.Text(), nullable=False),
        sa.Column("encrypted_dek_nonce", sa.String(length=255), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_sync_source", sync_source_enum, nullable=False, server_default="ADMIN"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], ["target_servers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("server_id", "managed_account", name="uq_server_managed_account"),
    )
    op.create_index(op.f("ix_credentials_last_synced_at"), "credentials", ["last_synced_at"], unique=False)
    op.create_index(op.f("ix_credentials_last_sync_source"), "credentials", ["last_sync_source"], unique=False)
    op.create_index(op.f("ix_credentials_managed_account"), "credentials", ["managed_account"], unique=False)
    op.create_index(op.f("ix_credentials_server_id"), "credentials", ["server_id"], unique=False)

    

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_type", sa.String(length=30), nullable=False),
        sa.Column("actor_id", sa.String(length=120), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("resource_type", sa.String(length=120), nullable=False),
        sa.Column("resource_id", sa.String(length=120), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_actor_id"), "audit_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_actor_type"), "audit_logs", ["actor_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_resource_id"), "audit_logs", ["resource_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_resource_type"), "audit_logs", ["resource_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_resource_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_resource_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_access_requests_status"), table_name="access_requests")
    op.drop_index(op.f("ix_access_requests_requester_id"), table_name="access_requests")
    op.drop_index(op.f("ix_access_requests_credential_id"), table_name="access_requests")
    op.drop_table("access_requests")

    op.drop_index(op.f("ix_credentials_server_id"), table_name="credentials")
    op.drop_index(op.f("ix_credentials_managed_account"), table_name="credentials")
    op.drop_index(op.f("ix_credentials_last_sync_source"), table_name="credentials")
    op.drop_index(op.f("ix_credentials_last_synced_at"), table_name="credentials")
    op.drop_table("credentials")

    op.drop_index(op.f("ix_target_servers_site"), table_name="target_servers")
    op.drop_index(op.f("ix_target_servers_os_type"), table_name="target_servers")
    op.drop_index(op.f("ix_target_servers_name"), table_name="target_servers")
    op.drop_index(op.f("ix_target_servers_agent_id"), table_name="target_servers")
    op.drop_table("target_servers")

    op.drop_index(op.f("ix_agents_site"), table_name="agents")
    op.drop_index(op.f("ix_agents_name"), table_name="agents")
    op.drop_table("agents")

    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    sync_source_enum.drop(bind, checkfirst=True)
    access_status_enum.drop(bind, checkfirst=True)
    server_os_enum.drop(bind, checkfirst=True)
    user_role_enum.drop(bind, checkfirst=True)
