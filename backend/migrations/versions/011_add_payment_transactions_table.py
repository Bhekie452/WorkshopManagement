"""Add payment_transactions table for PayFast integration

Revision ID: 011_add_payment_transactions_table
Revises: 010_add_company_to_mileage_records
Create Date: 2026-02-28 00:00:00.000000

Creates payment_transactions table to store PayFast payment records:
- Tracks payment status, amounts, and PayFast transaction IDs
- Stores signature verification for webhook validation
- Maintains audit trail for payment retry logic
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '011_add_payment_transactions_table'
down_revision: Union[str, Sequence[str]] = '010_add_company_to_mileage_records'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create payment_transactions table."""
    op.create_table(
        'payment_transactions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=False),
        sa.Column('invoice_id', sa.String(length=36), nullable=False),
        sa.Column('payment_id', sa.String(length=100), nullable=False),
        sa.Column('pf_payment_id', sa.String(length=100), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('amount_gross', sa.Float(), nullable=True),
        sa.Column('amount_fee', sa.Float(), nullable=True),
        sa.Column('amount_net', sa.Float(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='Pending'),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('initiated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('payfast_response', sa.JSON(), nullable=True),
        sa.Column('signature_valid', sa.Boolean(), nullable=False, server_default='False'),
        sa.Column('signature_hash', sa.String(length=255), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_retry_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('idx_payment_invoice', 'payment_transactions', ['invoice_id'])
    op.create_index('idx_payment_status', 'payment_transactions', ['status'])
    op.create_index('idx_payment_company', 'payment_transactions', ['company_id'])
    op.create_index('ix_payment_transactions_payment_id', 'payment_transactions', ['payment_id'], unique=True)
    op.create_index('ix_payment_transactions_pf_payment_id', 'payment_transactions', ['pf_payment_id'])


def downgrade() -> None:
    """Drop payment_transactions table."""
    op.drop_index('ix_payment_transactions_pf_payment_id', table_name='payment_transactions')
    op.drop_index('ix_payment_transactions_payment_id', table_name='payment_transactions')
    op.drop_index('idx_payment_company', table_name='payment_transactions')
    op.drop_index('idx_payment_status', table_name='payment_transactions')
    op.drop_index('idx_payment_invoice', table_name='payment_transactions')
    op.drop_table('payment_transactions')
