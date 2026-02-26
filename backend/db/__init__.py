"""
Database package for Workshop Management System.

This package contains SQLAlchemy models and database utilities.
"""

from .models import (
    Base,
    Company,
    User,
    Customer,
    Vehicle,
    Job,
    JobTask,
    Part,
    JobPart,
    LaborEntry,
    Invoice,
    InvoiceItem,
    Appointment,
    MileageRecord,
    DiagnosticRecord,
    JobActivityLog,
    UserRoleEnum,
    JobStatusEnum,
    PriorityEnum,
    InvoiceStatusEnum,
    AppointmentStatusEnum,
    FuelTypeEnum,
)

from .database import (
    engine,
    SessionLocal,
    get_db,
    get_db_context,
    init_db,
    drop_db,
    check_db_connection,
)

__all__ = [
    # Base
    "Base",
    # Models
    "Company",
    "User",
    "Customer",
    "Vehicle",
    "Job",
    "JobTask",
    "Part",
    "JobPart",
    "LaborEntry",
    "Invoice",
    "InvoiceItem",
    "Appointment",
    "MileageRecord",
    "DiagnosticRecord",
    "JobActivityLog",
    # Enums
    "UserRoleEnum",
    "JobStatusEnum",
    "PriorityEnum",
    "InvoiceStatusEnum",
    "AppointmentStatusEnum",
    "FuelTypeEnum",
    # Database utilities
    "engine",
    "SessionLocal",
    "get_db",
    "get_db_context",
    "init_db",
    "drop_db",
    "check_db_connection",
]
