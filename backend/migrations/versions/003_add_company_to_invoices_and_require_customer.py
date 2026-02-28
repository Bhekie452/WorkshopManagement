"""Add company_id to invoices and require company on customers

Revision ID: 003_add_company_to_invoices_and_require_customer
Revises: 002_require_user_company
Create Date: 2026-02-28 00:05:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_add_company_to_invoices_and_require_customer'
down_revision = '002_require_user_company'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make sure any existing customers have a company (could default to empty or a placeholder)
    op.execute("UPDATE customers SET company_id = '' WHERE company_id IS NULL")
    with op.batch_alter_table('customers') as batch_op:
        batch_op.alter_column('company_id', existing_type=sa.String(length=36), nullable=False)

    # Add company_id to invoices
    op.add_column('invoices', sa.Column('company_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_invoices_company', 'invoices', 'companies', ['company_id'], ['id'])
    # populate existing rows with default empty string if necessary
    op.execute("UPDATE invoices SET company_id = '' WHERE company_id IS NULL")
    with op.batch_alter_table('invoices') as batch_op:
        batch_op.alter_column('company_id', existing_type=sa.String(length=36), nullable=False)
    # add index for faster filtering
    op.create_index('idx_invoices_company', 'invoices', ['company_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('invoices') as batch_op:
        batch_op.drop_index('idx_invoices_company')
        batch_op.drop_constraint('fk_invoices_company', type_='foreignkey')
        batch_op.drop_column('company_id')

    with op.batch_alter_table('customers') as batch_op:
        batch_op.alter_column('company_id', existing_type=sa.String(length=36), nullable=True)
