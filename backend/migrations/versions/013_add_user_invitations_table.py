"""Add user_invitations table for email-based user signup workflow.

Revision ID: 013_add_user_invitations_table
Revises: 012_add_message_logs_table
Create Date: 2026-03-02 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '013_add_user_invitations_table'
down_revision: Union[str, Sequence[str]] = '012_add_message_logs_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_invitations table
    op.create_table(
        'user_invitations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(36), nullable=False),
        sa.Column('email', sa.String(200), nullable=False),
        sa.Column('role', sa.Enum('SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'RECEPTIONIST', name='userroleenum'), nullable=False, server_default='TECHNICIAN'),
        sa.Column('token', sa.String(255), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('token'),
    )
    
    # Create indexes
    op.create_index('idx_invitation_company', 'user_invitations', ['company_id'])
    op.create_index('idx_invitation_email', 'user_invitations', ['email'])
    op.create_index('idx_invitation_expires', 'user_invitations', ['expires_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_invitation_expires', table_name='user_invitations')
    op.drop_index('idx_invitation_email', table_name='user_invitations')
    op.drop_index('idx_invitation_company', table_name='user_invitations')
    
    # Drop table
    op.drop_table('user_invitations')
