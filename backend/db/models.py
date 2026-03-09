"""
SQLAlchemy Database Models for Workshop Management System

This module defines the database schema using SQLAlchemy ORM.
12 core tables with relationships for the workshop management system.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, Enum, ForeignKey,
    JSON, UniqueConstraint, Index, Table
)
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum


# =============================================================================
# Base Class
# =============================================================================

class Base(DeclarativeBase):
    """Base class for all models."""
    pass


# =============================================================================
# Enums
# =============================================================================

class UserRoleEnum(str, enum.Enum):
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    TECHNICIAN = "TECHNICIAN"
    RECEPTIONIST = "RECEPTIONIST"


class JobStatusEnum(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    AWAITING_PARTS = "Awaiting Parts"
    AWAITING_APPROVAL = "Awaiting Approval"
    COMPLETED = "Completed"
    PAID = "Paid"
    CANCELLED = "Cancelled"


class PriorityEnum(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class InvoiceStatusEnum(str, enum.Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    PAID = "Paid"
    OVERDUE = "Overdue"
    CANCELLED = "Cancelled"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "Pending"
    COMPLETE = "Complete"
    FAILED = "Failed"
    CANCELLED = "Cancelled"


class MessageStatusEnum(str, enum.Enum):
    PENDING = "Pending"
    SENT = "Sent"
    FAILED = "Failed"
    DELIVERED = "Delivered"


class MessageChannelEnum(str, enum.Enum):
    SMS = "SMS"
    WHATSAPP = "WhatsApp"


class AppointmentStatusEnum(str, enum.Enum):
    SCHEDULED = "Scheduled"
    CONFIRMED = "Confirmed"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    NO_SHOW = "No Show"


class FuelTypeEnum(str, enum.Enum):
    PETROL = "Petrol"
    DIESEL = "Diesel"
    ELECTRIC = "Electric"
    HYBRID = "Hybrid"
    OTHER = "Other"


# =============================================================================
# Table 1: Companies (Multi-tenancy)
# =============================================================================

class Company(Base):
    """Company/Workshop entity for multi-tenancy."""
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address_street: Mapped[Optional[str]] = mapped_column(String(200))
    address_city: Mapped[Optional[str]] = mapped_column(String(100))
    address_province: Mapped[Optional[str]] = mapped_column(String(100))
    address_postal: Mapped[Optional[str]] = mapped_column(String(20))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    vat_number: Mapped[Optional[str]] = mapped_column(String(50))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    settings: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    industry: Mapped[Optional[str]] = mapped_column(String(100))
    subscription: Mapped[str] = mapped_column(String(50), default="free")
    max_users: Mapped[int] = mapped_column(Integer, default=5)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="company")
    customers: Mapped[List["Customer"]] = relationship("Customer", back_populates="company")

    def __repr__(self):
        return f"<Company(id={self.id}, name={self.name})>"


# =============================================================================
# Table 2: Users
# =============================================================================

class User(Base):
    """User account entity."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRoleEnum] = mapped_column(Enum(UserRoleEnum), default=UserRoleEnum.TECHNICIAN)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="users")
    jobs_assigned: Mapped[List["Job"]] = relationship("Job", back_populates="assigned_technician", foreign_keys="Job.assigned_to")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


# =============================================================================
# Table 3: Customers
# =============================================================================

class Customer(Base):
    """Customer entity."""
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(200), index=True)
    phone: Mapped[str] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    customer_type: Mapped[str] = mapped_column(String(50), default="Private")  # Private, Fleet, Government
    department: Mapped[Optional[str]] = mapped_column(String(100))  # For government/fleet
    consent: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="customers")
    vehicles: Mapped[List["Vehicle"]] = relationship("Vehicle", back_populates="owner")
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="customer")
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="customer")
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="customer")

    def __repr__(self):
        return f"<Customer(id={self.id}, name={self.name})>"


# =============================================================================
# Table 4: Vehicles
# =============================================================================

class Vehicle(Base):
    """Vehicle entity."""
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), nullable=False)
    registration: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    vin: Mapped[str] = mapped_column(String(50), unique=True)
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer)
    color: Mapped[Optional[str]] = mapped_column(String(50))
    fuel_type: Mapped[FuelTypeEnum] = mapped_column(Enum(FuelTypeEnum), default=FuelTypeEnum.PETROL)
    mileage: Mapped[int] = mapped_column(Integer, default=0)
    engine_number: Mapped[Optional[str]] = mapped_column(String(100))
    
    # EV-specific fields
    battery_capacity_kwh: Mapped[Optional[float]] = mapped_column(Float)
    battery_soh: Mapped[Optional[float]] = mapped_column(Float)  # State of Health %
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner: Mapped["Customer"] = relationship("Customer", back_populates="vehicles")
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="vehicle")
    mileage_history: Mapped[List["MileageRecord"]] = relationship("MileageRecord", back_populates="vehicle")
    diagnostics: Mapped[List["DiagnosticRecord"]] = relationship("DiagnosticRecord", back_populates="vehicle")
    battery_history: Mapped[List["EVBatteryRUL"]] = relationship("EVBatteryRUL", back_populates="vehicle")

    __table_args__ = (
        Index('idx_vehicle_make_model', 'make', 'model'),
    )

    def __repr__(self):
        return f"<Vehicle(id={self.id}, registration={self.registration}, {self.make} {self.model})>"


