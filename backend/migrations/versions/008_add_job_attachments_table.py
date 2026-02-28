"""Add job attachments storage table

Revision ID: 008_add_job_attachments_table
Revises: 007_add_warranties_table
Create Date: 2026-02-28 00:00:00.000000

Creates job_attachments table for storing file references:
- company_id (company-level isolation)
- job_id (associated job)
- filename (original file name)
- file_url (Firebase Storage URL)
- file_type (document type)
- file_size (size in bytes)
- uploaded_by (user who uploaded)
- upload_date (when uploaded)
- description (optional description)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_add_job_attachments_table'
down_revision: Union[str, Sequence[str]] = '007_add_warranties_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create job_attachments table
    op.create_table(
        'job_attachments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('uploaded_by', sa.String(length=36), nullable=True),
        sa.Column('upload_date', sa.DateTime(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    # Create index on job_id for faster lookups
    op.create_index(op.f('ix_job_attachments_job_id'), 'job_attachments', ['job_id'], unique=False)


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f('ix_job_attachments_job_id'), table_name='job_attachments')
    # Drop job_attachments table
    op.drop_table('job_attachments')
