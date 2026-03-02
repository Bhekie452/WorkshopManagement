"""Add message_logs table for SMS/WhatsApp tracking.

Revision ID: 012_add_message_logs_table
Revises: 011_add_payment_transactions_table
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '012_add_message_logs_table'
down_revision: Union[str, Sequence[str]] = '011_add_payment_transactions_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create message_status enum type
    message_status_enum = sa.Enum(
        'Pending',
        'Sent',
        'Failed',
        'Delivered',
        name='messagestatusenum',
        native_enum=True
    )
    message_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Create message_channel enum type
    message_channel_enum = sa.Enum(
        'SMS',
        'WhatsApp',
        name='messagechannelenum',
        native_enum=True
    )
    message_channel_enum.create(op.get_bind(), checkfirst=True)
    
    # Create message_logs table
    op.create_table(
        'message_logs',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(36), nullable=False),
        sa.Column('customer_id', sa.String(36), nullable=False),
        sa.Column('channel', sa.Enum('SMS', 'WhatsApp', name='messagechannelenum'), nullable=False, server_default='SMS'),
        sa.Column('template_id', sa.String(50), nullable=False),
        sa.Column('template_name', sa.String(200), nullable=True),
        sa.Column('recipient_phone', sa.String(20), nullable=False),
        sa.Column('recipient_email', sa.String(200), nullable=True),
        sa.Column('message_content', sa.Text(), nullable=False),
        sa.Column('job_id', sa.String(36), nullable=True),
        sa.Column('invoice_id', sa.String(36), nullable=True),
        sa.Column('appointment_id', sa.String(36), nullable=True),
        sa.Column('trigger_event', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('Pending', 'Sent', 'Failed', 'Delivered', name='messagestatusenum'), nullable=False, server_default='Pending'),
        sa.Column('external_message_id', sa.String(100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_message_company', 'message_logs', ['company_id'])
    op.create_index('idx_message_customer', 'message_logs', ['customer_id'])
    op.create_index('idx_message_status', 'message_logs', ['status'])
    op.create_index('idx_message_template', 'message_logs', ['template_id'])
    op.create_index('idx_message_job', 'message_logs', ['job_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_message_job', table_name='message_logs')
    op.drop_index('idx_message_template', table_name='message_logs')
    op.drop_index('idx_message_status', table_name='message_logs')
    op.drop_index('idx_message_customer', table_name='message_logs')
    op.drop_index('idx_message_company', table_name='message_logs')
    
    # Drop table
    op.drop_table('message_logs')
    
    # Drop enums
    sa.Enum(name='messagechannelenum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='messagestatusenum').drop(op.get_bind(), checkfirst=True)