# =============================================================================
# Table 5: Jobs (Work Orders)
# =============================================================================

class Job(Base):
    """Job/Work Order entity."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    
    job_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    service_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    status: Mapped[JobStatusEnum] = mapped_column(Enum(JobStatusEnum), default=JobStatusEnum.PENDING)
    priority: Mapped[PriorityEnum] = mapped_column(Enum(PriorityEnum), default=PriorityEnum.MEDIUM)
    
    estimated_cost: Mapped[float] = mapped_column(Float, default=0)
    actual_cost: Mapped[Optional[float]] = mapped_column(Float)
    estimated_hours: Mapped[float] = mapped_column(Float, default=0)
    
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def actual_hours(self) -> float:
        return sum(l.hours for l in self.labor_log)

    @property
    def time_variance(self) -> float:
        """Actual hours - Estimated hours (Positive means over, Negative means under)"""
        return self.actual_hours - self.estimated_hours

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="jobs")
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="jobs")
    assigned_technician: Mapped[Optional["User"]] = relationship("User", back_populates="jobs_assigned", foreign_keys=[assigned_to])
    tasks: Mapped[List["JobTask"]] = relationship("JobTask", back_populates="job", cascade="all, delete-orphan")
    parts_used: Mapped[List["JobPart"]] = relationship("JobPart", back_populates="job", cascade="all, delete-orphan")
    labor_log: Mapped[List["LaborEntry"]] = relationship("LaborEntry", back_populates="job", cascade="all, delete-orphan")
    activity_log: Mapped[List["JobActivityLog"]] = relationship("JobActivityLog", back_populates="job", cascade="all, delete-orphan")
    attachments: Mapped[List["JobAttachment"]] = relationship("JobAttachment", back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_job_status', 'status'),
        Index('idx_job_customer', 'customer_id'),
    )

    def __repr__(self):
        return f"<Job(id={self.id}, job_number={self.job_number}, status={self.status})>"


# =============================================================================
# Table 6: Job Tasks
# =============================================================================

class JobTask(Base):
    """Task checklist item for a job."""
    __tablename__ = "job_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    order: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="tasks")

    def __repr__(self):
        return f"<JobTask(id={self.id}, description={self.description[:30]}..., completed={self.completed})>"


# =============================================================================
# Table 7: Parts / Inventory
# =============================================================================

class Part(Base):
    """Inventory part entity."""
    __tablename__ = "parts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100))
    
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    min_level: Mapped[int] = mapped_column(Integer, default=5)
    
    cost_price: Mapped[float] = mapped_column(Float, default=0)
    selling_price: Mapped[float] = mapped_column(Float, default=0)
    
    location: Mapped[Optional[str]] = mapped_column(String(50))  # Shelf/bin location
    supplier: Mapped[Optional[str]] = mapped_column(String(200))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    job_usages: Mapped[List["JobPart"]] = relationship("JobPart", back_populates="part")

    @property
    def is_low_stock(self) -> bool:
        return self.quantity <= self.min_level

    def __repr__(self):
        return f"<Part(id={self.id}, sku={self.sku}, name={self.name}, qty={self.quantity})>"


# =============================================================================
# Table 8: Job Parts (Many-to-Many)
# =============================================================================

class JobPart(Base):
    """Parts used in a job (junction table)."""
    __tablename__ = "job_parts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    part_id: Mapped[str] = mapped_column(String(36), ForeignKey("parts.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    price_at_time: Mapped[float] = mapped_column(Float)  # Price when used
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="parts_used")
    part: Mapped["Part"] = relationship("Part", back_populates="job_usages")

    @property
    def total(self) -> float:
        return self.quantity * self.price_at_time

    def __repr__(self):
        return f"<JobPart(job={self.job_id}, part={self.part_id}, qty={self.quantity})>"


# =============================================================================
# Table 9: Labor Entries
# =============================================================================

class LaborEntry(Base):
    """Labor time tracking for jobs."""
    __tablename__ = "labor_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    technician_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    hours: Mapped[float] = mapped_column(Float, default=0)
    rate_per_hour: Mapped[float] = mapped_column(Float, default=500)
    
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    job: Mapped["Job"] = relationship("Job", back_populates="labor_log")
    technician: Mapped[Optional["User"]] = relationship("User")

    @property
    def total(self) -> float:
        return self.hours * self.rate_per_hour

    def __repr__(self):
        return f"<LaborEntry(job={self.job_id}, hours={self.hours}, total={self.total})>"


# =============================================================================
# Table 10: Invoices
# =============================================================================

class Invoice(Base):
    """Invoice/Quote entity."""
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), nullable=False)
    vehicle_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("vehicles.id"))
    job_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("jobs.id"))
    
    invoice_type: Mapped[str] = mapped_column(String(20), default="Invoice")  # Invoice or Quote
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    
    issue_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[datetime] = mapped_column(DateTime)
    
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    tax_rate: Mapped[float] = mapped_column(Float, default=0.15)  # 15% VAT
    tax_amount: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    
    status: Mapped[InvoiceStatusEnum] = mapped_column(Enum(InvoiceStatusEnum), default=InvoiceStatusEnum.DRAFT)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_invoice_status', 'status'),
        Index('idx_invoice_customer', 'customer_id'),
        Index('idx_invoice_company', 'company_id'),
    )

    def __repr__(self):
        return f"<Invoice(id={self.id}, number={self.invoice_number}, status={self.status})>"


# =============================================================================
# Table 11: Invoice Items
# =============================================================================

class InvoiceItem(Base):
    """Line item on an invoice."""
    __tablename__ = "invoice_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id: Mapped[str] = mapped_column(String(36), ForeignKey("invoices.id"), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")

    def __repr__(self):
        return f"<InvoiceItem(description={self.description[:30]}..., total={self.total})>"


# =============================================================================
# Table 12: Appointments
# =============================================================================

class Appointment(Base):
    """Scheduling/appointment entity."""
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), nullable=False)
    vehicle_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("vehicles.id"))
    assigned_to: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    appointment_type: Mapped[str] = mapped_column(String(50))  # Service, Inspection, Pickup, etc.
    
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    status: Mapped[AppointmentStatusEnum] = mapped_column(Enum(AppointmentStatusEnum), default=AppointmentStatusEnum.SCHEDULED)
    recurrence: Mapped[str] = mapped_column(String(20), default="None")  # None, Daily, Weekly, Monthly
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="appointments")

    __table_args__ = (
        Index('idx_appointment_datetime', 'start_time', 'end_time'),
    )

    def __repr__(self):
        return f"<Appointment(id={self.id}, title={self.title}, start={self.start_time})>"


# =============================================================================
# Additional Tables
# =============================================================================

class MileageRecord(Base):
    """Vehicle mileage history."""
    __tablename__ = "mileage_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    mileage: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(100))  # Job, Import, Manual
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="mileage_history")


class DiagnosticRecord(Base):
    """Vehicle diagnostic/OBD records."""
    __tablename__ = "diagnostic_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    symptoms: Mapped[Optional[str]] = mapped_column(Text)
    dtc_codes: Mapped[Optional[list]] = mapped_column(JSON)  # List of DTC codes
    ai_analysis: Mapped[Optional[str]] = mapped_column(Text)
    battery_telemetry: Mapped[Optional[dict]] = mapped_column(JSON)  # EV battery data at time of diagnostic
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="diagnostics")


class JobActivityLog(Base):
    """Audit log for job changes."""
    __tablename__ = "job_activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="activity_log")


class VoiceCommand(Base):
    """Voice command logs."""
    __tablename__ = "voice_commands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    command_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_text: Mapped[Optional[str]] = mapped_column(Text)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    context: Mapped[Optional[str]] = mapped_column(String(100))


class EVBatteryRUL(Base):
    """Battery RUL prediction history."""
    __tablename__ = "ev_battery_rul_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    diagnostic_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("diagnostic_records.id"))
    rul_months: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float)
    health_status: Mapped[str] = mapped_column(String(50))
    current_soh: Mapped[float] = mapped_column(Float)
    recommendations: Mapped[Optional[list]] = mapped_column(JSON)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="battery_history")


# =============================================================================
# Table 14: Warranties
# =============================================================================

class Warranty(Base):
    """Warranty coverage for jobs/vehicles."""
    __tablename__ = "warranties"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    
    warranty_type: Mapped[str] = mapped_column(String(100), nullable=False)  # 'labor', 'parts', 'labor_and_parts'
    expiry_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    coverage_description: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    job: Mapped["Job"] = relationship("Job")
    vehicle: Mapped["Vehicle"] = relationship("Vehicle")

    def __repr__(self):
        return f"<Warranty(id={self.id}, type={self.warranty_type}, expires={self.expiry_date})>"


# =============================================================================
# Table 15: Job Attachments
# =============================================================================

class JobAttachment(Base):
    """File attachments for jobs."""
    __tablename__ = "job_attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)  # Firebase Storage URL
    file_type: Mapped[str] = mapped_column(String(50))  # pdf, image, document, etc.
    file_size: Mapped[int] = mapped_column(Integer, default=0)  # size in bytes
    
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    upload_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    job: Mapped["Job"] = relationship("Job", back_populates="attachments")
    uploaded_by_user: Mapped[Optional["User"]] = relationship("User")

    def __repr__(self):
        return f"<JobAttachment(id={self.id}, filename={self.filename})>"

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# =============================================================================
# Table 16: Payment Transactions
# =============================================================================

class PaymentTransaction(Base):
    """PayFast payment transaction records."""
    __tablename__ = "payment_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    invoice_id: Mapped[str] = mapped_column(String(36), ForeignKey("invoices.id"), nullable=False)
    
    # PayFast transaction IDs
    payment_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)  # Our invoice number
    pf_payment_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)  # PayFast transaction ID
    
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    amount_gross: Mapped[Optional[float]] = mapped_column(Float)
    amount_fee: Mapped[Optional[float]] = mapped_column(Float)
    amount_net: Mapped[Optional[float]] = mapped_column(Float)
    
    status: Mapped[PaymentStatusEnum] = mapped_column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50))  # creditcard, eft, bitcoin
    
    # Payment dates
    initiated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # PayFast response data (stored for audit trail)
    payfast_response: Mapped[Optional[dict]] = mapped_column(JSON)
    
    # Signature verification
    signature_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    signature_hash: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Retry tracking
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    invoice: Mapped["Invoice"] = relationship("Invoice")

    __table_args__ = (
        Index('idx_payment_invoice', 'invoice_id'),
        Index('idx_payment_status', 'status'),
        Index('idx_payment_company', 'company_id'),
    )

    def __repr__(self):
        return f"<PaymentTransaction(id={self.id}, invoice={self.invoice_id}, status={self.status}, amount={self.amount})>"


# =============================================================================
# Table: Message Logs
# =============================================================================

class MessageLog(Base):
    """Message/SMS/WhatsApp logging and tracking."""
    __tablename__ = "message_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), nullable=False)
    
    # Message details
    channel: Mapped[MessageChannelEnum] = mapped_column(Enum(MessageChannelEnum), default=MessageChannelEnum.SMS)
    template_id: Mapped[str] = mapped_column(String(50), nullable=False)  # job_received, job_in_progress, etc.
    template_name: Mapped[str] = mapped_column(String(200))  # Human-readable name
    
    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient_email: Mapped[Optional[str]] = mapped_column(String(200))
    
    message_content: Mapped[str] = mapped_column(Text)
    
    # Trigger context
    job_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("jobs.id"))
    invoice_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("invoices.id"))
    appointment_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("appointments.id"))
    
    trigger_event: Mapped[str] = mapped_column(String(50))  # job_status_changed, invoice_created, etc.
    
    # Status tracking
    status: Mapped[MessageStatusEnum] = mapped_column(Enum(MessageStatusEnum), default=MessageStatusEnum.PENDING)
    external_message_id: Mapped[Optional[str]] = mapped_column(String(100))  # Twilio message ID
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")
    customer: Mapped["Customer"] = relationship("Customer")
    job: Mapped[Optional["Job"]] = relationship("Job")
    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice")
    appointment: Mapped[Optional["Appointment"]] = relationship("Appointment")

    __table_args__ = (
        Index('idx_message_company', 'company_id'),
        Index('idx_message_customer', 'customer_id'),
        Index('idx_message_status', 'status'),
        Index('idx_message_template', 'template_id'),
        Index('idx_message_job', 'job_id'),
    )

    def __repr__(self):
        return f"<MessageLog(id={self.id}, template={self.template_id}, status={self.status})>"


# =============================================================================
# Table: User Invitations
# =============================================================================

class UserInvitation(Base):
    """User invitation tokens for email-based signup workflow."""
    __tablename__ = "user_invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    role: Mapped[UserRoleEnum] = mapped_column(Enum(UserRoleEnum), default=UserRoleEnum.TECHNICIAN)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    
    # Status tracking
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company: Mapped["Company"] = relationship("Company")

    __table_args__ = (
        Index('idx_invitation_company', 'company_id'),
        Index('idx_invitation_email', 'email'),
        Index('idx_invitation_expires', 'expires_at'),
    )

    def __repr__(self):
        return f"<UserInvitation(id={self.id}, email={self.email}, company_id={self.company_id})>"