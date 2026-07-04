"""fix_server_defaults_on_repositories

Revision ID: 54f8be6e5c78
Revises: 885ef361c0e5
Create Date: 2026-07-04 15:26:33.997847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '54f8be6e5c78'
down_revision: Union[str, None] = '885ef361c0e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "repositories", "progress",
        server_default="0",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "repositories", "file_count",
        server_default="0",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "repositories", "total_size_bytes",
        server_default="0",
        existing_type=sa.Integer(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "repositories", "total_size_bytes",
        server_default=None,
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "repositories", "file_count",
        server_default=None,
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
    op.alter_column(
        "repositories", "progress",
        server_default=None,
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
