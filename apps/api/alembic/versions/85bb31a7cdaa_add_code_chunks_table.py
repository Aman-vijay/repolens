"""add_code_chunks_table

Revision ID: 85bb31a7cdaa
Revises: 54f8be6e5c78
Create Date: 2026-07-04 16:12:41.150654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '85bb31a7cdaa'
down_revision: Union[str, None] = '54f8be6e5c78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('code_chunks',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('repository_id', sa.Uuid(), nullable=False),
        sa.Column('file_path', sa.String(length=2048), nullable=False),
        sa.Column('language', sa.String(length=64), nullable=False),
        sa.Column('start_line', sa.Integer(), nullable=False),
        sa.Column('end_line', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['repository_id'], ['repositories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_code_chunks_repository_id', 'code_chunks', ['repository_id'], unique=False)
    # HNSW index for fast approximate nearest neighbor search on embeddings
    op.execute(
        "CREATE INDEX ix_code_chunks_embedding ON code_chunks "
        "USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.drop_index('ix_code_chunks_embedding', table_name='code_chunks')
    op.drop_index('ix_code_chunks_repository_id', table_name='code_chunks')
    op.drop_table('code_chunks')