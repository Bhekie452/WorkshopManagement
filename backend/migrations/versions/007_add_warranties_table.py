"""Add warranty management table

Revision ID: 007_add_warranties_table
Revises: 006_add_company_to_appointments
Create Date: 2026-02-28 00:00:00.000000

Creates warranty table for tracking warranty coverage on completed jobs:
- company_id (company-level isolation)
- job_id (associated job)
- vehicle_id (vehicle covered)
- warranty_type (labor, parts, or both)
- expiry_date (when warranty expires)
- coverage_description (details of coverage)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_add_warranties_table'
down_revision: Union[str, Sequence[str]] = '006_add_company_to_appointments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create warranties table
    op.create_table(
        'warranties',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=False),
        sa.Column('warranty_type', sa.String(length=100), nullable=False),
        sa.Column('expiry_date', sa.DateTime(), nullable=False),
        sa.Column('coverage_description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop warranties table
    op.drop_table('warranties')
