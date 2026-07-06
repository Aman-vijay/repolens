"""add_chat_sessions_and_messages

Revision ID: 00f3a9fd34dd
Revises: 30abd9758e60
Create Date: 2026-07-06 15:20:56.873380

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '00f3a9fd34dd'
down_revision: Union[str, None] = '30abd9758e60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('chat_sessions',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_sessions_project_id', 'chat_sessions', ['project_id'], unique=False)
    op.create_index('ix_chat_sessions_user_id', 'chat_sessions', ['user_id'], unique=False)

    op.create_table('chat_messages',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('extra', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_messages_session_id', 'chat_messages', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_chat_messages_session_id', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('ix_chat_sessions_user_id', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_project_id', table_name='chat_sessions')
    op.drop_table('chat_sessions')