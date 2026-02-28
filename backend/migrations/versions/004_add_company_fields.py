"""Add additional company fields for subscription management

Revision ID: 004_add_company_fields
Revises: 003_add_company_to_invoices_and_require_customer
Create Date: 2026-02-28 00:00:00.000000

Adds fields to support company subscriptions and management:
- industry (what industry the company operates in)
- subscription (free/basic/premium/enterprise)
- max_users (user limit for tier)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_add_company_fields'
down_revision: Union[str, Sequence[str]] = '003_add_company_to_invoices_and_require_customer'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to companies table
    op.add_column('companies', sa.Column('industry', sa.String(length=100), nullable=True))
    op.add_column('companies', sa.Column('subscription', sa.String(length=50), nullable=False, server_default='free'))
    op.add_column('companies', sa.Column('max_users', sa.Integer(), nullable=False, server_default='5'))


def downgrade() -> None:
    # Remove columns
    op.drop_column('companies', 'max_users')
    op.drop_column('companies', 'subscription')
    op.drop_column('companies', 'industry')
