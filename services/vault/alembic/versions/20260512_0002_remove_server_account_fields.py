"""Remove account fields from target servers.

Revision ID: 20260512_0002
Revises: 20260424_0001
Create Date: 2026-05-12 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260512_0002"
down_revision = "20260424_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("target_servers", "connection_username")
    op.drop_column("target_servers", "managed_account")


def downgrade() -> None:
    op.add_column(
        "target_servers",
        sa.Column("managed_account", sa.String(length=120), nullable=False, server_default=""),
    )
    op.add_column(
        "target_servers",
        sa.Column("connection_username", sa.String(length=120), nullable=False, server_default=""),
    )
