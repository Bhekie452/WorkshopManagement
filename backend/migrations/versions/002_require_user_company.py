"""Require company_id on users

Revision ID: 002_require_user_company
Revises: 001_initial
Create Date: 2026-02-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_require_user_company'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # make sure all existing users have a company; default to empty string or temp
    op.execute("UPDATE users SET company_id = '' WHERE company_id IS NULL")
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('company_id', existing_type=sa.String(length=36), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('company_id', existing_type=sa.String(length=36), nullable=True)
