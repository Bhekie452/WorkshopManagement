"""Initial schema - Workshop Management System

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

This migration creates all tables for the workshop management system:
- companies (multi-tenancy)
- users (authentication)
- customers
- vehicles
- jobs (work orders)
- job_tasks
- parts (inventory)
- job_parts (parts used in jobs)
- labor_entries
- invoices
- invoice_items
- appointments
- mileage_records
- diagnostic_records
- job_activity_logs
- voice_commands
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == 'postgresql'

    if is_pg:
        # Create enum types (PostgreSQL only)
        op.execute("CREATE TYPE IF NOT EXISTS userroleenum AS ENUM ('SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'RECEPTIONIST')")
        op.execute("CREATE TYPE IF NOT EXISTS jobstatusenum AS ENUM ('Pending', 'In Progress', 'Awaiting Parts', 'Awaiting Approval', 'Completed', 'Paid', 'Cancelled')")
        op.execute("CREATE TYPE IF NOT EXISTS priorityenum AS ENUM ('Low', 'Medium', 'High')")
        op.execute("CREATE TYPE IF NOT EXISTS invoicestatusenum AS ENUM ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')")
        op.execute("CREATE TYPE IF NOT EXISTS appointmentstatusenum AS ENUM ('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show')")
        op.execute("CREATE TYPE IF NOT EXISTS fueltypeenum AS ENUM ('Petrol', 'Diesel', 'Electric', 'Hybrid', 'Other')")

    # Create companies table
    op.create_table('companies',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('address_street', sa.String(length=200), nullable=True),
        sa.Column('address_city', sa.String(length=100), nullable=True),
        sa.Column('address_province', sa.String(length=100), nullable=True),
        sa.Column('address_postal', sa.String(length=20), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=200), nullable=True),
        sa.Column('vat_number', sa.String(length=50), nullable=True),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create users table
    op.create_table('users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=True),
        sa.Column('email', sa.String(length=200), nullable=False),
        sa.Column('password_hash', sa.String(length=200), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('email_verified', sa.Boolean(), nullable=False),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Create customers table
    op.create_table('customers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('email', sa.String(length=200), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('customer_type', sa.String(length=50), nullable=False),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('consent', sa.Boolean(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_customers_name', 'customers', ['name'], unique=False)
    op.create_index('ix_customers_email', 'customers', ['email'], unique=False)

    # Create vehicles table
    op.create_table('vehicles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=False),
        sa.Column('registration', sa.String(length=20), nullable=False),
        sa.Column('vin', sa.String(length=50), nullable=False),
        sa.Column('make', sa.String(length=100), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('color', sa.String(length=50), nullable=True),
        sa.Column('fuel_type', sa.String(length=50), nullable=False),
        sa.Column('mileage', sa.Integer(), nullable=False),
        sa.Column('engine_number', sa.String(length=100), nullable=True),
        sa.Column('battery_capacity_kwh', sa.Float(), nullable=True),
        sa.Column('battery_soh', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['customers.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('vin')
    )
    op.create_index('ix_vehicles_registration', 'vehicles', ['registration'], unique=False)
    op.create_index('idx_vehicle_make_model', 'vehicles', ['make', 'model'], unique=False)

    # Create jobs table
    op.create_table('jobs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=False),
        sa.Column('assigned_to', sa.String(length=36), nullable=True),
        sa.Column('job_number', sa.String(length=50), nullable=False),
        sa.Column('service_type', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=False),
        sa.Column('estimated_cost', sa.Float(), nullable=False),
        sa.Column('actual_cost', sa.Float(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_number')
    )
    op.create_index('idx_job_status', 'jobs', ['status'], unique=False)
    op.create_index('idx_job_customer', 'jobs', ['customer_id'], unique=False)

    # Create job_tasks table
    op.create_table('job_tasks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_by', sa.String(length=36), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['completed_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create parts table
    op.create_table('parts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('sku', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('min_level', sa.Integer(), nullable=False),
        sa.Column('cost_price', sa.Float(), nullable=False),
        sa.Column('selling_price', sa.Float(), nullable=False),
        sa.Column('location', sa.String(length=50), nullable=True),
        sa.Column('supplier', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sku')
    )
    op.create_index('ix_parts_sku', 'parts', ['sku'], unique=True)
    op.create_index('ix_parts_name', 'parts', ['name'], unique=False)

    # Create job_parts table
    op.create_table('job_parts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('part_id', sa.String(length=36), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('price_at_time', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.ForeignKeyConstraint(['part_id'], ['parts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create labor_entries table
    op.create_table('labor_entries',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('technician_id', sa.String(length=36), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('hours', sa.Float(), nullable=False),
        sa.Column('rate_per_hour', sa.Float(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.ForeignKeyConstraint(['technician_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create invoices table
    op.create_table('invoices',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=True),
        sa.Column('job_id', sa.String(length=36), nullable=True),
        sa.Column('invoice_type', sa.String(length=20), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('issue_date', sa.DateTime(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=False),
        sa.Column('subtotal', sa.Float(), nullable=False),
        sa.Column('tax_rate', sa.Float(), nullable=False),
        sa.Column('tax_amount', sa.Float(), nullable=False),
        sa.Column('discount', sa.Float(), nullable=False),
        sa.Column('total', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number')
    )
    op.create_index('idx_invoice_status', 'invoices', ['status'], unique=False)
    op.create_index('idx_invoice_customer', 'invoices', ['customer_id'], unique=False)

    # Create invoice_items table
    op.create_table('invoice_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('invoice_id', sa.String(length=36), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('total', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create appointments table
    op.create_table('appointments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=True),
        sa.Column('assigned_to', sa.String(length=36), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('appointment_type', sa.String(length=50), nullable=True),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('recurrence', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('reminder_sent', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_appointment_datetime', 'appointments', ['start_time', 'end_time'], unique=False)

    # Create mileage_records table
    op.create_table('mileage_records',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=False),
        sa.Column('mileage', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('recorded_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create diagnostic_records table
    op.create_table('diagnostic_records',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=False),
        sa.Column('symptoms', sa.Text(), nullable=True),
        sa.Column('dtc_codes', sa.JSON(), nullable=True),
        sa.Column('ai_analysis', sa.Text(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create job_activity_logs table
    op.create_table('job_activity_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create voice_commands table
    op.create_table('voice_commands',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('command_text', sa.Text(), nullable=False),
        sa.Column('response_text', sa.Text(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('context', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('voice_commands')
    op.drop_table('job_activity_logs')
    op.drop_table('diagnostic_records')
    op.drop_table('mileage_records')
    op.drop_table('appointments')
    op.drop_table('invoice_items')
    op.drop_table('invoices')
    op.drop_table('labor_entries')
    op.drop_table('job_parts')
    op.drop_table('parts')
    op.drop_table('job_tasks')
    op.drop_table('jobs')
    op.drop_table('vehicles')
    op.drop_table('customers')
    op.drop_table('users')
    op.drop_table('companies')
    
    # Drop enum types (PostgreSQL only)
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS fueltypeenum")
        op.execute("DROP TYPE IF EXISTS appointmentstatusenum")
        op.execute("DROP TYPE IF EXISTS invoicestatusenum")
        op.execute("DROP TYPE IF EXISTS priorityenum")
        op.execute("DROP TYPE IF EXISTS jobstatusenum")
        op.execute("DROP TYPE IF EXISTS userroleenum")
