"""Add system settings table.

Revision ID: 20260518_0003
Revises: 20260512_0002
Create Date: 2026-05-18 00:00:00
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260518_0003"
down_revision = "20260512_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.bulk_insert(
        sa.table(
            "system_settings",
            sa.column("key", sa.String(length=120)),
            sa.column("value", sa.String(length=255)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ),
        [{"key": "direct_reveal_minutes", "value": "5", "updated_at": datetime.now(timezone.utc)}],
    )


def downgrade() -> None:
    op.drop_table("system_settings")
