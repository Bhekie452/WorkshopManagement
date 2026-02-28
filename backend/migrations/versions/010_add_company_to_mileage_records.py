"""Add company_id to mileage_records table for multi-tenant isolation

Revision ID: 010_add_company_to_mileage_records
Revises: 009_add_company_to_labor_entries
Create Date: 2026-02-28 00:00:00.000000

Adds company_id column to mileage_records table to enforce company-level data isolation:
- company_id (required foreign key to companies table)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_add_company_to_mileage_records'
down_revision: Union[str, Sequence[str]] = '009_add_company_to_labor_entries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('mileage_records', schema=None) as batch_op:
        # Add company_id column to mileage_records table with a server default
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=False, server_default='00000000-0000-0000-0000-000000000000'))
        
        # Add foreign key constraint
        batch_op.create_foreign_key('fk_mileage_records_company_id', 'companies', ['company_id'], ['id'])


def downgrade() -> None:
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('mileage_records', schema=None) as batch_op:
        # Remove the foreign key constraint
        batch_op.drop_constraint('fk_mileage_records_company_id', type_='foreignkey')
        
        # Remove the column
        batch_op.drop_column('company_id')
