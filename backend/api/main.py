"""
FastAPI Backend for Workshop Management System

This module provides RESTful API endpoints for:
- Authentication (JWT)
- Customers Management
- Vehicles Management
- Jobs/Work Orders
- Inventory/Parts
- Invoices & Quotes
- EV Fleet & Battery RUL Predictions
- Analytics & Reporting
"""

from fastapi import FastAPI, HTTPException, Depends, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
import os
import hashlib
import hmac
import secrets
import asyncio
import time
import logging
from pathlib import Path
import sys
from fastapi import WebSocket, WebSocketDisconnect, Response
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.ev_rul_model import get_model, EVBatteryRULModel

# Voice router
from api.voice import router as voice_router

# PayFast payment service
from api.payfast import payfast_service

# Email and SMS services
from services.email_service import email_service
from services.sms_service import sms_service
from services.messaging_service import MessagingService, MessagingTemplates, init_messaging_service
from services.invitation_service import invitation_service

# Database imports (optional — falls back to in-memory if unavailable)
try:
    from sqlalchemy.orm import Session
    from db.database import get_db, get_db_context, engine, SessionLocal
    from db.models import (
        Base, Customer as DBCustomer, Vehicle as DBVehicle,
        Job as DBJob, Part as DBPart, Invoice as DBInvoice, User as DBUser,
        InvoiceItem as DBInvoiceItem, PaymentTransaction as DBPaymentTransaction,
        Company as DBCompany, MessageLog as DBMessageLog, UserInvitation as DBUserInvitation,
        DiagnosticRecord as DBDiagnostic, EVBatteryRUL as DBEVBatteryRUL,
    )
    # Use SQLite fallback if PostgreSQL not available
    DB_URL = os.getenv("DATABASE_URL", "")
    if not DB_URL or "postgresql" not in DB_URL:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        sqlite_engine = create_engine("sqlite:///./workshop.db", echo=False)
        Base.metadata.create_all(bind=sqlite_engine)
        SessionLocal = sessionmaker(bind=sqlite_engine)
        def get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()
    else:
        Base.metadata.create_all(bind=engine)
    DB_AVAILABLE = True
except Exception as e:
    print(f"Database not available, using in-memory store: {e}")
    DB_AVAILABLE = False

# =============================================================================
# App Configuration
# =============================================================================

app = FastAPI(
    title="Workshop Management System API",
    description="RESTful API for managing automotive workshop operations",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://workshop-d1832.web.app",
        "https://workshop-d1832.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Security Constants
ACCESS_TOKEN_EXPIRE_HOURS = 24
RATE_LIMIT_REQUESTS = 100  # requests per window
RATE_LIMIT_WINDOW = 60      # seconds
_rate_limit_store: Dict[str, List[float]] = {}

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Only rate limit auth endpoints for now
    if request.url.path == "/api/auth/token":
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean up old entries
        _rate_limit_store[client_ip] = [t for t in _rate_limit_store.get(client_ip, []) if now - t < RATE_LIMIT_WINDOW]
        
        if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
            return Response(content="Rate limit exceeded", status_code=429)
        
        _rate_limit_store[client_ip].append(now)
        
    return await call_next(request)

# OAuth2 for JWT authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


# =============================================================================
# WebSocket Connection Manager
# =============================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def broadcast(self, message: dict, company_id: Optional[str] = None):
        """Broadcast to all users or all users in a company."""
        # Note: In a real app, we'd filter connections by company_id
        # For now, we'll just broadcast to everyone if company_id is None
        # or implement a simple mapping.
        for user_id, connections in self.active_connections.items():
            # In a full implementation, we'd check user's company membership
            for connection in connections:
                await connection.send_json(message)

manager = ConnectionManager()


# =============================================================================
# Enums
# =============================================================================

class UserRole(str, Enum):
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    TECHNICIAN = "TECHNICIAN"
    RECEPTIONIST = "RECEPTIONIST"


class JobStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    AWAITING_PARTS = "Awaiting Parts"
    AWAITING_APPROVAL = "Awaiting Approval"
    COMPLETED = "Completed"
    INVOICED = "Invoiced"
    PAID = "Paid"
    CANCELLED = "Cancelled"


class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    URGENT = "Urgent"


class InvoiceStatus(str, Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    PAID = "Paid"
    OVERDUE = "Overdue"
    CANCELLED = "Cancelled"


# =============================================================================
# Pydantic Models (Schemas)
# =============================================================================

# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# --- Companies ---
class CompanyBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    industry: Optional[str] = None
    subscription: str = "free"
    max_users: int = 5
    is_active: bool = True


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = None
    subscription: Optional[str] = None
    max_users: Optional[int] = None
    is_active: Optional[bool] = None


class CompanyResponse(CompanyBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Users ---

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.TECHNICIAN


class UserCreate(UserBase):
    password: str
    company_id: str  # every user must belong to a company


class UserResponse(UserBase):
    id: str
    created_at: datetime
    company_id: str  # always present

    class Config:
        from_attributes = True


# --- User Invitations ---
class UserInvitationBase(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.TECHNICIAN


class UserInvitationCreate(UserInvitationBase):
    pass


class UserInvitationResponse(UserInvitationBase):
    id: str
    company_id: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AcceptInvitationRequest(BaseModel):
    token: str
    name: str
    password: str


class AcceptInvitationResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None


class PendingInvitationItem(BaseModel):
    id: str
    email: str
    role: str
    created_at: str
    expires_at: str
    is_expired: bool


class PendingInvitationsResponse(BaseModel):
    invitations: List[PendingInvitationItem]
    total: int


# --- Customers ---
class CustomerBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    customer_type: str = "Private"
    consent: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CustomerResponse(CustomerBase):
    id: str
    created_at: datetime
    company_id: str
    vehicle_count: int = 0

    class Config:
        from_attributes = True


# --- Vehicles ---
class VehicleBase(BaseModel):
    owner_id: str
    registration: str
    vin: str
    make: str
    model: str
    year: int
    color: str
    fuel_type: str
    mileage: int = 0


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    registration: Optional[str] = None
    mileage: Optional[int] = None
    color: Optional[str] = None


class VehicleResponse(VehicleBase):
    id: str
    created_at: datetime
    company_id: str
    owner_name: Optional[str] = None

    class Config:
        from_attributes = True


# --- Jobs ---
class JobTask(BaseModel):
    id: str
    description: str
    completed: bool = False


class JobPartUpdate(BaseModel):
    quantity: Optional[int] = None
    unitCost: Optional[float] = None
    name: Optional[str] = None


class JobBase(BaseModel):
    customer_id: str
    vehicle_id: str
    service_type: str
    description: str
    priority: Priority = Priority.MEDIUM
    estimated_cost: float = 0
    estimated_hours: float = 0
    due_date: datetime


class JobCreate(JobBase):
    tasks: List[JobTask] = []


class JobUpdate(BaseModel):
    status: Optional[JobStatus] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    estimated_cost: Optional[float] = None
    estimated_hours: Optional[float] = None
    started_at: Optional[datetime] = None


class JobResponse(JobBase):
    id: str
    company_id: str
    status: JobStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    tasks: List[JobTask] = []
    customer_name: Optional[str] = None
    vehicle_info: Optional[str] = None
    actual_hours: float = 0
    time_variance: float = 0

    class Config:
        from_attributes = True


# --- Parts ---
class PartBase(BaseModel):
    name: str
    sku: str
    category: str
    quantity: int
    min_level: int
    cost_price: float
    selling_price: float
    location: str
    supplier: str


class PartCreate(PartBase):
    pass


class PartUpdate(BaseModel):
    quantity: Optional[int] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None


class PartResponse(PartBase):
    id: str
    is_low_stock: bool

    class Config:
        from_attributes = True


# --- Invoices ---
class InvoiceItem(BaseModel):
    id: str
    description: str
    quantity: int
    unit_price: float
    total: float


class InvoiceItemCreate(BaseModel):
    description: str
    quantity: int
    unit_price: float


class InvoiceItemUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[float] = None


class InvoiceBase(BaseModel):
    type: str = "Invoice"  # Invoice or Quote
    customer_id: str
    vehicle_id: Optional[str] = None
    job_id: Optional[str] = None
    items: List[InvoiceItem] = []


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceResponse(InvoiceBase):
    id: str
    company_id: str
    number: str
    issue_date: datetime
    due_date: datetime
    subtotal: float
    tax_amount: float
    total: float
    status: InvoiceStatus

    class Config:
        from_attributes = True


class BatchInvoiceRequest(BaseModel):
    invoices: List[InvoiceCreate]


# --- Payments ---
class PaymentCreateRequest(BaseModel):
    invoice_id: str
    return_url: str = ""
    cancel_url: str = ""
    notify_url: str = ""


class PaymentRetryRequest(BaseModel):
    payment_id: str


class PaymentNotifyRequest(BaseModel):
    m_payment_id: str
    pf_payment_id: str
    pf_amount: str
    pf_payment_status: str
    pf_signature: str
    reference: Optional[str] = None
    reason_code: Optional[str] = None
    amount_gross: Optional[str] = None
    amount_fee: Optional[str] = None
    amount_net: Optional[str] = None
    custom_str1: Optional[str] = None
    custom_str2: Optional[str] = None
    payment_method: Optional[str] = None
    email_address: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    payment_id: str
    pf_payment_id: Optional[str]
    amount:float
    status: str
    initiated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class PaymentVerifyResponse(BaseModel):
    invoice_id: str
    status: str
    amount: float
    payment_id: str
    pf_payment_id: Optional[str]
    completed_at: Optional[datetime]


# --- Appointments ---
class AppointmentBase(BaseModel):
    title: str
    appointment_type: str
    start_time: datetime
    end_time: datetime
    customer_id: str
    vehicle_id: Optional[str] = None
    assigned_to: Optional[str] = None
    status: str = "scheduled"
    recurrence: str = "None"
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    appointment_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    recurrence: Optional[str] = None
    notes: Optional[str] = None


class AppointmentResponse(AppointmentBase):
    id: str
    company_id: str
    created_at: datetime
    updated_at: datetime
    reminder_sent: bool

    class Config:
        from_attributes = True


# --- Warranties ---
class WarrantyBase(BaseModel):
    job_id: str
    vehicle_id: str
    warranty_type: str
    expiry_date: datetime
    coverage_description: Optional[str] = None


# --- Analytics ---
class TechnicianPerformance(BaseModel):
    technician_id: str
    technician_name: str
    jobs_completed: int
    avg_time_per_job: float  # hours
    revenue_generated: float
    utilization_rate: float  # percentage
    quality_score: float  # percentage (1 - warranty_claims/total_jobs)
    warranty_claims: int

class TechnicianJobAnalytics(BaseModel):
    job_id: str
    job_number: str
    service_type: str
    status: str
    hours_logged: float
    revenue: float
    completed_at: Optional[datetime]

class TechnicianRevenueAnalytics(BaseModel):
    technician_id: str
    total_revenue: float
    labor_revenue: float
    parts_revenue: float
    period: str  # e.g., "Monthly", "Weekly"


class TimeAccuracyMetric(BaseModel):
    service_type: str
    avg_estimated_hours: float
    avg_actual_hours: float
    avg_variance: float
    accuracy_percentage: float
    job_count: int


class TimeTrackingAnalytics(BaseModel):
    overall_accuracy: float
    metrics_by_service: List[TimeAccuracyMetric]
    top_bottlenecks: List[Dict[str, Any]]


# --- EV Fleet ---
class EVBatteryData(BaseModel):
    current_soh: float = Field(..., ge=0, le=100, description="State of Health %")
    cycle_count: int = Field(..., ge=0, description="Charge cycle count")
    avg_temperature: float = Field(default=25, description="Avg operating temp °C")
    fast_charge_ratio: float = Field(default=0, ge=0, le=1, description="Fast charge ratio")
    age_months: int = Field(default=12, ge=0, description="Battery age in months")
    avg_dod: float = Field(default=50, ge=0, le=100, description="Avg depth of discharge")
    capacity_kwh: float = Field(default=60, description="Battery capacity kWh")
    ambient_temp_avg: float = Field(default=22, description="Avg ambient temp °C")


class DiagnosticBase(BaseModel):
    vehicle_id: str
    symptoms: Optional[str] = None
    dtc_codes: List[str] = []
    battery_telemetry: Optional[EVBatteryData] = None

class DiagnosticCreate(DiagnosticBase):
    pass

class DiagnosticResponse(DiagnosticBase):
    id: str
    ai_analysis: Optional[str] = None
    recorded_at: datetime

    class Config:
        from_attributes = True


class RULPrediction(BaseModel):
    rul_months: float
    rul_cycles: int
    confidence: float
    health_status: str
    current_soh: float
    eol_threshold: float
    recommendations: List[str]


class BatteryHealthResponse(BaseModel):
    current: Optional[RULPrediction] = None
    history: List[RULPrediction] = []


class WarrantyCreate(WarrantyBase):
    pass


class WarrantyUpdate(BaseModel):
    warranty_type: Optional[str] = None
    expiry_date: Optional[datetime] = None
    coverage_description: Optional[str] = None


class WarrantyResponse(WarrantyBase):
    id: str
    company_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Job Attachments ---
class JobAttachmentBase(BaseModel):
    filename: str
    file_type: str
    file_size: int
    file_url: str
    description: Optional[str] = None


class JobAttachmentCreate(BaseModel):
    filename: str
    file_type: str
    file_size: int
    file_url: str
    description: Optional[str] = None


class JobAttachmentResponse(JobAttachmentBase):
    id: str
    company_id: str
    job_id: str
    file_url: str
    uploaded_by: Optional[str] = None
    upload_date: datetime

    class Config:
        from_attributes = True


# --- Labor Entries ---
class LaborEntryBase(BaseModel):
    job_id: str
    description: str
    hours: float
    rate_per_hour: float
    technician_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class LaborEntryCreate(LaborEntryBase):
    pass


class LaborEntryUpdate(BaseModel):
    description: Optional[str] = None
    hours: Optional[float] = None
    rate_per_hour: Optional[float] = None
    technician_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class LaborEntryResponse(LaborEntryBase):
    id: str
    company_id: str
    created_at: datetime
    updated_at: datetime
    total: float

    class Config:
        from_attributes = True


# --- Mileage Records ---
class MileageRecordBase(BaseModel):
    vehicle_id: str
    mileage: int
    source: str


class MileageRecordCreate(MileageRecordBase):
    pass


class MileageRecordResponse(MileageRecordBase):
    id: str
    company_id: str
    recorded_at: datetime

    class Config:
        from_attributes = True






# --- Analytics ---
class DashboardStats(BaseModel):
    total_jobs: int
    pending_jobs: int
    in_progress_jobs: int
    completed_jobs: int
    total_revenue: float
    total_customers: int
    total_vehicles: int
    low_stock_count: int


class InvoiceAgeGroup(BaseModel):
    """Age group for invoice aging report."""
    label: str  # e.g., "0-30 days", "31-60 days"
    min_days: int
    max_days: int
    count: int
    total_amount: float


class InvoiceAgingReport(BaseModel):
    """Invoice aging report showing overdue invoice analysis."""
    generated_at: datetime
    total_overdue_amount: float
    total_overdue_count: int
    age_groups: List[InvoiceAgeGroup]
    invoices: List[Dict[str, Any]]  # Detailed invoices list



# --- Audit Logging ---
class AuditLogEntry(BaseModel):
    """A single audit log record."""
    id: str
    company_id: str
    user_id: str
    user_name: Optional[str] = None
    action: str          # create | update | delete | login | logout | permission_change
    resource_type: str   # job | invoice | customer | user | company | etc.
    resource_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None   # before / after values
    ip_address: Optional[str] = None
    timestamp: datetime


class AuditLogCreate(BaseModel):
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None


# =============================================================================
# In-Memory Data Store (Fallback when DB not available)
# =============================================================================

_companies: Dict[str, dict] = {}
_users: Dict[str, dict] = {}
_customers: Dict[str, dict] = {}
_vehicles: Dict[str, dict] = {}
_jobs: Dict[str, dict] = {}
_parts: Dict[str, dict] = {}
_invoices: Dict[str, dict] = {}
_appointments: Dict[str, Dict[str, dict]] = {}  # Nested by company_id
_warranties: Dict[str, Dict[str, dict]] = {}  # Nested by company_id
_attachments: Dict[str, Dict[str, dict]] = {}  # Nested by company_id
_labor_entries: Dict[str, Dict[str, dict]] = {}  # Nested by company_id
_mileage_records: Dict[str, Dict[str, dict]] = {}  # Nested by company_id
_invoice_items: Dict[str, Dict[str, dict]] = {}  # Nested by company_id
_diagnostics: Dict[str, dict] = {}
_battery_health: Dict[str, List[dict]] = {}
_audit_logs: List[dict] = []   # Flat list — newest first (prepend on write)
_portal_tokens: Dict[str, dict] = {}  # token -> { customer_id, expires_at, customer, jobs, invoices, vehicles, appointments }


# =============================================================================
# SQLite Persistence Layer
# Source of Truth: SQLite database (workshop_store.db)
# In-memory dicts are the runtime cache; they are loaded from SQLite on startup
# and saved back periodically and on shutdown.
# =============================================================================

import sqlite3
import json
import asyncio
import threading

PERSIST_DB = os.getenv("PERSIST_DB", str(Path(__file__).parent.parent / "workshop_store.db"))


def _open_persist_db() -> sqlite3.Connection:
    conn = sqlite3.connect(PERSIST_DB, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # safe concurrent reads
    conn.execute("""
        CREATE TABLE IF NOT EXISTS kv_store (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (namespace, key)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS list_store (
            namespace TEXT NOT NULL,
            position INTEGER NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (namespace, position)
        )
    """)
    conn.commit()
    return conn


_persist_conn: Optional[sqlite3.Connection] = None

def _get_persist_conn() -> Optional[sqlite3.Connection]:
    return _persist_conn


def _load_namespace_dict(conn: sqlite3.Connection, namespace: str) -> Dict[str, dict]:
    """Load a flat namespace from kv_store into a dict."""
    rows = conn.execute("SELECT key, value FROM kv_store WHERE namespace = ?", (namespace,)).fetchall()
    result: Dict[str, dict] = {}
    for row in rows:
        try:
            result[row["key"]] = json.loads(row["value"])
        except Exception:
            pass
    return result


def _load_namespace_nested(conn: sqlite3.Connection, namespace: str) -> Dict[str, Dict[str, dict]]:
    """Load a nested namespace (key = 'outer_key/inner_key') from kv_store."""
    rows = conn.execute("SELECT key, value FROM kv_store WHERE namespace = ?", (namespace,)).fetchall()
    result: Dict[str, Dict[str, dict]] = {}
    for row in rows:
        try:
            parts = row["key"].split("/", 1)
            if len(parts) == 2:
                outer, inner = parts
                result.setdefault(outer, {})[inner] = json.loads(row["value"])
        except Exception:
            pass
    return result


def _load_namespace_list(conn: sqlite3.Connection, namespace: str) -> List[dict]:
    """Load an ordered list namespace from list_store."""
    rows = conn.execute(
        "SELECT value FROM list_store WHERE namespace = ? ORDER BY position",
        (namespace,),
    ).fetchall()
    result = []
    for row in rows:
        try:
            result.append(json.loads(row["value"]))
        except Exception:
            pass
    return result


def _save_namespace_dict(conn: sqlite3.Connection, namespace: str, data: Dict[str, dict]) -> None:
    conn.execute("DELETE FROM kv_store WHERE namespace = ?", (namespace,))
    for key, value in data.items():
        try:
            conn.execute(
                "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES (?, ?, ?)",
                (namespace, key, json.dumps(value, default=str)),
            )
        except Exception:
            pass
    conn.commit()


def _save_namespace_nested(conn: sqlite3.Connection, namespace: str, data: Dict[str, Dict[str, dict]]) -> None:
    conn.execute("DELETE FROM kv_store WHERE namespace = ?", (namespace,))
    for outer, inner_dict in data.items():
        for inner, value in inner_dict.items():
            try:
                conn.execute(
                    "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES (?, ?, ?)",
                    (namespace, f"{outer}/{inner}", json.dumps(value, default=str)),
                )
            except Exception:
                pass
    conn.commit()


def _save_namespace_list(conn: sqlite3.Connection, namespace: str, data: List[dict]) -> None:
    conn.execute("DELETE FROM list_store WHERE namespace = ?", (namespace,))
    for i, item in enumerate(data):
        try:
            conn.execute(
                "INSERT OR REPLACE INTO list_store (namespace, position, value) VALUES (?, ?, ?)",
                (namespace, i, json.dumps(item, default=str)),
            )
        except Exception:
            pass
    conn.commit()


def load_all_from_db(conn: sqlite3.Connection) -> None:
    """Load all persisted data into the in-memory store on startup."""
    global _companies, _users, _customers, _vehicles, _jobs, _parts
    global _invoices, _appointments, _warranties, _attachments
    global _labor_entries, _mileage_records, _invoice_items, _diagnostics
    global _battery_health, _audit_logs, _portal_tokens
    logger.info(f"Loading persisted data from {PERSIST_DB}")
    _companies      = _load_namespace_dict(conn, "companies") or _companies
    _users          = _load_namespace_dict(conn, "users") or _users
    _customers      = _load_namespace_dict(conn, "customers") or _customers
    _vehicles       = _load_namespace_dict(conn, "vehicles") or _vehicles
    _jobs           = _load_namespace_dict(conn, "jobs") or _jobs
    _parts          = _load_namespace_dict(conn, "parts") or _parts
    _invoices       = _load_namespace_dict(conn, "invoices") or _invoices
    _diagnostics    = _load_namespace_dict(conn, "diagnostics") or _diagnostics
    _appointments   = _load_namespace_nested(conn, "appointments") or _appointments
    _warranties     = _load_namespace_nested(conn, "warranties") or _warranties
    _attachments    = _load_namespace_nested(conn, "attachments") or _attachments
    _labor_entries  = _load_namespace_nested(conn, "labor_entries") or _labor_entries
    _mileage_records = _load_namespace_nested(conn, "mileage_records") or _mileage_records
    _invoice_items  = _load_namespace_nested(conn, "invoice_items") or _invoice_items
    _battery_health = _load_namespace_dict(conn, "battery_health") or _battery_health  # type: ignore
    _audit_logs     = _load_namespace_list(conn, "audit_logs") or _audit_logs
    _portal_tokens  = _load_namespace_dict(conn, "portal_tokens") or _portal_tokens
    total = (len(_companies) + len(_users) + len(_customers) + len(_vehicles) +
             len(_jobs) + len(_parts) + len(_invoices))
    logger.info(f"Loaded {total} core records from SQLite persistence store")


def save_all_to_db(conn: sqlite3.Connection) -> None:
    """Flush all in-memory data to SQLite."""
    try:
        _save_namespace_dict(conn, "companies",    _companies)
        _save_namespace_dict(conn, "users",        _users)
        _save_namespace_dict(conn, "customers",    _customers)
        _save_namespace_dict(conn, "vehicles",     _vehicles)
        _save_namespace_dict(conn, "jobs",         _jobs)
        _save_namespace_dict(conn, "parts",        _parts)
        _save_namespace_dict(conn, "invoices",     _invoices)
        _save_namespace_dict(conn, "diagnostics",  _diagnostics)
        _save_namespace_nested(conn, "appointments",   _appointments)
        _save_namespace_nested(conn, "warranties",     _warranties)
        _save_namespace_nested(conn, "attachments",    _attachments)
        _save_namespace_nested(conn, "labor_entries",  _labor_entries)
        _save_namespace_nested(conn, "mileage_records", _mileage_records)
        _save_namespace_nested(conn, "invoice_items",  _invoice_items)
        _save_namespace_dict(conn, "battery_health",   _battery_health)  # type: ignore
        _save_namespace_list(conn, "audit_logs",       _audit_logs)
        _save_namespace_dict(conn, "portal_tokens",     _portal_tokens)
        logger.debug("In-memory store flushed to SQLite")
    except Exception as e:
        logger.error(f"Failed to persist in-memory store: {e}")


_autosave_stop = threading.Event()

def _autosave_worker(interval: int = 60) -> None:
    """Background thread: flush store to SQLite every `interval` seconds."""
    while not _autosave_stop.wait(timeout=interval):
        conn = _get_persist_conn()
        if conn:
            save_all_to_db(conn)


# =============================================================================
# Application Lifespan (startup / shutdown persistence hooks)
# =============================================================================

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app_instance):
    """Load data on startup, save data on shutdown."""
    global _persist_conn
    _persist_conn = _open_persist_db()
    load_all_from_db(_persist_conn)
    # Start background autosave thread
    t = threading.Thread(target=_autosave_worker, args=(60,), daemon=True, name="store-autosave")
    t.start()
    logger.info("Persistence layer initialized — SQLite is the primary store")
    yield
    # Shutdown: final flush
    _autosave_stop.set()
    save_all_to_db(_persist_conn)
    _persist_conn.close()
    logger.info("Persistence layer shut down — all data flushed to SQLite")


# Re-configure app with lifespan
app.router.lifespan_context = lifespan  # type: ignore[attr-defined]


# =============================================================================
# Real-Time Synchronization (WebSockets)
# =============================================================================

class ConnectionManager:
    def __init__(self):
        # connections grouped by company_id for efficient broadcasting
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, company_id: str):
        await websocket.accept()
        if company_id not in self.active_connections:
            self.active_connections[company_id] = []
        self.active_connections[company_id].append(websocket)

    def disconnect(self, websocket: WebSocket, company_id: str):
        if company_id in self.active_connections:
            try:
                self.active_connections[company_id].remove(websocket)
                if not self.active_connections[company_id]:
                    del self.active_connections[company_id]
            except ValueError:
                pass

    async def broadcast_to_company(self, company_id: str, message: dict):
        if company_id in self.active_connections:
            # Create a copy of the list to avoid "size changed during iteration" errors
            for connection in list(self.active_connections[company_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    # connection might be closed, it will be removed by the disconnect handler
                    pass

manager = ConnectionManager()


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for real-time updates, grouped by company."""
    try:
        # Simple token validation (userId:email:role:companyId:timestamp:sig)
        parts = token.split(":")
        if len(parts) != 6:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        user_id, email, role, company_id, ts, sig = parts
        payload = f"{user_id}:{email}:{role}:{company_id}:{ts}"
        
        # Verify signature
        expected_sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await manager.connect(websocket, company_id)
        logger.info(f"WebSocket connected: user={user_id}, company={company_id}")
        
        try:
            while True:
                # keep-alive (wait for client messages, though we primarily push)
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(websocket, company_id)
            logger.info(f"WebSocket disconnected: user={user_id}, company={company_id}")
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass



# =============================================================================
# Authentication Endpoints
# =============================================================================

@app.post("/api/auth/token", response_model=Token, tags=["Authentication"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return JWT token."""
    # Check in-memory store first
    user = None
    for u in _users.values():
        if u.get("email") == form_data.username:
            user = u
            break
    
    if user and user.get("password_hash"):
        if not verify_password(form_data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    elif not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    token = create_token(user["id"], user["email"], user["role"], user.get("company_id", ""))
    return Token(access_token=token, expires_in=3600)


@app.post("/api/auth/register", response_model=UserResponse, status_code=201, tags=["Authentication"])
async def register(user: UserCreate):
    """Register a new user."""
    # Check for duplicate email
    for u in _users.values():
        if u.get("email") == user.email:
            raise HTTPException(status_code=409, detail="Email already registered")

    # Enforce subscription user limit (in-memory auth path)
    if user.company_id:
        _enforce_user_limit_for_create(user.company_id, db=None)
    
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "company_id": user.company_id,
        "password_hash": hash_password(user.password),
        "created_at": datetime.now(),
    }
    _users[user_id] = user_data
    return UserResponse(**{k: v for k, v in user_data.items() if k != "password_hash"})


@app.get("/api/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current authenticated user by decoding and VERIFYING our token."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # token format: userId|email|role|companyId|timestamp|signature
    parts = token.split("|")
    if len(parts) < 6:
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    user_id, email, role, company_id, timestamp, signature = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
    
    # Verify Signature
    payload = f"{user_id}|{email}|{role}|{company_id}|{timestamp}"
    expected_sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    
    if not hmac.compare_digest(signature, expected_sig):
        logger.warning(f"Invalid token signature attempt: user={user_id}, email={email}")
        raise HTTPException(status_code=401, detail="Invalid token signature")
    
    # Verify Expiration
    try:
        token_time = datetime.fromisoformat(timestamp)
        if datetime.utcnow() - token_time > timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS):
            raise HTTPException(status_code=401, detail="Token expired")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token timestamp")
        
    return UserResponse(
        id=user_id,
        email=email,
        name="",  # name not in token for brevity
        role=role,
        company_id=company_id,
        created_at=token_time,
    )


# Quick persistence endpoint — can be called to force a manual save
@app.post("/api/admin/persist-now", tags=["System Admin"])
async def force_persist(current_user: UserResponse = Depends(get_current_user)):
    """[SYSTEM_ADMIN] Manually flush the in-memory store to SQLite immediately."""
    _require_system_admin(current_user)
    conn = _get_persist_conn()
    if not conn:
        raise HTTPException(status_code=503, detail="Persistence layer not initialized")
    save_all_to_db(conn)
    return {"message": "In-memory store flushed to SQLite successfully", "timestamp": datetime.utcnow().isoformat()}


# JWT Secret (generate per-instance if not configured)
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

def _get_company_max_users(company_id: str, db: Optional["Session"] = None) -> int:
    """Return max_users for a company, defaulting to 5."""
    try:
        if DB_AVAILABLE and db:
            company = db.query(DBCompany).filter(DBCompany.id == company_id).first()
            if company and getattr(company, "max_users", None):
                return int(company.max_users)
    except Exception:
        pass
    try:
        company = _companies.get(company_id) or {}
        return int(company.get("max_users") or company.get("maxUsers") or 5)
    except Exception:
        return 5


def _enforce_user_limit_for_invite(company_id: str, db: Optional["Session"] = None) -> None:
    """Enforce company max_users when creating a new invitation (counts pending invites)."""
    max_users = _get_company_max_users(company_id, db)

    # Count active users
    user_count = 0
    pending_invites = 0
    try:
        if DB_AVAILABLE and db:
            user_count = db.query(DBUser).filter(DBUser.company_id == company_id).count()
            pending_invites = db.query(DBUserInvitation).filter(
                DBUserInvitation.company_id == company_id,
                DBUserInvitation.accepted_at == None,
                DBUserInvitation.expires_at > datetime.utcnow(),
            ).count()
        else:
            user_count = len([u for u in _users.values() if u.get("company_id") == company_id])
            # in-memory invitations are DB-backed in this app; assume 0 if DB not available
            pending_invites = 0
    except Exception:
        pass

    if (user_count + pending_invites + 1) > max_users:
        raise HTTPException(
            status_code=403,
            detail=f"User limit reached for this subscription tier (max {max_users}). Cancel an invite or upgrade your plan.",
        )


def _enforce_user_limit_for_create(company_id: str, db: Optional["Session"] = None) -> None:
    """Enforce company max_users when creating a new user account."""
    max_users = _get_company_max_users(company_id, db)
    user_count = 0
    try:
        if DB_AVAILABLE and db:
            user_count = db.query(DBUser).filter(DBUser.company_id == company_id).count()
        else:
            user_count = len([u for u in _users.values() if u.get("company_id") == company_id])
    except Exception:
        pass

    if (user_count + 1) > max_users:
        raise HTTPException(
            status_code=403,
            detail=f"User limit reached for this subscription tier (max {max_users}). Upgrade your plan to add more users.",
        )

def create_token(user_id: str, email: str, role: str, company_id: str) -> str:
    """Create a simple HMAC-based token."""
    # token payload: userId|email|role|companyId|timestamp
    payload = f"{user_id}|{email}|{role}|{company_id}|{datetime.utcnow().isoformat()}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}|{sig}"

def hash_password(password: str) -> str:
    """Hash a password with salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored: str) -> bool:
    """Verify a password against stored hash."""
    salt, hashed = stored.split(':')
    check = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return hmac.compare_digest(hashed, check)




# =============================================================================
# Companies Endpoints
# =============================================================================

@app.get("/api/companies", response_model=List[CompanyResponse], tags=["Companies"])
async def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List all companies for signup/onboarding."""
    companies = [c for c in _companies.values() if c.get("is_active")]
    return [CompanyResponse(**c) for c in companies[skip:skip+limit]]


@app.post("/api/companies", response_model=CompanyResponse, status_code=201, tags=["Companies"])
async def create_company(company: CompanyCreate):
    """Create a new company (public endpoint for registration)."""
    # Check for duplicate email
    for c in _companies.values():
        if c.get("email") == company.email:
            raise HTTPException(status_code=409, detail="Company email already registered")
    
    company_id = str(uuid.uuid4())
    company_data = {
        "id": company_id,
        **company.model_dump(),
        "created_at": datetime.now(),
        "is_active": True,
    }
    _companies[company_id] = company_data
    return CompanyResponse(**company_data)


@app.get("/api/companies/{company_id}", response_model=CompanyResponse, tags=["Companies"])
async def get_company(company_id: str):
    """Get a specific company by ID."""
    if company_id not in _companies:
        raise HTTPException(status_code=404, detail="Company not found")
    company = _companies[company_id]
    if not company.get("is_active"):
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyResponse(**company)


@app.patch("/api/companies/{company_id}", response_model=CompanyResponse, tags=["Companies"])
async def update_company(
    company_id: str, 
    update: CompanyUpdate, 
    current_user: UserResponse = Depends(get_current_user)
):
    """Update a company (current user must belong to it)."""
    if company_id not in _companies:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this company")
    
    company = _companies[company_id]
    update_data = update.model_dump(exclude_unset=True)
    company.update(update_data)
    company["updated_at"] = datetime.now()
    
    return CompanyResponse(**company)


@app.delete("/api/companies/{company_id}", status_code=204, tags=["Companies"])
async def delete_company(
    company_id: str, 
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete a company (current user must belong to it)."""
    if company_id not in _companies:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this company")
    
    del _companies[company_id]


# =============================================================================
# Audit Log Helper
# =============================================================================

def log_audit_event(
    company_id: str,
    user_id: str,
    user_name: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Create and persist an audit log entry."""
    entry = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "changes": changes,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow().isoformat(),
    }
    _audit_logs.insert(0, entry)  # newest-first
    if len(_audit_logs) > 5000:   # cap memory usage
        _audit_logs.pop()
    return entry


# =============================================================================
# System Admin Endpoints (SYSTEM_ADMIN role required)
# =============================================================================

def _require_system_admin(current_user: UserResponse):
    """Raise 403 if the caller is not a SYSTEM_ADMIN."""
    if current_user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status_code=403, detail="System administrator access required")


@app.get("/api/admin/companies", tags=["System Admin"])
async def admin_list_all_companies(
    search: Optional[str] = None,
    subscription: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: UserResponse = Depends(get_current_user),
):
    """[SYSTEM_ADMIN] List all companies with optional filters."""
    _require_system_admin(current_user)
    companies = list(_companies.values())
    if search:
        companies = [c for c in companies if search.lower() in c.get("name", "").lower() or search.lower() in c.get("email", "").lower()]
    if subscription:
        companies = [c for c in companies if c.get("subscription") == subscription]
    if is_active is not None:
        companies = [c for c in companies if c.get("is_active") == is_active]
    companies.sort(key=lambda c: c.get("created_at", ""), reverse=True)
    return {"total": len(companies), "companies": companies[skip:skip + limit]}


@app.get("/api/admin/companies/{company_id}/usage", tags=["System Admin"])
async def admin_company_usage(
    company_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """[SYSTEM_ADMIN] Usage statistics for a specific company."""
    _require_system_admin(current_user)
    if company_id not in _companies:
        raise HTTPException(status_code=404, detail="Company not found")
    company = _companies[company_id]
    users = [u for u in _users.values() if u.get("company_id") == company_id]
    jobs = [j for j in _jobs.values() if j.get("company_id") == company_id]
    customers = [c for c in _customers.values() if c.get("company_id") == company_id]
    invoices = [i for i in _invoices.values() if i.get("company_id") == company_id]
    parts = [p for p in _parts.values() if p.get("company_id") == company_id]
    paid_invoices = [i for i in invoices if i.get("status") == "Paid"]
    total_revenue = sum(float(i.get("total", 0)) for i in paid_invoices)
    return {
        "companyId": company_id,
        "companyName": company.get("name"),
        "subscription": company.get("subscription"),
        "isActive": company.get("is_active"),
        "createdAt": company.get("created_at", ""),
        "stats": {
            "users": len(users),
            "maxUsers": company.get("max_users", 5),
            "customers": len(customers),
            "jobs": len(jobs),
            "invoices": len(invoices),
            "paidInvoices": len(paid_invoices),
            "parts": len(parts),
            "totalRevenue": round(total_revenue, 2),
        },
    }


@app.get("/api/admin/dashboard", tags=["System Admin"])
async def admin_dashboard(current_user: UserResponse = Depends(get_current_user)):
    """[SYSTEM_ADMIN] System-wide summary dashboard."""
    _require_system_admin(current_user)
    total_companies = len(_companies)
    active_companies = sum(1 for c in _companies.values() if c.get("is_active"))
    total_users = len(_users)
    total_jobs = len(_jobs)
    total_invoices = len(_invoices)
    paid_invoices = [i for i in _invoices.values() if i.get("status") == "Paid"]
    total_revenue = sum(float(i.get("total", 0)) for i in paid_invoices)
    subscription_breakdown: Dict[str, int] = {}
    for c in _companies.values():
        sub = c.get("subscription", "free")
        subscription_breakdown[sub] = subscription_breakdown.get(sub, 0) + 1
    return {
        "totalCompanies": total_companies,
        "activeCompanies": active_companies,
        "inactiveCompanies": total_companies - active_companies,
        "totalUsers": total_users,
        "totalJobs": total_jobs,
        "totalInvoices": total_invoices,
        "totalRevenue": round(total_revenue, 2),
        "subscriptionBreakdown": subscription_breakdown,
        "auditLogCount": len(_audit_logs),
    }


@app.post("/api/admin/companies/{company_id}/toggle-active", tags=["System Admin"])
async def admin_toggle_company_active(
    company_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """[SYSTEM_ADMIN] Activate or deactivate a company."""
    _require_system_admin(current_user)
    if company_id not in _companies:
        raise HTTPException(status_code=404, detail="Company not found")
    was_active = _companies[company_id].get("is_active", True)
    _companies[company_id]["is_active"] = not was_active
    action = "activate_company" if not was_active else "deactivate_company"
    log_audit_event(current_user.company_id, current_user.id, current_user.name,
                    action, "company", company_id,
                    {"before": {"is_active": was_active}, "after": {"is_active": not was_active}})
    return {"companyId": company_id, "isActive": not was_active}


@app.post("/api/admin/bulk-create-users", tags=["System Admin"])
async def admin_bulk_create_users(
    payload: Dict[str, Any],
    current_user: UserResponse = Depends(get_current_user),
):
    """[SYSTEM_ADMIN] Bulk-create users across one or more companies."""
    _require_system_admin(current_user)
    users_data: List[dict] = payload.get("users", [])
    if not users_data:
        raise HTTPException(status_code=400, detail="No users provided in payload")
    created = []
    errors = []
    for u in users_data:
        email = u.get("email", "")
        company_id = u.get("company_id", "")
        if not email or not company_id:
            errors.append({"email": email, "error": "Missing email or company_id"})
            continue
        try:
            _enforce_user_limit_for_create(company_id, db=None)
        except HTTPException as e:
            errors.append({"email": email, "error": e.detail})
            continue
        if any(x.get("email") == email for x in _users.values()):
            errors.append({"email": email, "error": "Email already registered"})
            continue
        uid = str(uuid.uuid4())
        raw_password = u.get("password", secrets.token_urlsafe(10))
        user_rec = {
            "id": uid,
            "email": email,
            "name": u.get("name", email.split("@")[0]),
            "role": u.get("role", UserRole.TECHNICIAN),
            "company_id": company_id,
            "password_hash": hash_password(raw_password),
            "created_at": datetime.utcnow().isoformat(),
        }
        _users[uid] = user_rec
        created.append({"id": uid, "email": email, "tempPassword": raw_password})
        log_audit_event(current_user.company_id, current_user.id, current_user.name,
                        "create", "user", uid, {"email": email, "company_id": company_id})
    return {"created": len(created), "errors": errors, "users": created}


@app.get("/api/admin/system-report", tags=["System Admin"])
async def admin_system_report(current_user: UserResponse = Depends(get_current_user)):
    """[SYSTEM_ADMIN] Detailed system-wide stats per company."""
    _require_system_admin(current_user)
    report = []
    for cid, company in _companies.items():
        users = [u for u in _users.values() if u.get("company_id") == cid]
        jobs = [j for j in _jobs.values() if j.get("company_id") == cid]
        invoices = [i for i in _invoices.values() if i.get("company_id") == cid]
        paid = [i for i in invoices if i.get("status") == "Paid"]
        revenue = sum(float(i.get("total", 0)) for i in paid)
        report.append({
            "companyId": cid,
            "name": company.get("name"),
            "subscription": company.get("subscription"),
            "isActive": company.get("is_active"),
            "users": len(users),
            "jobs": len(jobs),
            "invoices": len(invoices),
            "revenue": round(revenue, 2),
        })
    report.sort(key=lambda x: x["revenue"], reverse=True)
    return {"companies": report, "total": len(report)}


# =============================================================================
# Audit Logging Endpoints
# =============================================================================

@app.post("/api/audit-logs", response_model=AuditLogEntry, status_code=201, tags=["Audit"])
async def create_audit_log(
    entry: AuditLogCreate,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a manual audit log entry (e.g. from frontend)."""
    ip = request.client.host if request.client else None
    log = log_audit_event(
        current_user.company_id, current_user.id, current_user.name,
        entry.action, entry.resource_type, entry.resource_id,
        entry.changes, ip or entry.ip_address,
    )
    return AuditLogEntry(**log)


@app.get("/api/audit-logs", tags=["Audit"])
async def list_audit_logs(
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user),
):
    """List audit logs for the current company (or all if SYSTEM_ADMIN)."""
    logs = _audit_logs
    if current_user.role != UserRole.SYSTEM_ADMIN:
        logs = [l for l in logs if l.get("company_id") == current_user.company_id]
    if resource_type:
        logs = [l for l in logs if l.get("resource_type") == resource_type]
    if action:
        logs = [l for l in logs if l.get("action") == action]
    if user_id:
        logs = [l for l in logs if l.get("user_id") == user_id]
    return {
        "total": len(logs),
        "logs": logs[skip:skip + limit],
    }


@app.get("/api/audit-logs/{log_id}", tags=["Audit"])
async def get_audit_log(log_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a single audit log entry."""
    for log in _audit_logs:
        if log["id"] == log_id:
            if current_user.role != UserRole.SYSTEM_ADMIN and log.get("company_id") != current_user.company_id:
                raise HTTPException(status_code=403, detail="Access denied")
            return log
    raise HTTPException(status_code=404, detail="Audit log not found")


# =============================================================================
# Customers Endpoints
# =============================================================================

@app.get("/api/customers", response_model=List[CustomerResponse], tags=["Customers"])
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all customers with pagination."""
    # restrict to the user's company
    company_id = current_user.company_id
    customers = [c for c in _customers.values() if c.get("company_id") == company_id]
    if search:
        q = search.strip().lower()
        def _val(v: Any) -> str:
            return str(v or "").lower()
        customers = [
            c for c in customers
            if (
                q in _val(c.get("name")) or
                q in _val(c.get("email")) or
                q in _val(c.get("phone")) or
                q in _val(c.get("address")) or
                q in _val(c.get("notes"))
            )
        ]
    return [CustomerResponse(**c) for c in customers[skip:skip+limit]]


@app.post("/api/customers", response_model=CustomerResponse, status_code=201, tags=["Customers"])
async def create_customer(customer: CustomerCreate, current_user: UserResponse = Depends(get_current_user)):
    """Create a new customer belonging to the same company as the user."""
    customer_id = str(uuid.uuid4())
    customer_data = {
        "id": customer_id,
        **customer.model_dump(),
        "company_id": current_user.company_id,
        "created_at": datetime.now(),
        "vehicle_count": 0,
    }
    _customers[customer_id] = customer_data
    await manager.broadcast_to_company(current_user.company_id, {"event": "customer_created", "data": customer_data})
    return CustomerResponse(**customer_data)


@app.get("/api/customers/{customer_id}", response_model=CustomerResponse, tags=["Customers"])
async def get_customer(customer_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific customer by ID if it belongs to user's company."""
    cust = _customers.get(customer_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(**cust)


@app.patch("/api/customers/{customer_id}", response_model=CustomerResponse, tags=["Customers"])
async def update_customer(customer_id: str, update: CustomerUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a customer if it belongs to the user's company."""
    cust = _customers.get(customer_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = update.model_dump(exclude_unset=True)
    cust.update(update_data)
    return CustomerResponse(**cust)


@app.delete("/api/customers/{customer_id}", status_code=204, tags=["Customers"])
async def delete_customer(customer_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a customer if it belongs to user's company."""
    cust = _customers.get(customer_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    del _customers[customer_id]
    await manager.broadcast_to_company(current_user.company_id, {"event": "customer_deleted", "data": {"id": customer_id}})
    return


# =============================================================================
# Customer Portal (Public - token-based access)
# =============================================================================

class PortalTokenCreate(BaseModel):
    customer_id: str
    customer: Optional[dict] = None
    jobs: Optional[List[dict]] = None
    invoices: Optional[List[dict]] = None
    vehicles: Optional[List[dict]] = None
    appointments: Optional[List[dict]] = None


@app.post("/api/portal/token", tags=["Customer Portal"])
async def create_portal_token(
    body: PortalTokenCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a portal access token for a customer. Staff only."""
    cust = _customers.get(body.customer_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    payload = {
        "customer_id": body.customer_id,
        "expires_at": expires_at,
        "customer": body.customer or cust,
        "jobs": body.jobs or [j for j in _jobs.values() if j.get("customer_id") == body.customer_id],
        "invoices": body.invoices or [i for i in _invoices.values() if i.get("customer_id") == body.customer_id],
        "vehicles": body.vehicles or [v for v in _vehicles.values() if v.get("owner_id") == body.customer_id],
        "appointments": body.appointments or [
            a for company_appts in _appointments.values() for a in company_appts.values()
            if a.get("customer_id") == body.customer_id
        ],
    }
    _portal_tokens[token] = payload
    base_url = os.getenv("PORTAL_BASE_URL", "http://localhost:3000")
    return {"token": token, "url": f"{base_url}/#/portal?token={token}", "expires_at": expires_at}


@app.get("/api/portal/me", tags=["Customer Portal"])
async def portal_me(token: str = Query(...)):
    """Get customer portal data for a valid token. No auth required."""
    payload = _portal_tokens.get(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    expires_at = payload.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", ""))
            if exp_dt < datetime.now():
                del _portal_tokens[token]
                raise HTTPException(status_code=401, detail="Token expired")
        except (ValueError, TypeError):
            pass
    return payload


@app.post("/api/portal/accept-quote", tags=["Customer Portal"])
async def portal_accept_quote(
    invoice_id: str = Query(...),
    token: str = Query(...),
):
    """Accept a quote from the customer portal."""
    payload = _portal_tokens.get(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    customer_id = payload.get("customer_id")
    inv = _invoices.get(invoice_id)
    if not inv and payload.get("invoices"):
        inv = next((i for i in payload["invoices"] if i.get("id") == invoice_id), None)
    if not inv or inv.get("customer_id") != customer_id or inv.get("type") != "Quote":
        raise HTTPException(status_code=404, detail="Quote not found")
    if inv.get("status") not in ("Draft", "Sent"):
        raise HTTPException(status_code=400, detail="Quote not in acceptable state")
    inv["status"] = "Accepted"
    if invoice_id in _invoices:
        _invoices[invoice_id]["status"] = "Accepted"
    return {"success": True, "invoice_id": invoice_id}


@app.post("/api/portal/book-appointment", tags=["Customer Portal"])
async def portal_book_appointment(
    token: str = Query(...),
    title: str = Query(...),
    start: str = Query(...),
    end: str = Query(...),
    type: str = Query("Service"),
    vehicle_id: Optional[str] = Query(None),
):
    """Book an appointment from the customer portal."""
    payload = _portal_tokens.get(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    customer_id = payload.get("customer_id")
    cust = _customers.get(customer_id) or payload.get("customer")
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    company_id = cust.get("company_id", "") if isinstance(cust, dict) else ""
    if company_id not in _appointments:
        _appointments[company_id] = {}
    appt_id = f"APT-{uuid.uuid4().hex[:8]}"
    appt_data = {
        "id": appt_id,
        "title": title,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id or "",
        "start": start,
        "end": end,
        "type": type,
        "status": "Scheduled",
        "recurrence": "None",
    }
    _appointments[company_id][appt_id] = appt_data
    payload.setdefault("appointments", []).append(appt_data)
    return {"success": True, "appointment": appt_data}


@app.get("/api/portal/payment-url", tags=["Customer Portal"])
async def portal_payment_url(
    invoice_id: str = Query(...),
    token: str = Query(...),
):
    """Get PayFast payment URL for an invoice. No auth required."""
    payload = _portal_tokens.get(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    customer_id = payload.get("customer_id")
    inv = _invoices.get(invoice_id)
    if not inv or inv.get("customer_id") != customer_id or inv.get("type") != "Invoice":
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.get("status") == "Paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")
    cust = payload.get("customer") or _customers.get(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    base_url = os.getenv("PORTAL_BASE_URL", "http://localhost:3000")
    return_url = f"{base_url}/#/portal?token={token}&paid=1"
    cancel_url = f"{base_url}/#/portal?token={token}"
    notify_url = f"{os.getenv('API_BASE_URL', 'http://localhost:8000')}/api/payment/notify"
    url = payfast_service.generate_payment_url(
        invoice_id=invoice_id,
        invoice_number=inv.get("number", "INV"),
        amount=float(inv.get("total", 0)),
        customer_email=cust.get("email", ""),
        customer_name=cust.get("name", ""),
        description=f"Invoice {inv.get('number', '')}",
        return_url=return_url,
        cancel_url=cancel_url,
        notify_url=notify_url,
    )
    return {"url": url}


# =============================================================================
# Vehicles Endpoints
# =============================================================================

@app.get("/api/vehicles", response_model=List[VehicleResponse], tags=["Vehicles"])
async def list_vehicles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    owner_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all vehicles for the user's company with optional filtering by owner."""
    company_id = current_user.company_id
    vehicles = [v for v in _vehicles.values()
                if _customers.get(v.get("owner_id"), {}).get("company_id") == company_id]
    if owner_id:
        vehicles = [v for v in vehicles if v.get("owner_id") == owner_id]
    if search:
        q = search.strip().lower()
        def _val(v: Any) -> str:
            return str(v or "").lower()
        def _matches(v: dict) -> bool:
            owner = _customers.get(v.get("owner_id") or "") or {}
            return q in " ".join([
                _val(v.get("registration")),
                _val(v.get("vin")),
                _val(v.get("make")),
                _val(v.get("model")),
                _val(v.get("color")),
                _val(v.get("fuel_type") or v.get("fuelType")),
                _val(owner.get("name")),
                _val(owner.get("email")),
                _val(owner.get("phone")),
            ])
        vehicles = [v for v in vehicles if _matches(v)]
    return [VehicleResponse(**v) for v in vehicles[skip:skip+limit]]


@app.post("/api/vehicles", response_model=VehicleResponse, status_code=201, tags=["Vehicles"])
async def create_vehicle(vehicle: VehicleCreate, current_user: UserResponse = Depends(get_current_user)):
    """Create a new vehicle for a customer in the same company."""
    cust = _customers.get(vehicle.owner_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=400, detail="Owner does not belong to your company")
    vehicle_id = str(uuid.uuid4())
    vehicle_data = {
        "id": vehicle_id,
        **vehicle.model_dump(),
        "created_at": datetime.now(),
        "company_id": current_user.company_id,
    }
    _vehicles[vehicle_id] = vehicle_data
    return VehicleResponse(**vehicle_data)


@app.get("/api/vehicles/{vehicle_id}", response_model=VehicleResponse, tags=["Vehicles"])
async def get_vehicle(vehicle_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific vehicle by ID (ensuring it belongs to user's company)."""
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle = _vehicles[vehicle_id]
    owner = _customers.get(vehicle.get("owner_id"))
    if not owner or owner.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return VehicleResponse(**vehicle)


@app.patch("/api/vehicles/{vehicle_id}", response_model=VehicleResponse, tags=["Vehicles"])
async def update_vehicle(vehicle_id: str, update: VehicleUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a vehicle (company restricted)."""
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle = _vehicles[vehicle_id]
    owner = _customers.get(vehicle.get("owner_id"))
    if not owner or owner.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    update_data = update.model_dump(exclude_unset=True)
    vehicle.update(update_data)
    return VehicleResponse(**vehicle)


@app.delete("/api/vehicles/{vehicle_id}", status_code=204, tags=["Vehicles"])
async def delete_vehicle(vehicle_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a vehicle (company restricted)."""
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle = _vehicles[vehicle_id]
    owner = _customers.get(vehicle.get("owner_id"))
    if not owner or owner.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    del _vehicles[vehicle_id]


# =============================================================================
# Diagnostic & EV Battery Analysis Endpoints
# =============================================================================

@app.get("/api/diagnostics", response_model=List[DiagnosticResponse], tags=["Diagnostics"])
async def list_diagnostics(
    vehicle_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """List diagnostic records for the user's company."""
    company_id = current_user.company_id
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            query = db.query(DBDiagnostic).join(DBVehicle).filter(DBVehicle.company_id == company_id)
            if vehicle_id:
                query = query.filter(DBDiagnostic.vehicle_id == vehicle_id)
            records = query.order_by(DBDiagnostic.recorded_at.desc()).all()
            return [DiagnosticResponse.from_orm(r) for r in records]
    else:
        results = [d for d in _diagnostics.values() 
                   if _vehicles.get(d.get("vehicle_id"), {}).get("company_id") == company_id]
        if vehicle_id:
            results = [d for d in results if d.get("vehicle_id") == vehicle_id]
        return [DiagnosticResponse(**d) for d in results]


@app.post("/api/diagnostics", response_model=DiagnosticResponse, status_code=201, tags=["Diagnostics"])
async def create_diagnostic(
    record: DiagnosticCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create a new diagnostic record and trigger AI analysis."""
    company_id = current_user.company_id
    vehicle_id = record.vehicle_id
    
    # Verify vehicle exists and belongs to company
    vehicle = _vehicles.get(vehicle_id)
    if DB_AVAILABLE:
        with get_db_context() as db:
            db_vehicle = db.query(DBVehicle).filter(DBVehicle.id == vehicle_id, DBVehicle.company_id == company_id).first()
            if not db_vehicle:
                raise HTTPException(status_code=404, detail="Vehicle not found")
            vehicle = db_vehicle
    elif not vehicle or vehicle.get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    diagnostic_id = str(uuid.uuid4())
    ai_analysis = ""
    
    # If EV battery telemetry is provided, trigger RUL prediction
    if record.battery_telemetry:
        model = get_model()
        prediction = model.predict(record.battery_telemetry.model_dump())
        
        # Save RUL prediction to history
        if DB_AVAILABLE:
            with get_db_context() as db:
                db_rul = DBEVBatteryRUL(
                    id=str(uuid.uuid4()),
                    vehicle_id=vehicle_id,
                    diagnostic_id=diagnostic_id,
                    rul_months=prediction['rul_months'],
                    confidence=prediction['confidence'],
                    health_status=prediction['health_status'],
                    current_soh=prediction['current_soh'],
                    recommendations=prediction['recommendations']
                )
                db.add(db_rul)
                db.commit()
                # Update vehicle SOH
                db_vehicle = db.query(DBVehicle).filter(DBVehicle.id == vehicle_id).first()
                if db_vehicle:
                    db_vehicle.battery_soh = prediction['current_soh']
                    db.commit()
        else:
            if vehicle_id not in _battery_health:
                _battery_health[vehicle_id] = []
            _battery_health[vehicle_id].insert(0, prediction) # Insert at beginning for "current"
            if vehicle_id in _vehicles:
                _vehicles[vehicle_id]['battery_soh'] = prediction['current_soh']

    diagnostic_data = {
        "id": diagnostic_id,
        **record.model_dump(exclude={"battery_telemetry"}),
        "battery_telemetry": record.battery_telemetry.model_dump() if record.battery_telemetry else None,
        "ai_analysis": ai_analysis,
        "recorded_at": datetime.utcnow(),
    }
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            db_diag = DBDiagnostic(
                id=diagnostic_id,
                vehicle_id=vehicle_id,
                symptoms=record.symptoms,
                dtc_codes=record.dtc_codes,
                battery_telemetry=record.battery_telemetry.model_dump() if record.battery_telemetry else None,
                ai_analysis=ai_analysis
            )
            db.add(db_diag)
            db.commit()
    else:
        _diagnostics[diagnostic_id] = diagnostic_data
        
    return DiagnosticResponse(**diagnostic_data)


@app.get("/api/vehicles/{vehicle_id}/battery-health", response_model=BatteryHealthResponse, tags=["Diagnostics"])
async def get_battery_health(
    vehicle_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get the current battery health and prediction history for an EV."""
    company_id = current_user.company_id
    
    # Verify vehicle ownership
    if DB_AVAILABLE:
        with get_db_context() as db:
            vehicle = db.query(DBVehicle).filter(DBVehicle.id == vehicle_id, DBVehicle.company_id == company_id).first()
            if not vehicle:
                raise HTTPException(status_code=404, detail="Vehicle not found")
            
            history = db.query(DBEVBatteryRUL).filter(DBEVBatteryRUL.vehicle_id == vehicle_id).order_by(DBEVBatteryRUL.recorded_at.desc()).all()
            
            # Helper to convert DB model to dict for Pydantic
            def to_dict(obj):
                return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

            current = history[0] if history else None
            return BatteryHealthResponse(
                current=RULPrediction(**to_dict(current)) if current else None,
                history=[RULPrediction(**to_dict(h)) for h in history]
            )
    else:
        vehicle = _vehicles.get(vehicle_id)
        if not vehicle or vehicle.get("company_id") != company_id:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        history = _battery_health.get(vehicle_id, [])
        return BatteryHealthResponse(
            current=RULPrediction(**history[0]) if history else None,
            history=[RULPrediction(**h) for h in history]
        )


# =============================================================================
# Technician Productivity Analytics Endpoints
# =============================================================================

@app.get("/api/analytics/technician-performance", response_model=List[TechnicianPerformance], tags=["Analytics"])
async def get_technician_performance(
    current_user: UserResponse = Depends(get_current_user)
):
    """Aggregated performance metrics for all technicians in the company."""
    company_id = current_user.company_id
    
    # Filter technicians
    techs = [u for u in _users.values() if u.get("company_id") == company_id and u.get("role") in ["TECHNICIAN", "MANAGER"]]
    
    performance_list = []
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            # Re-fetch techs from DB if available
            db_techs = db.query(DBUser).filter(DBUser.company_id == company_id, DBUser.role.in_(["TECHNICIAN", "MANAGER"])).all()
            
            for tech in db_techs:
                # Jobs completed
                jobs_completed = db.query(DBJob).filter(DBJob.assigned_to == tech.id, DBJob.status.in_([JobStatusEnum.COMPLETED, JobStatusEnum.PAID])).count()
                
                # Labor metrics
                labor_entries = db.query(DBLaborEntry).filter(DBLaborEntry.technician_id == tech.id).all()
                total_hours = sum(l.hours for l in labor_entries)
                total_revenue = sum(l.hours * l.rate_per_hour for l in labor_entries)
                
                # Quality metrics (associated warranties)
                warranty_claims = db.query(DBWarranty).join(DBJob).filter(DBJob.assigned_to == tech.id).count()
                
                # Calculate Utilization (Assume 160 standard hours / month for demo)
                utilization = min(100.0, (total_hours / 160.0) * 100.0) if total_hours > 0 else 0.0
                quality_score = max(0.0, (1.0 - (warranty_claims / max(1, jobs_completed))) * 100.0)

                performance_list.append(TechnicianPerformance(
                    technician_id=tech.id,
                    technician_name=tech.name,
                    jobs_completed=jobs_completed,
                    avg_time_per_job=total_hours / max(1, jobs_completed),
                    revenue_generated=total_revenue,
                    utilization_rate=utilization,
                    quality_score=quality_score,
                    warranty_claims=warranty_claims
                ))
    else:
        for tech in techs:
            tech_id = tech["id"]
            # Jobs completed
            tech_jobs = [j for j in _jobs.values() if j.get("assigned_to") == tech_id and j.get("status") in ["Completed", "Paid"]]
            jobs_completed = len(tech_jobs)
            
            # Labor metrics from nested dict
            total_hours = 0.0
            total_revenue = 0.0
            for company_entries in _labor_entries.values():
                for entry in company_entries.values():
                    if entry.get("technician_id") == tech_id:
                        total_hours += entry.get("hours", 0)
                        total_revenue += entry.get("hours", 0) * entry.get("rate_per_hour", 500)
            
            # Quality metrics (associated warranties)
            # Warranty data structure not fully clear for mock, let's assume 0 for now
            warranty_claims = 0
            
            # Calculate Utilization
            utilization = min(100.0, (total_hours / 160.0) * 100.0) if total_hours > 0 else 0.0
            quality_score = 100.0 # Default

            performance_list.append(TechnicianPerformance(
                technician_id=tech_id,
                technician_name=tech["name"],
                jobs_completed=jobs_completed,
                avg_time_per_job=total_hours / max(1, jobs_completed),
                revenue_generated=total_revenue,
                utilization_rate=utilization,
                quality_score=quality_score,
                warranty_claims=warranty_claims
            ))
            
    return performance_list


@app.get("/api/analytics/technician/{user_id}/jobs", response_model=List[TechnicianJobAnalytics], tags=["Analytics"])
async def get_technician_jobs_analytics(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Detailed job history for a specific technician."""
    company_id = current_user.company_id
    
    analytics = []
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            jobs = db.query(DBJob).filter(DBJob.assigned_to == user_id, DBJob.company_id == company_id).all()
            for job in jobs:
                hours = sum(l.hours for l in job.labor_log if l.technician_id == user_id)
                revenue = sum(l.hours * l.rate_per_hour for l in job.labor_log if l.technician_id == user_id)
                analytics.append(TechnicianJobAnalytics(
                    job_id=job.id,
                    job_number=job.job_number,
                    service_type=job.service_type,
                    status=job.status,
                    hours_logged=hours,
                    revenue=revenue,
                    completed_at=job.completed_at
                ))
    else:
        for job in _jobs.values():
            if job.get("assigned_to") == user_id:
                # Search for labor entries associated with this job AND this tech
                hours = 0.0
                revenue = 0.0
                for company_entries in _labor_entries.values():
                    for entry in company_entries.values():
                        if entry.get("job_id") == job["id"] and entry.get("technician_id") == user_id:
                            hours += entry.get("hours", 0)
                            revenue += entry.get("hours", 0) * entry.get("rate_per_hour", 500)
                
                analytics.append(TechnicianJobAnalytics(
                    job_id=job["id"],
                    job_number=job["job_number"],
                    service_type=job["service_type"],
                    status=job["status"],
                    hours_logged=hours,
                    revenue=revenue,
                    completed_at=job.get("completed_at")
                ))
                
    return analytics


@app.get("/api/analytics/technician/{user_id}/revenue", response_model=TechnicianRevenueAnalytics, tags=["Analytics"])
async def get_technician_revenue_analytics(
    user_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Revenue statistics for a specific technician."""
    company_id = current_user.company_id
    
    total_rev = 0.0
    labor_rev = 0.0
    parts_rev = 0.0 # Typically technicians don't "generate" parts revenue, but we can track jobs they worked on
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            labor_entries = db.query(DBLaborEntry).filter(DBLaborEntry.technician_id == user_id).all()
            labor_rev = sum(l.hours * l.rate_per_hour for l in labor_entries)
            total_rev = labor_rev
    else:
        for company_entries in _labor_entries.values():
            for entry in company_entries.values():
                if entry.get("technician_id") == user_id:
                    labor_rev += entry.get("hours", 0) * entry.get("rate_per_hour", 500)
        total_rev = labor_rev
        
    return TechnicianRevenueAnalytics(
        technician_id=user_id,
        total_revenue=total_rev,
        labor_revenue=labor_rev,
        parts_revenue=parts_rev,
        period="Monthly"
    )


@app.get("/api/analytics/time-accuracy", response_model=TimeTrackingAnalytics, tags=["Analytics"])
async def get_time_accuracy_analytics(
    current_user: UserResponse = Depends(get_current_user)
):
    """Analyze estimation accuracy and job durations by service type."""
    company_id = current_user.company_id
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            jobs = db.query(DBJob).filter(DBJob.company_id == company_id, DBJob.status.in_([JobStatusEnum.COMPLETED, JobStatusEnum.PAID])).all()
            
            # Group by service type
            service_stats = {}
            bottlenecks = []
            
            for job in jobs:
                actual = job.actual_hours
                est = job.estimated_hours
                variance = actual - est
                
                if job.service_type not in service_stats:
                    service_stats[job.service_type] = {
                        "est": 0.0, "act": 0.0, "count": 0, "var": 0.0
                    }
                
                service_stats[job.service_type]["est"] += est
                service_stats[job.service_type]["act"] += actual
                service_stats[job.service_type]["var"] += variance
                service_stats[job.service_type]["count"] += 1
                
                # Possible bottleneck if actual > estimated
                if variance > 0:
                    bottlenecks.append({
                        "job_id": job.id,
                        "job_number": job.job_number,
                        "service_type": job.service_type,
                        "estimated": est,
                        "actual": actual,
                        "variance": variance
                    })
            
            metrics = []
            total_est = 0.0
            total_act = 0.0
            
            for s_type, stats in service_stats.items():
                count = stats["count"]
                avg_est = stats["est"] / count
                avg_act = stats["act"] / count
                avg_var = stats["var"] / count
                
                total_est += stats["est"]
                total_act += stats["act"]
                
                # Accuracy: 100% means actual == estimated
                accuracy = (min(avg_est, avg_act) / max(0.1, max(avg_est, avg_act))) * 100.0
                
                metrics.append(TimeAccuracyMetric(
                    service_type=s_type,
                    avg_estimated_hours=avg_est,
                    avg_actual_hours=avg_act,
                    avg_variance=avg_var,
                    accuracy_percentage=accuracy,
                    job_count=count
                ))
            
            overall_accuracy = (min(total_est, total_act) / max(0.1, max(total_est, total_act))) * 100.0 if total_act > 0 else 100.0
            
            return TimeTrackingAnalytics(
                overall_accuracy=overall_accuracy,
                metrics_by_service=metrics,
                top_bottlenecks=sorted(bottlenecks, key=lambda x: x["variance"], reverse=True)[:5]
            )
    else:
        # Mock implementation for demo
        import random
        service_types = ["Oil Change", "Brake Pad Replacement", "Diagnostic", "Engine Overhaul"]
        metrics = []
        for s in service_types:
            metrics.append(TimeAccuracyMetric(
                service_type=s,
                avg_estimated_hours=2.0 + random.random()*2,
                avg_actual_hours=2.0 + random.random()*3,
                avg_variance=random.random(),
                accuracy_percentage=85.0 + random.random()*10,
                job_count=5 + random.randint(1, 10)
            ))
        
        return TimeTrackingAnalytics(
            overall_accuracy=88.5,
            metrics_by_service=metrics,
            top_bottlenecks=[
                {"job_number": "JOB-101", "service_type": "Engine Overhaul", "estimated": 12.0, "actual": 15.5, "variance": 3.5},
                {"job_number": "JOB-105", "service_type": "Complex Diagnostic", "estimated": 2.0, "actual": 4.5, "variance": 2.5}
            ]
        )


# =============================================================================
# Parts Usage & Customer Value Analytics Endpoints
# =============================================================================

@app.get("/api/analytics/parts-usage", tags=["Analytics"])
async def get_parts_usage_analytics(current_user: UserResponse = Depends(get_current_user)):
    """Parts consumption trends, usage counts, and cost analysis by service type."""
    company_jobs = [j for j in _jobs.values() if j.get("company_id") == current_user.company_id]

    part_counts: Dict[str, dict] = {}
    service_part_cost: Dict[str, float] = {}
    service_job_count: Dict[str, int] = {}

    for job in company_jobs:
        service = job.get("service_type", "Other")
        service_job_count[service] = service_job_count.get(service, 0) + 1
        parts_used = job.get("partsUsed") or job.get("parts_used") or []
        for pu in parts_used:
            part_name = pu.get("name") or "Unknown"
            qty = int(pu.get("quantity") or pu.get("qty") or 1)
            unit_cost = float(pu.get("unitCost") or pu.get("unit_cost") or 0)
            total_cost = qty * unit_cost
            if part_name not in part_counts:
                part_counts[part_name] = {"name": part_name, "timesUsed": 0, "totalQuantity": 0, "totalCost": 0.0}
            part_counts[part_name]["timesUsed"] += 1
            part_counts[part_name]["totalQuantity"] += qty
            part_counts[part_name]["totalCost"] += total_cost
            service_part_cost[service] = service_part_cost.get(service, 0.0) + total_cost

    top_parts = sorted(part_counts.values(), key=lambda x: x["timesUsed"], reverse=True)[:20]

    cost_by_service = sorted([
        {
            "serviceType": svc,
            "totalPartsCost": round(service_part_cost.get(svc, 0), 2),
            "jobCount": cnt,
            "avgPartsCostPerJob": round(service_part_cost.get(svc, 0) / max(cnt, 1), 2),
        }
        for svc, cnt in service_job_count.items()
    ], key=lambda x: x["totalPartsCost"], reverse=True)

    all_parts = [p for p in _parts.values() if p.get("company_id") == current_user.company_id]
    turnover = sorted([
        {
            "name": p.get("name"),
            "sku": p.get("sku"),
            "currentStock": p.get("quantity", 0),
            "totalUsed": part_counts.get(p.get("name", ""), {}).get("totalQuantity", 0),
            "turnoverRate": round(part_counts.get(p.get("name", ""), {}).get("totalQuantity", 0) / max(p.get("quantity", 1), 1), 2),
            "isLowStock": p.get("quantity", 0) <= p.get("min_level", 5),
        }
        for p in all_parts
    ], key=lambda x: x["totalUsed"], reverse=True)[:20]

    return {
        "topParts": top_parts,
        "costByServiceType": cost_by_service,
        "stockTurnover": turnover,
        "totalUniqueParts": len(part_counts),
        "totalPartsTransactions": sum(p["timesUsed"] for p in part_counts.values()),
    }


@app.get("/api/analytics/customer-value", tags=["Analytics"])
async def get_customer_value_analytics(current_user: UserResponse = Depends(get_current_user)):
    """Customer lifetime value metrics: total spend, visit frequency, churn risk."""
    company_jobs = [j for j in _jobs.values() if j.get("company_id") == current_user.company_id]
    company_invoices = [i for i in _invoices.values() if i.get("company_id") == current_user.company_id and i.get("status") == "Paid"]
    company_customers = [c for c in _customers.values() if c.get("company_id") == current_user.company_id]
    now = datetime.utcnow()

    customer_stats: Dict[str, dict] = {
        c["id"]: {
            "customerId": c["id"], "name": c.get("name", "Unknown"), "email": c.get("email", ""),
            "totalSpend": 0.0, "invoiceCount": 0, "jobCount": 0, "avgTransactionValue": 0.0,
            "firstVisit": None, "lastVisit": None, "daysSinceLastVisit": None,
            "visitFrequencyDays": None, "churnRiskScore": 0, "churnRiskLabel": "Low",
        }
        for c in company_customers
    }

    for invoice in company_invoices:
        cid = invoice.get("customer_id")
        if cid not in customer_stats:
            continue
        stats = customer_stats[cid]
        stats["totalSpend"] += float(invoice.get("total", invoice.get("amount", 0)))
        stats["invoiceCount"] += 1
        date_str = invoice.get("issue_date") or invoice.get("created_at")
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
                if stats["firstVisit"] is None or dt < stats["firstVisit"]:
                    stats["firstVisit"] = dt
                if stats["lastVisit"] is None or dt > stats["lastVisit"]:
                    stats["lastVisit"] = dt
            except Exception:
                pass

    for job in company_jobs:
        cid = job.get("customer_id")
        if cid in customer_stats:
            customer_stats[cid]["jobCount"] += 1

    results = []
    for stats in customer_stats.values():
        if stats["invoiceCount"] > 0:
            stats["avgTransactionValue"] = round(stats["totalSpend"] / stats["invoiceCount"], 2)
        if stats["lastVisit"]:
            days_since = (now - stats["lastVisit"]).days
            stats["daysSinceLastVisit"] = days_since
            if stats["invoiceCount"] > 1 and stats["firstVisit"]:
                span = (stats["lastVisit"] - stats["firstVisit"]).days
                stats["visitFrequencyDays"] = round(span / (stats["invoiceCount"] - 1), 1)
            churn = 0
            churn += 50 if days_since > 365 else 30 if days_since > 180 else 15 if days_since > 90 else 0
            churn += 30 if stats["invoiceCount"] <= 1 else 10 if stats["invoiceCount"] <= 3 else 0
            churn += 10 if stats["avgTransactionValue"] < 500 else 0
            churn = min(churn, 100)
            stats["churnRiskScore"] = churn
            stats["churnRiskLabel"] = "Critical" if churn >= 70 else "High" if churn >= 50 else "Medium" if churn >= 30 else "Low"
        stats["firstVisit"] = stats["firstVisit"].isoformat() if stats["firstVisit"] else None
        stats["lastVisit"] = stats["lastVisit"].isoformat() if stats["lastVisit"] else None
        stats["totalSpend"] = round(stats["totalSpend"], 2)
        results.append(stats)

    results.sort(key=lambda x: x["totalSpend"], reverse=True)
    paying = [r for r in results if r["invoiceCount"] > 0]
    total_rev = sum(r["totalSpend"] for r in paying)

    return {
        "customers": results,
        "summary": {
            "totalCustomers": len(results),
            "payingCustomers": len(paying),
            "avgLifetimeValue": round(total_rev / max(len(paying), 1), 2),
            "totalRevenue": round(total_rev, 2),
            "atRiskCount": len([r for r in results if r["churnRiskLabel"] in ("High", "Critical")]),
        },
    }



# =============================================================================
# Financial Reports Endpoints
# =============================================================================

@app.get("/api/analytics/financial/pl-statement", tags=["Analytics"])
async def get_pl_statement(
    year: Optional[int] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """Profit & Loss statement: revenue, costs, and gross profit by month."""
    target_year = year or datetime.utcnow().year
    company_invoices = [
        i for i in _invoices.values()
        if i.get("company_id") == current_user.company_id and i.get("status") == "Paid"
    ]
    company_jobs = [j for j in _jobs.values() if j.get("company_id") == current_user.company_id]

    MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly: Dict[int, dict] = {
        m: {"month": MONTHS[m - 1], "revenue": 0.0, "partsCost": 0.0, "laborCost": 0.0, "grossProfit": 0.0}
        for m in range(1, 13)
    }

    # Revenue from paid invoices
    for inv in company_invoices:
        date_str = inv.get("issue_date") or inv.get("created_at", "")
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            if dt.year == target_year:
                monthly[dt.month]["revenue"] += float(inv.get("total", 0))
        except Exception:
            pass

    # Costs from job parts & labour
    for job in company_jobs:
        date_str = job.get("created_at", "")
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            if dt.year != target_year:
                continue
            m = dt.month
            for pu in (job.get("partsUsed") or job.get("parts_used") or []):
                monthly[m]["partsCost"] += float(pu.get("unitCost") or 0) * int(pu.get("quantity") or 1)
            for lb in (job.get("laborLog") or job.get("labor_log") or []):
                monthly[m]["laborCost"] += float(lb.get("totalCost") or 0)
        except Exception:
            pass

    rows = []
    total_revenue = total_parts = total_labor = 0.0
    for m in range(1, 13):
        row = monthly[m]
        total_cost = row["partsCost"] + row["laborCost"]
        row["totalCost"] = round(total_cost, 2)
        row["grossProfit"] = round(row["revenue"] - total_cost, 2)
        row["margin"] = round((row["grossProfit"] / row["revenue"] * 100) if row["revenue"] else 0, 1)
        row["revenue"] = round(row["revenue"], 2)
        row["partsCost"] = round(row["partsCost"], 2)
        row["laborCost"] = round(row["laborCost"], 2)
        rows.append(row)
        total_revenue += row["revenue"]
        total_parts += row["partsCost"]
        total_labor += row["laborCost"]

    total_cost = total_parts + total_labor
    return {
        "year": target_year,
        "monthly": rows,
        "totals": {
            "revenue": round(total_revenue, 2),
            "partsCost": round(total_parts, 2),
            "laborCost": round(total_labor, 2),
            "totalCost": round(total_cost, 2),
            "grossProfit": round(total_revenue - total_cost, 2),
            "margin": round(((total_revenue - total_cost) / total_revenue * 100) if total_revenue else 0, 1),
        },
    }


@app.get("/api/analytics/financial/tax-summary", tags=["Analytics"])
async def get_tax_summary(
    year: Optional[int] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """VAT/Tax summary: taxable revenue, tax collected, and net amounts by month."""
    target_year = year or datetime.utcnow().year
    MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly: Dict[int, dict] = {
        m: {"month": MONTHS[m - 1], "subtotal": 0.0, "taxAmount": 0.0, "total": 0.0, "invoiceCount": 0}
        for m in range(1, 13)
    }
    company_invoices = [
        i for i in _invoices.values()
        if i.get("company_id") == current_user.company_id and i.get("status") == "Paid"
    ]
    for inv in company_invoices:
        date_str = inv.get("issue_date") or inv.get("created_at", "")
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            if dt.year != target_year:
                continue
            m = dt.month
            monthly[m]["subtotal"] += float(inv.get("subtotal", 0))
            monthly[m]["taxAmount"] += float(inv.get("tax_amount", inv.get("taxAmount", 0)))
            monthly[m]["total"] += float(inv.get("total", 0))
            monthly[m]["invoiceCount"] += 1
        except Exception:
            pass

    rows = []
    totals = {"subtotal": 0.0, "taxAmount": 0.0, "total": 0.0, "invoiceCount": 0}
    for m in range(1, 13):
        row = monthly[m]
        row["subtotal"] = round(row["subtotal"], 2)
        row["taxAmount"] = round(row["taxAmount"], 2)
        row["total"] = round(row["total"], 2)
        row["effectiveRate"] = round((row["taxAmount"] / row["subtotal"] * 100) if row["subtotal"] else 0, 1)
        rows.append(row)
        for k in totals:
            totals[k] += row[k]  # type: ignore[operator]
    totals["subtotal"] = round(totals["subtotal"], 2)
    totals["taxAmount"] = round(totals["taxAmount"], 2)
    totals["total"] = round(totals["total"], 2)
    totals["effectiveRate"] = round((totals["taxAmount"] / totals["subtotal"] * 100) if totals["subtotal"] else 0, 1)

    return {"year": target_year, "monthly": rows, "totals": totals}


@app.get("/api/analytics/financial/monthly-revenue", tags=["Analytics"])
async def get_monthly_revenue(
    months: int = Query(12, ge=3, le=24),
    current_user: UserResponse = Depends(get_current_user),
):
    """Rolling monthly revenue breakdown for the last N months."""
    now = datetime.utcnow()
    company_invoices = [
        i for i in _invoices.values()
        if i.get("company_id") == current_user.company_id and i.get("status") == "Paid"
    ]
    buckets: Dict[str, dict] = {}
    for offset in range(months - 1, -1, -1):
        y = now.year if now.month - offset > 0 else now.year - 1
        m = (now.month - offset - 1) % 12 + 1
        key = f"{y}-{m:02d}"
        label = datetime(y, m, 1).strftime("%b %Y")
        buckets[key] = {"key": key, "label": label, "revenue": 0.0, "invoiceCount": 0, "avgInvoiceValue": 0.0}

    for inv in company_invoices:
        date_str = inv.get("issue_date") or inv.get("created_at", "")
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            key = f"{dt.year}-{dt.month:02d}"
            if key in buckets:
                buckets[key]["revenue"] += float(inv.get("total", 0))
                buckets[key]["invoiceCount"] += 1
        except Exception:
            pass

    rows = []
    for b in buckets.values():
        b["revenue"] = round(b["revenue"], 2)
        cnt = b["invoiceCount"]
        b["avgInvoiceValue"] = round(b["revenue"] / cnt, 2) if cnt else 0.0
        rows.append(b)

    # Month-over-month growth
    for i in range(1, len(rows)):
        prev = rows[i - 1]["revenue"]
        curr = rows[i]["revenue"]
        rows[i]["growth"] = round(((curr - prev) / prev * 100) if prev else 0, 1)
    if rows:
        rows[0]["growth"] = None

    total_rev = sum(r["revenue"] for r in rows)
    best_month = max(rows, key=lambda x: x["revenue"]) if rows else None
    return {
        "months": rows,
        "summary": {
            "totalRevenue": round(total_rev, 2),
            "avgMonthlyRevenue": round(total_rev / len(rows), 2) if rows else 0,
            "bestMonth": best_month["label"] if best_month else None,
            "bestMonthRevenue": best_month["revenue"] if best_month else 0,
        },
    }


@app.get("/api/analytics/financial/cost-by-service", tags=["Analytics"])
async def get_cost_by_service(current_user: UserResponse = Depends(get_current_user)):
    """Cost and revenue breakdown by service type for profitability analysis."""
    company_jobs = [j for j in _jobs.values() if j.get("company_id") == current_user.company_id]
    company_invoices = [
        i for i in _invoices.values()
        if i.get("company_id") == current_user.company_id and i.get("status") == "Paid"
    ]

    # Map job_id → invoice total
    job_revenue: Dict[str, float] = {}
    for inv in company_invoices:
        jid = inv.get("job_id")
        if jid:
            job_revenue[jid] = job_revenue.get(jid, 0.0) + float(inv.get("total", 0))

    service_map: Dict[str, dict] = {}
    for job in company_jobs:
        svc = job.get("service_type", "Other")
        if svc not in service_map:
            service_map[svc] = {
                "serviceType": svc, "jobCount": 0, "revenue": 0.0,
                "partsCost": 0.0, "laborCost": 0.0, "totalCost": 0.0,
                "grossProfit": 0.0, "margin": 0.0,
            }
        rec = service_map[svc]
        rec["jobCount"] += 1
        rec["revenue"] += job_revenue.get(job["id"], float(job.get("estimated_cost", job.get("estimatedCost", 0))))
        for pu in (job.get("partsUsed") or job.get("parts_used") or []):
            rec["partsCost"] += float(pu.get("unitCost") or 0) * int(pu.get("quantity") or 1)
        for lb in (job.get("laborLog") or job.get("labor_log") or []):
            rec["laborCost"] += float(lb.get("totalCost") or 0)

    rows = []
    for rec in service_map.values():
        rec["totalCost"] = round(rec["partsCost"] + rec["laborCost"], 2)
        rec["grossProfit"] = round(rec["revenue"] - rec["totalCost"], 2)
        rec["margin"] = round((rec["grossProfit"] / rec["revenue"] * 100) if rec["revenue"] else 0, 1)
        rec["revenue"] = round(rec["revenue"], 2)
        rec["partsCost"] = round(rec["partsCost"], 2)
        rec["laborCost"] = round(rec["laborCost"], 2)
        rows.append(rec)

    rows.sort(key=lambda x: x["revenue"], reverse=True)
    return {"services": rows, "totalServices": len(rows)}


# =============================================================================
# Helper Functions for Messaging Triggers
# =============================================================================

async def send_job_message(
    job_id: str,
    template_id: str,
    trigger_event: str,
    variables: Dict[str, str],
    company_id: str,
    customer_id: str,
):
    """Helper to send job-related messages asynchronously."""
    try:
        messaging_svc = MessagingService(sms_service=sms_service)
        cust = _customers.get(customer_id, {})
        recipient_phone = cust.get('phone', '')
        
        if not recipient_phone:
            logger.warning(f"Customer {customer_id} has no phone number, skipping message")
            return
        
        await messaging_svc.send_message(
            template_id=template_id,
            customer_id=customer_id,
            company_id=company_id,
            recipient_phone=recipient_phone,
            variables=variables,
            trigger_event=trigger_event,
            job_id=job_id,
        )
    except Exception as e:
        logger.error(f"Error sending job message: {e}")


async def send_appointment_message(
    appointment_id: str,
    template_id: str,
    trigger_event: str,
    variables: Dict[str, str],
    company_id: str,
    customer_id: str,
):
    """Helper to send appointment-related messages asynchronously."""
    try:
        messaging_svc = MessagingService(sms_service=sms_service)
        cust = _customers.get(customer_id, {})
        recipient_phone = cust.get('phone', '')
        
        if not recipient_phone:
            logger.warning(f"Customer {customer_id} has no phone number, skipping message")
            return
        
        await messaging_svc.send_message(
            template_id=template_id,
            customer_id=customer_id,
            company_id=company_id,
            recipient_phone=recipient_phone,
            variables=variables,
            trigger_event=trigger_event,
            appointment_id=appointment_id,
        )
    except Exception as e:
        logger.error(f"Error sending appointment message: {e}")


async def send_invoice_message(
    invoice_id: str,
    template_id: str,
    trigger_event: str,
    variables: Dict[str, str],
    company_id: str,
    customer_id: str,
):
    """Helper to send invoice-related messages asynchronously."""
    try:
        messaging_svc = MessagingService(sms_service=sms_service)
        cust = _customers.get(customer_id, {})
        recipient_phone = cust.get('phone', '')
        
        if not recipient_phone:
            logger.warning(f"Customer {customer_id} has no phone number, skipping message")
            return
        
        await messaging_svc.send_message(
            template_id=template_id,
            customer_id=customer_id,
            company_id=company_id,
            recipient_phone=recipient_phone,
            variables=variables,
            trigger_event=trigger_event,
            invoice_id=invoice_id,
        )
    except Exception as e:
        logger.error(f"Error sending invoice message: {e}")


# =============================================================================
# Jobs/Work Orders Endpoints
# =============================================================================

@app.get("/api/jobs", response_model=List[JobResponse], tags=["Jobs"])
async def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[JobStatus] = None,
    priority: Optional[Priority] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all jobs with optional filtering."""
    jobs = list(_jobs.values())
    # restrict to current user's company
    jobs = [j for j in jobs if j.get("company_id") == current_user.company_id]
    if status:
        jobs = [j for j in jobs if j.get("status") == status]
    if priority:
        jobs = [j for j in jobs if j.get("priority") == priority]
    if search:
        q = search.strip().lower()
        def _val(v: Any) -> str:
            return str(v or "").lower()
        def _matches(job: dict) -> bool:
            cust = _customers.get(job.get("customer_id") or "") or {}
            veh = _vehicles.get(job.get("vehicle_id") or "") or {}
            hay = " ".join([
                _val(job.get("id")),
                _val(job.get("service_type") or job.get("serviceType")),
                _val(job.get("description")),
                _val(job.get("notes")),
                _val(job.get("status")),
                _val(job.get("priority")),
                _val(cust.get("name")),
                _val(cust.get("email")),
                _val(cust.get("phone")),
                _val(veh.get("registration")),
                _val(veh.get("vin")),
                _val(veh.get("make")),
                _val(veh.get("model")),
            ])
            return q in hay
        jobs = [j for j in jobs if _matches(j)]
    return [JobResponse(**j) for j in jobs[skip:skip+limit]]


@app.post("/api/jobs", response_model=JobResponse, status_code=201, tags=["Jobs"])
async def create_job(job: JobCreate, current_user: UserResponse = Depends(get_current_user)):
    """Create a new job/work order."""
    # ensure customer belongs to company
    cust = _customers.get(job.customer_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=400, detail="Customer must belong to your company")

    job_id = f"JOB-{str(uuid.uuid4())[:8].upper()}"
    job_data = {
        "id": job_id,
        **job.model_dump(),
        "company_id": current_user.company_id,
        "status": JobStatus.PENDING,
        "created_at": datetime.now(),
    }
    _jobs[job_id] = job_data
    
    # Send "job received" notification asynchronously
    try:
        vehicle = _vehicles.get(job.vehicle_id, {})
        vehicle_reg = vehicle.get('registration', 'N/A')
        company = _companies.get(current_user.company_id, {})
        workshop_name = company.get('name', 'Workshop')
        
        variables = {
            'customerName': cust.get('name', 'Customer'),
            'vehicleReg': vehicle_reg,
            'jobNumber': job_id,
            'workshopName': workshop_name,
        }
        
        # Send notification asynchronously (non-blocking)
        asyncio.create_task(send_job_message(
            job_id=job_id,
            template_id='job_received',
            trigger_event='job_created',
            variables=variables,
            company_id=current_user.company_id,
            customer_id=job.customer_id,
        ))
    except Exception as e:
        logger.warning(f"Failed to queue job received message: {e}")
    
    await manager.broadcast_to_company(current_user.company_id, {"event": "job_created", "data": job_data})
    return JobResponse(**job_data)


@app.get("/api/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
async def get_job(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific job by ID."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(**job)


@app.patch("/api/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
async def update_job(job_id: str, update: JobUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a job."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    old_status = job.get("status")
    job_data = job
    update_data = update.model_dump(exclude_unset=True)
    job_data.update(update_data)
    
    # Automate started_at and completed_at tracking
    if update.status == JobStatus.IN_PROGRESS and not job_data.get("started_at"):
        job_data["started_at"] = datetime.utcnow()
    
    if update.status in [JobStatus.COMPLETED, JobStatus.PAID]:
        job_data["completed_at"] = datetime.utcnow()
    
    # Send status change messages asynchronously
    new_status = update_data.get('status')
    if new_status and new_status != old_status:
        try:
            cust = _customers.get(job['customer_id'], {})
            vehicle = _vehicles.get(job['vehicle_id'], {})
            company = _companies.get(current_user.company_id, {})
            
            vehicle_reg = vehicle.get('registration', 'N/A')
            customer_name = cust.get('name', 'Customer')
            workshop_name = company.get('name', 'Workshop')
            due_date = job.get('due_date', '')
            
            variables = {
                'customerName': customer_name,
                'vehicleReg': vehicle_reg,
                'jobNumber': job_id,
                'workshopName': workshop_name,
                'dueDate': str(due_date),
            }
            
            # Map status to template
            template_map = {
                JobStatus.IN_PROGRESS: ('job_in_progress', 'job_status_changed_in_progress'),
                JobStatus.AWAITING_APPROVAL: ('job_ready', 'job_awaiting_approval'),
                JobStatus.COMPLETED: ('job_completion', 'job_completed'),
            }
            
            if new_status in template_map:
                template_id, trigger = template_map[new_status]
                asyncio.create_task(send_job_message(
                    job_id=job_id,
                    template_id=template_id,
                    trigger_event=trigger,
                    variables=variables,
                    company_id=current_user.company_id,
                    customer_id=job['customer_id'],
                ))
        except Exception as e:
            logger.warning(f"Failed to queue job status message: {e}")
    
    await manager.broadcast_to_company(current_user.company_id, {"event": "job_updated", "data": job_data})
    return JobResponse(**job_data)


@app.delete("/api/jobs/{job_id}", status_code=204, tags=["Jobs"])
async def delete_job(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a job."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    del _jobs[job_id]
    await manager.broadcast_to_company(current_user.company_id, {"event": "job_deleted", "data": {"id": job_id}})
    return


@app.post("/api/jobs/{job_id}/tasks", response_model=JobResponse, tags=["Jobs"])
async def add_job_task(job_id: str, task: JobTask, current_user: UserResponse = Depends(get_current_user)):
    """Add a task to a job."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job.setdefault("tasks", []).append(task.model_dump())
    await manager.broadcast_to_company(current_user.company_id, {"event": "job_updated", "data": job})
    return JobResponse(**job)


@app.patch("/api/jobs/{job_id}/tasks/{task_id}", response_model=JobResponse, tags=["Jobs"])
async def update_job_task(job_id: str, task_id: str, completed: bool, current_user: UserResponse = Depends(get_current_user)):
    """Update task completion status."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    for task in job.get("tasks", []):
        if task["id"] == task_id:
            task["completed"] = completed
            break
    
    await manager.broadcast_to_company(current_user.company_id, {"event": "job_updated", "data": job})
    return JobResponse(**job)


@app.patch("/api/jobs/{job_id}/parts/{part_usage_id}", response_model=JobResponse, tags=["Jobs"])
async def update_job_part(job_id: str, part_usage_id: str, update: JobPartUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a part usage on a job (quantity/unit cost/name)."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")

    parts = job.setdefault("partsUsed", [])
    part_item = next((p for p in parts if p.get("id") == part_usage_id), None)
    if not part_item:
        raise HTTPException(status_code=404, detail="Part usage not found on job")

    old_total = part_item.get("totalCost", part_item.get("quantity", 0) * part_item.get("unitCost", 0))
    update_data = update.model_dump(exclude_unset=True)
    if "quantity" in update_data:
        part_item["quantity"] = update_data["quantity"]
    if "unitCost" in update_data:
        part_item["unitCost"] = update_data["unitCost"]
    if "name" in update_data:
        part_item["name"] = update_data["name"]

    part_item["totalCost"] = part_item.get("quantity", 0) * part_item.get("unitCost", 0)

    # Adjust job estimated_cost by delta
    new_total = part_item["totalCost"]
    job["estimated_cost"] = job.get("estimated_cost", 0) - old_total + new_total
    
    await manager.broadcast_to_company(current_user.company_id, {"event": "job_updated", "data": job})
    return JobResponse(**job)


# =============================================================================
# Parts/Inventory Endpoints
# =============================================================================

@app.get("/api/parts", response_model=List[PartResponse], tags=["Inventory"])
async def list_parts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    low_stock: bool = False,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all parts for the user's company with optional filtering."""
    company_id = current_user.company_id
    parts = [p for p in _parts.values() if p.get("company_id") == company_id]
    
    # Add is_low_stock flag
    for p in parts:
        p["is_low_stock"] = p["quantity"] <= p["min_level"]
    
    if category:
        parts = [p for p in parts if p.get("category") == category]
    if low_stock:
        parts = [p for p in parts if p["is_low_stock"]]
    if search:
        q = search.strip().lower()
        def _val(v: Any) -> str:
            return str(v or "").lower()
        parts = [
            p for p in parts
            if (
                q in _val(p.get("name")) or
                q in _val(p.get("sku")) or
                q in _val(p.get("category")) or
                q in _val(p.get("supplier")) or
                q in _val(p.get("location"))
            )
        ]
    
    return [PartResponse(**p) for p in parts[skip:skip+limit]]


@app.post("/api/parts", response_model=PartResponse, status_code=201, tags=["Inventory"])
async def create_part(part: PartCreate, current_user: UserResponse = Depends(get_current_user)):
    """Add a new part to inventory for user's company."""
    part_id = str(uuid.uuid4())
    part_data = {
        "id": part_id,
        **part.model_dump(),
        "is_low_stock": part.quantity <= part.min_level,
        "company_id": current_user.company_id,
    }
    _parts[part_id] = part_data
    await manager.broadcast_to_company(current_user.company_id, {"event": "part_created", "data": part_data})
    return PartResponse(**part_data)


@app.get("/api/parts/{part_id}", response_model=PartResponse, tags=["Inventory"])
async def get_part(part_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific part by ID if it belongs to user's company."""
    if part_id not in _parts:
        raise HTTPException(status_code=404, detail="Part not found")
    part = _parts[part_id]
    if part.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Part not found")
    part["is_low_stock"] = part["quantity"] <= part["min_level"]
    await manager.broadcast_to_company(current_user.company_id, {"event": "part_updated", "data": part})
    return PartResponse(**part)


@app.patch("/api/parts/{part_id}", response_model=PartResponse, tags=["Inventory"])
async def update_part(part_id: str, update: PartUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a part if it belongs to user's company."""
    if part_id not in _parts:
        raise HTTPException(status_code=404, detail="Part not found")
    
    part_data = _parts[part_id]
    if part_data.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Part not found")
    update_data = update.model_dump(exclude_unset=True)
    part_data.update(update_data)
    part_data["is_low_stock"] = part_data["quantity"] <= part_data["min_level"]
    await manager.broadcast_to_company(current_user.company_id, {"event": "part_updated", "data": part_data})
    return PartResponse(**part_data)


@app.post("/api/parts/{part_id}/adjust", response_model=PartResponse, tags=["Inventory"])
async def adjust_stock(part_id: str, quantity: int, reason: str, current_user: UserResponse = Depends(get_current_user)):
    """Adjust stock quantity (positive or negative) if part belongs to user's company."""
    if part_id not in _parts:
        raise HTTPException(status_code=404, detail="Part not found")
    if _parts[part_id].get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Part not found")
    
    _parts[part_id]["quantity"] += quantity
    _parts[part_id]["is_low_stock"] = _parts[part_id]["quantity"] <= _parts[part_id]["min_level"]
    
    await manager.broadcast_to_company(current_user.company_id, {"event": "part_updated", "data": _parts[part_id]})
    return PartResponse(**_parts[part_id])


@app.get("/api/parts/low-stock", response_model=List[PartResponse], tags=["Inventory"])
async def list_low_stock_parts(current_user: UserResponse = Depends(get_current_user)):
    """List parts that are below or at their minimum level for the current user's company."""
    company_id = current_user.company_id
    parts = [p for p in _parts.values() if p.get("company_id") == company_id]
    low = [p for p in parts if p.get("quantity", 0) <= p.get("min_level", 0)]
    for p in low:
        p["is_low_stock"] = p.get("quantity", 0) <= p.get("min_level", 0)
    return [PartResponse(**p) for p in low]


@app.delete("/api/parts/{part_id}", status_code=204, tags=["Inventory"])
async def delete_part(part_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a part if it belongs to the current user's company."""
    if part_id not in _parts:
        raise HTTPException(status_code=404, detail="Part not found")
    part = _parts[part_id]
    if part.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Part not found")
    del _parts[part_id]
    await manager.broadcast_to_company(current_user.company_id, {"event": "part_deleted", "data": {"id": part_id}})
    return


# =============================================================================
# Invoices/Quotes Endpoints
# =============================================================================

@app.get("/api/invoices", response_model=List[InvoiceResponse], tags=["Invoices"])
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type: Optional[str] = None,
    status: Optional[InvoiceStatus] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all invoices/quotes for the user's company."""
    company_id = current_user.company_id
    invoices = [inv for inv in _invoices.values() if inv.get("company_id") == company_id]
    if type:
        invoices = [i for i in invoices if i.get("type") == type]
    if status:
        invoices = [i for i in invoices if i.get("status") == status]
    if search:
        q = search.strip().lower()
        def _val(v: Any) -> str:
            return str(v or "").lower()
        def _matches(inv: dict) -> bool:
            cust = _customers.get(inv.get("customer_id") or "") or {}
            return q in " ".join([
                _val(inv.get("id")),
                _val(inv.get("number")),
                _val(inv.get("type")),
                _val(inv.get("status")),
                _val(inv.get("job_id")),
                _val(cust.get("name")),
                _val(cust.get("email")),
                _val(cust.get("phone")),
            ])
        invoices = [i for i in invoices if _matches(i)]
    return [InvoiceResponse(**i) for i in invoices[skip:skip+limit]]


@app.post("/api/invoices", response_model=InvoiceResponse, status_code=201, tags=["Invoices"])
async def create_invoice(invoice: InvoiceCreate, current_user: UserResponse = Depends(get_current_user)):
    """Create a new invoice or quote for current user's company."""
    # ensure referenced customer belongs to same company
    cust = _customers.get(invoice.customer_id)
    if not cust or cust.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=400, detail="Customer must belong to your company")

    invoice_id = str(uuid.uuid4())
    prefix = "INV" if invoice.type == "Invoice" else "QT"
    number = f"{prefix}-{invoice_id[:8].upper()}"
    
    # Calculate totals
    subtotal = sum(item.total for item in invoice.items)
    tax_amount = subtotal * 0.15  # 15% VAT
    total = subtotal + tax_amount
    
    invoice_data = {
        "id": invoice_id,
        **invoice.model_dump(),
        "company_id": current_user.company_id,
        "number": number,
        "issue_date": datetime.now(),
        "due_date": datetime.now() + timedelta(days=30),
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total": total,
        "status": InvoiceStatus.DRAFT,
    }
    _invoices[invoice_id] = invoice_data
    
    # Send "invoice created" notification for actual invoices (not quotes) asynchronously
    if invoice.type == "Invoice":
        try:
            company = _companies.get(current_user.company_id, {})
            workshop_name = company.get('name', 'Workshop')
            
            variables = {
                'customerName': cust.get('name', 'Customer'),
                'invoiceNumber': number,
                'totalCost': f"{total:.2f}",
                'dueDate': invoice_data['due_date'].strftime('%Y-%m-%d'),
                'workshopName': workshop_name,
            }
            
            asyncio.create_task(send_invoice_message(
                invoice_id=invoice_id,
                template_id='invoice_created',
                trigger_event='invoice_created',
                variables=variables,
                company_id=current_user.company_id,
                customer_id=invoice.customer_id,
            ))
        except Exception as e:
            logger.warning(f"Failed to queue invoice created message: {e}")
    
    await manager.broadcast_to_company(current_user.company_id, {"event": "invoice_created", "data": invoice_data})
    return InvoiceResponse(**invoice_data)


@app.post("/api/invoices/batch", response_model=List[InvoiceResponse], tags=["Invoices"])
async def create_invoices_batch(batch: BatchInvoiceRequest, current_user: UserResponse = Depends(get_current_user)):
    """Process a batch of invoices for performance testing."""
    results = []
    for invoice in batch.invoices:
        invoice_id = str(uuid.uuid4())
        prefix = "INV" if invoice.type == "Invoice" else "QT"
        number = f"{prefix}-{invoice_id[:8].upper()}"
        
        subtotal = sum(item.unit_price * item.quantity for item in invoice.items)
        tax_amount = subtotal * 0.15
        total = subtotal + tax_amount
        
        invoice_data = {
            "id": invoice_id,
            **invoice.model_dump(),
            "company_id": current_user.company_id,
            "number": number,
            "issue_date": datetime.now(),
            "due_date": datetime.now() + timedelta(days=30),
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "total": total,
            "status": InvoiceStatus.DRAFT,
        }
        _invoices[invoice_id] = invoice_data
        results.append(InvoiceResponse(**invoice_data))
    return results


@app.get("/api/reports/pdf", tags=["Analytics"])
async def generate_pdf_report(current_user: UserResponse = Depends(get_current_user)):
    """Generate a large PDF report for performance testing."""
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Generate 50 pages of content
    for i in range(1, 51):
        p.drawString(100, height - 100, f"Workshop Management System - Performance Report Page {i}")
        p.drawString(100, height - 130, f"Generated for: {current_user.name} ({current_user.company_id})")
        p.drawString(100, height - 150, f"Timestamp: {datetime.now().isoformat()}")
        
        # Add some dummy data lines
        y = height - 200
        for j in range(40):
            p.drawString(100, y, f"Data Record {j}: High-performance analytics simulation data line content...")
            y -= 15
            
        p.showPage()
        
    p.save()
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=report.pdf"})


@app.get("/api/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["Invoices"])
async def get_invoice(invoice_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific invoice by ID if it belongs to the user's company."""
    inv = _invoices.get(invoice_id)
    if not inv or inv.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse(**inv)


@app.patch("/api/invoices/{invoice_id}/status", response_model=InvoiceResponse, tags=["Invoices"])
async def update_invoice_status(invoice_id: str, status: InvoiceStatus, current_user: UserResponse = Depends(get_current_user)):
    """Update invoice status if it belongs to the user's company."""
    invoice = _invoices.get(invoice_id)
    if not invoice or invoice.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    invoice["status"] = status
    await manager.broadcast_to_company(current_user.company_id, {"event": "invoice_updated", "data": invoice})
    return InvoiceResponse(**invoice)


@app.get("/api/invoices/{invoice_id}/items", response_model=List[InvoiceItem], tags=["Invoices"])
async def list_invoice_items(invoice_id: str, current_user: UserResponse = Depends(get_current_user)):
    """List items for a specific invoice if it belongs to the user's company."""
    # Prefer persistent DB when available
    if DB_AVAILABLE:
        from db.database import get_db_context
        from db.models import InvoiceItem as DBInvoiceItem, Invoice as DBInvoice
        with get_db_context() as db:
            db_inv = db.query(DBInvoice).filter(DBInvoice.id == invoice_id, DBInvoice.company_id == current_user.company_id).first()
            if db_inv:
                items = db.query(DBInvoiceItem).filter(DBInvoiceItem.invoice_id == invoice_id).all()
                return [InvoiceItem(id=i.id, description=i.description, quantity=i.quantity, unit_price=i.unit_price, total=i.total) for i in items]
            # Fall back to in-memory if DB invoice not found

    inv = _invoices.get(invoice_id)
    if not inv or inv.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    company_id = current_user.company_id
    if company_id not in _invoice_items:
        return []

    items = [i for i in _invoice_items[company_id].values() if i.get("invoice_id") == invoice_id]
    return [InvoiceItem(**i) for i in items]


@app.post("/api/invoices/{invoice_id}/items", response_model=InvoiceItem, status_code=201, tags=["Invoices"])
async def create_invoice_item(invoice_id: str, item: InvoiceItemCreate, current_user: UserResponse = Depends(get_current_user)):
    """Add an item to an existing invoice and recalculate totals."""
    inv = _invoices.get(invoice_id)
    if not inv or inv.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    company_id = current_user.company_id
    item_id = str(uuid.uuid4())
    total = item.quantity * item.unit_price
    item_data = {
        "id": item_id,
        "invoice_id": invoice_id,
        "description": item.description,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "total": total,
    }

    if company_id not in _invoice_items:
        _invoice_items[company_id] = {}

    _invoice_items[company_id][item_id] = item_data

    # Persistent DB path
    if DB_AVAILABLE:
        from db.database import get_db_context
        from db.models import InvoiceItem as DBInvoiceItem, Invoice as DBInvoice
        with get_db_context() as db:
            db_inv = db.query(DBInvoice).filter(DBInvoice.id == invoice_id, DBInvoice.company_id == current_user.company_id).first()
            if db_inv:
                db_item = DBInvoiceItem(invoice_id=invoice_id, description=item.description, quantity=item.quantity, unit_price=item.unit_price, total=item.quantity * item.unit_price)
                db.add(db_item)
                db.commit()
                db.refresh(db_item)

                # Recalculate totals from DB items
                items = db.query(DBInvoiceItem).filter(DBInvoiceItem.invoice_id == invoice_id).all()
                subtotal = sum(i.total for i in items)
                db_inv.subtotal = subtotal
                db_inv.tax_amount = subtotal * db_inv.tax_rate
                db_inv.total = db_inv.subtotal + db_inv.tax_amount - getattr(db_inv, 'discount', 0)
                db.commit()

                return InvoiceItem(id=db_item.id, description=db_item.description, quantity=db_item.quantity, unit_price=db_item.unit_price, total=db_item.total)
            # Fall back to in-memory if DB invoice not found

    # In-memory fallback
    items = [i for i in _invoice_items[company_id].values() if i.get("invoice_id") == invoice_id]
    subtotal = sum(i.get("total", 0) for i in items)
    inv["subtotal"] = subtotal
    inv["tax_amount"] = subtotal * 0.15
    inv["total"] = inv["subtotal"] + inv["tax_amount"]

    return InvoiceItem(**item_data)



@app.patch("/api/invoices/{invoice_id}/items/{item_id}", response_model=InvoiceItem, tags=["Invoices"])
async def update_invoice_item(invoice_id: str, item_id: str, item: InvoiceItemUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update an invoice item and recalculate invoice totals."""
    # Use DB when available
    if DB_AVAILABLE:
        from db.database import get_db_context
        from db.models import InvoiceItem as DBInvoiceItem, Invoice as DBInvoice
        with get_db_context() as db:
            db_inv = db.query(DBInvoice).filter(DBInvoice.id == invoice_id, DBInvoice.company_id == current_user.company_id).first()
            if db_inv:
                db_item = db.query(DBInvoiceItem).filter(DBInvoiceItem.id == item_id, DBInvoiceItem.invoice_id == invoice_id).first()
                if not db_item:
                    raise HTTPException(status_code=404, detail="Item not found")

                if item.description is not None:
                    db_item.description = item.description
                if item.quantity is not None:
                    db_item.quantity = item.quantity
                if item.unit_price is not None:
                    db_item.unit_price = item.unit_price

                db_item.total = (db_item.quantity or 0) * (db_item.unit_price or 0)
                db.commit()

                items = db.query(DBInvoiceItem).filter(DBInvoiceItem.invoice_id == invoice_id).all()
                subtotal = sum(i.total for i in items)
                db_inv.subtotal = subtotal
                db_inv.tax_amount = subtotal * db_inv.tax_rate
                db_inv.total = db_inv.subtotal + db_inv.tax_amount - getattr(db_inv, 'discount', 0)
                db.commit()

                return InvoiceItem(id=db_item.id, description=db_item.description, quantity=db_item.quantity, unit_price=db_item.unit_price, total=db_item.total)
            # fall back to in-memory

    # In-memory fallback
    inv = _invoices.get(invoice_id)
    if not inv or inv.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    company_id = current_user.company_id
    if company_id not in _invoice_items or item_id not in _invoice_items[company_id]:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data = _invoice_items[company_id][item_id]
    if item_data.get("invoice_id") != invoice_id:
        raise HTTPException(status_code=404, detail="Item not found for this invoice")

    # Update fields
    if item.description is not None:
        item_data["description"] = item.description
    if item.quantity is not None:
        item_data["quantity"] = item.quantity
    if item.unit_price is not None:
        item_data["unit_price"] = item.unit_price

    # Recalculate item total
    item_data["total"] = item_data.get("quantity", 0) * item_data.get("unit_price", 0)

    # Recalculate invoice totals
    items = [i for i in _invoice_items[company_id].values() if i.get("invoice_id") == invoice_id]
    subtotal = sum(i.get("total", 0) for i in items)
    inv["subtotal"] = subtotal
    inv["tax_amount"] = subtotal * 0.15
    inv["total"] = inv["subtotal"] + inv["tax_amount"]

    return InvoiceItem(**item_data)


@app.delete("/api/invoices/{invoice_id}/items/{item_id}", status_code=204, tags=["Invoices"])
async def delete_invoice_item(invoice_id: str, item_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete an invoice item and recalculate invoice totals."""
    # Use DB when available
    if DB_AVAILABLE:
        from db.database import get_db_context
        from db.models import InvoiceItem as DBInvoiceItem, Invoice as DBInvoice
        with get_db_context() as db:
            db_inv = db.query(DBInvoice).filter(DBInvoice.id == invoice_id, DBInvoice.company_id == current_user.company_id).first()
            if db_inv:
                db_item = db.query(DBInvoiceItem).filter(DBInvoiceItem.id == item_id, DBInvoiceItem.invoice_id == invoice_id).first()
                if not db_item:
                    raise HTTPException(status_code=404, detail="Item not found")

                db.delete(db_item)
                db.commit()

                items = db.query(DBInvoiceItem).filter(DBInvoiceItem.invoice_id == invoice_id).all()
                subtotal = sum(i.total for i in items)
                db_inv.subtotal = subtotal
                db_inv.tax_amount = subtotal * db_inv.tax_rate
                db_inv.total = db_inv.subtotal + db_inv.tax_amount - getattr(db_inv, 'discount', 0)
                db.commit()
                return
            # fall back to in-memory

    inv = _invoices.get(invoice_id)
    if not inv or inv.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    company_id = current_user.company_id
    if company_id not in _invoice_items or item_id not in _invoice_items[company_id]:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data = _invoice_items[company_id][item_id]
    if item_data.get("invoice_id") != invoice_id:
        raise HTTPException(status_code=404, detail="Item not found for this invoice")

    # Remove the item
    del _invoice_items[company_id][item_id]

    # Recalculate invoice totals
    items = [i for i in _invoice_items[company_id].values() if i.get("invoice_id") == invoice_id]
    subtotal = sum(i.get("total", 0) for i in items)
    inv["subtotal"] = subtotal
    inv["tax_amount"] = subtotal * 0.15
    inv["total"] = inv["subtotal"] + inv["tax_amount"]

    return


# =============================================================================
# Appointments Endpoints
# =============================================================================

@app.get("/api/appointments", response_model=List[AppointmentResponse], tags=["Appointments"])
async def list_appointments(
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    company_id = current_user.company_id
    company_appts = _appointments.get(company_id, {})
    appts = list(company_appts.values())
    if search:
        q = search.strip().lower()
        def _val(v: Any) -> str:
            return str(v or "").lower()
        def _matches(a: dict) -> bool:
            cust = _customers.get(a.get("customer_id") or "") or {}
            veh = _vehicles.get(a.get("vehicle_id") or "") or {}
            return q in " ".join([
                _val(a.get("title")),
                _val(a.get("type")),
                _val(a.get("status")),
                _val(cust.get("name")),
                _val(veh.get("registration")),
                _val(veh.get("vin")),
            ])
        appts = [a for a in appts if _matches(a)]
    return [AppointmentResponse(**a) for a in appts]


@app.post("/api/appointments", response_model=AppointmentResponse, status_code=201, tags=["Appointments"])
async def create_appointment(
    appointment: AppointmentCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    company_id = current_user.company_id
    if company_id not in _appointments:
        _appointments[company_id] = {}
        
    appt_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Base data from appointment model
    appt_data = appointment.model_dump()
    
    # Add/Override required response fields
    appt_data.update({
        "id": appt_id,
        "company_id": company_id,
        "created_at": now,
        "updated_at": now,
        "reminder_sent": False
    })
    
    _appointments[company_id][appt_id] = appt_data
    return appt_data


@app.get("/api/appointments/{appointment_id}", response_model=AppointmentResponse, tags=["Appointments"])
async def get_appointment(appointment_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific appointment by ID if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _appointments or appointment_id not in _appointments[company_id]:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    return _appointments[company_id][appointment_id]


@app.patch("/api/appointments/{appointment_id}", response_model=AppointmentResponse, tags=["Appointments"])
async def update_appointment(
    appointment_id: str,
    update: AppointmentUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    company_id = current_user.company_id
    company_appts = _appointments.get(company_id, {})
    if appointment_id not in company_appts:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    appt = company_appts[appointment_id]
    
    # Update with new data
    update_data = update.model_dump(exclude_unset=True)
    appt.update(update_data)
    appt["updated_at"] = datetime.utcnow()
    
    return appt


@app.delete("/api/appointments/{appointment_id}", status_code=204, tags=["Appointments"])
async def delete_appointment(appointment_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete an appointment if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _appointments or appointment_id not in _appointments[company_id]:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    del _appointments[company_id][appointment_id]
    return None


# =============================================================================
# Warranties Endpoints
# =============================================================================

@app.get("/api/warranties", response_model=List[WarrantyResponse], tags=["Warranties"])
async def list_warranties(
    current_user: UserResponse = Depends(get_current_user)
):
    company_id = current_user.company_id
    company_warrs = _warranties.get(company_id, {})
    return [WarrantyResponse(**w) for w in company_warrs.values()]


@app.post("/api/warranties", response_model=WarrantyResponse, status_code=201, tags=["Warranties"])
async def create_warranty(
    warranty: WarrantyCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    company_id = current_user.company_id
    if company_id not in _warranties:
        _warranties[company_id] = {}
        
    warranty_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    warranty_data = warranty.model_dump()
    warranty_data.update({
        "id": warranty_id,
        "company_id": company_id,
        "created_at": now,
        "updated_at": now
    })
    
    _warranties[company_id][warranty_id] = warranty_data
    return warranty_data


@app.get("/api/warranties/{warranty_id}", response_model=WarrantyResponse, tags=["Warranties"])
async def get_warranty(warranty_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific warranty by ID if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _warranties or warranty_id not in _warranties[company_id]:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    return _warranties[company_id][warranty_id]


@app.patch("/api/warranties/{warranty_id}", response_model=WarrantyResponse, tags=["Warranties"])
async def update_warranty(warranty_id: str, update: WarrantyUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a warranty if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _warranties or warranty_id not in _warranties[company_id]:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    warranty_data = _warranties[company_id][warranty_id]
    update_data = update.model_dump(exclude_unset=True)
    warranty_data.update(update_data)
    warranty_data["updated_at"] = datetime.utcnow()
    
    return warranty_data


@app.delete("/api/warranties/{warranty_id}", status_code=204, tags=["Warranties"])
async def delete_warranty(warranty_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a warranty if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _warranties or warranty_id not in _warranties[company_id]:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    del _warranties[company_id][warranty_id]
    return None


# =============================================================================
# Job Attachments Endpoints
# =============================================================================

@app.get("/api/jobs/{job_id}/attachments", response_model=List[JobAttachmentResponse], tags=["Attachments"])
async def list_job_attachments(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    """List all attachments for a job if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if company_id not in _attachments:
        return []
    
    attachments = [a for a in _attachments[company_id].values() if a.get("job_id") == job_id]
    return [JobAttachmentResponse(**a) for a in attachments]


@app.post("/api/jobs/{job_id}/attachments", response_model=JobAttachmentResponse, status_code=201, tags=["Attachments"])
async def create_job_attachment(
    job_id: str,
    attachment: JobAttachmentCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Create a new attachment for a job.
    
    Note: In production, file_url should come from Firebase Storage upload.
    This endpoint expects the file to already be uploaded and accessible via file_url.
    """
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    attachment_id = str(uuid.uuid4())
    attachment_data = {
        "id": attachment_id,
        "company_id": company_id,
        "job_id": job_id,
        "uploaded_by": current_user.id,
        "upload_date": datetime.utcnow(),
        **attachment.model_dump(),
    }
    
    if company_id not in _attachments:
        _attachments[company_id] = {}
    
    _attachments[company_id][attachment_id] = attachment_data
    return JobAttachmentResponse(**attachment_data)


@app.delete("/api/jobs/{job_id}/attachments/{attachment_id}", status_code=204, tags=["Attachments"])
async def delete_job_attachment(job_id: str, attachment_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a job attachment if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if company_id not in _attachments or attachment_id not in _attachments[company_id]:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    attachment = _attachments[company_id][attachment_id]
    if attachment.get("job_id") != job_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    del _attachments[company_id][attachment_id]
    return None


# =============================================================================
# Labor Entry Endpoints
# =============================================================================

@app.get("/api/jobs/{job_id}/labor", response_model=List[LaborEntryResponse], tags=["Labor"])
async def list_job_labor(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    """List all labor entries for a job if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if company_id not in _labor_entries:
        return []
    
    labor_entries = [le for le in _labor_entries[company_id].values() if le.get("job_id") == job_id]
    return [LaborEntryResponse(**le) for le in labor_entries]


@app.post("/api/jobs/{job_id}/labor", response_model=LaborEntryResponse, status_code=201, tags=["Jobs"])
async def add_labor_log(
    job_id: str,
    labor: LaborEntryCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    company_id = current_user.company_id
    if job_id not in _jobs or _jobs[job_id]["company_id"] != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if company_id not in _labor_entries:
        _labor_entries[company_id] = {}
        
    labor_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    labor_data = labor.model_dump()
    labor_data.update({
        "id": labor_id,
        "company_id": company_id,
        "created_at": now,
        "updated_at": now,
        "total": labor.hours * labor.rate_per_hour
    })
    
    _labor_entries[company_id][labor_id] = labor_data
    return labor_data


@app.patch("/api/jobs/{job_id}/labor/{labor_id}", response_model=LaborEntryResponse, tags=["Labor"])
async def update_labor_entry(
    job_id: str,
    labor_id: str,
    update: LaborEntryUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update a labor entry if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if company_id not in _labor_entries or labor_id not in _labor_entries[company_id]:
        raise HTTPException(status_code=404, detail="Labor entry not found")
    
    labor_data = _labor_entries[company_id][labor_id]
    if labor_data.get("job_id") != job_id:
        raise HTTPException(status_code=404, detail="Labor entry not found")
    
    update_data = update.model_dump(exclude_unset=True)
    labor_data.update(update_data)
    labor_data["updated_at"] = datetime.utcnow()
    
    return LaborEntryResponse(**labor_data)


@app.delete("/api/jobs/{job_id}/labor/{labor_id}", status_code=204, tags=["Labor"])
async def delete_labor_entry(job_id: str, labor_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a labor entry if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if company_id not in _labor_entries or labor_id not in _labor_entries[company_id]:
        raise HTTPException(status_code=404, detail="Labor entry not found")
    
    labor_data = _labor_entries[company_id][labor_id]
    if labor_data.get("job_id") != job_id:
        raise HTTPException(status_code=404, detail="Labor entry not found")
    
    del _labor_entries[company_id][labor_id]
    return None


# =============================================================================
# Mileage Records Endpoints
# =============================================================================

@app.get("/api/vehicles/{vehicle_id}/mileage", response_model=List[MileageRecordResponse], tags=["Mileage"])
async def list_vehicle_mileage(vehicle_id: str, current_user: UserResponse = Depends(get_current_user)):
    """List all mileage records for a vehicle if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify vehicle exists and belongs to company (through customer)
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle = _vehicles[vehicle_id]
    customer = _customers.get(vehicle.get("owner_id"))
    if not customer or customer.get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if company_id not in _mileage_records:
        return []
    
    mileage_records = [mr for mr in _mileage_records[company_id].values() if mr.get("vehicle_id") == vehicle_id]
    # Sort by recorded_at descending (newest first)
    mileage_records.sort(key=lambda x: x.get("recorded_at", ""), reverse=True)
    return [MileageRecordResponse(**mr) for mr in mileage_records]


@app.post("/api/vehicles/{vehicle_id}/mileage", response_model=MileageRecordResponse, status_code=201, tags=["Mileage"])
async def create_mileage_record(
    vehicle_id: str,
    mileage: MileageRecordCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new mileage record for a vehicle."""
    company_id = current_user.company_id
    
    # Verify vehicle exists and belongs to company
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle = _vehicles[vehicle_id]
    customer = _customers.get(vehicle.get("owner_id"))
    if not customer or customer.get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Verify mileage is for the same vehicle
    if mileage.vehicle_id != vehicle_id:
        raise HTTPException(status_code=400, detail="Mileage vehicle_id must match URL vehicle_id")
    
    mileage_id = str(uuid.uuid4())
    mileage_data = {
        "id": mileage_id,
        "company_id": company_id,
        "recorded_at": datetime.utcnow(),
        **mileage.model_dump(),
    }
    
    if company_id not in _mileage_records:
        _mileage_records[company_id] = {}
    
    _mileage_records[company_id][mileage_id] = mileage_data
    return MileageRecordResponse(**mileage_data)


@app.get("/api/vehicles/{vehicle_id}/mileage/{mileage_id}", response_model=MileageRecordResponse, tags=["Mileage"])
async def get_mileage_record(vehicle_id: str, mileage_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific mileage record if it belongs to the user's company."""
    company_id = current_user.company_id
    
    # Verify vehicle exists and belongs to company
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle = _vehicles[vehicle_id]
    customer = _customers.get(vehicle.get("owner_id"))
    if not customer or customer.get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if company_id not in _mileage_records or mileage_id not in _mileage_records[company_id]:
        raise HTTPException(status_code=404, detail="Mileage record not found")
    
    mileage_data = _mileage_records[company_id][mileage_id]
    if mileage_data.get("vehicle_id") != vehicle_id:
        raise HTTPException(status_code=404, detail="Mileage record not found")
    
    return MileageRecordResponse(**mileage_data)


# =============================================================================
# EV Fleet & Battery RUL Prediction Endpoints
# =============================================================================

@app.post("/api/ev/predict-rul", response_model=RULPrediction, tags=["EV Fleet"])
async def predict_battery_rul(battery_data: EVBatteryData):
    """
    Predict remaining useful life (RUL) for an EV battery.
    
    Uses a machine learning model trained on battery degradation patterns.
    """
    model = get_model()
    
    features = {
        'current_soh': battery_data.current_soh,
        'cycle_count': battery_data.cycle_count,
        'avg_temperature': battery_data.avg_temperature,
        'fast_charge_ratio': battery_data.fast_charge_ratio,
        'age_months': battery_data.age_months,
        'avg_dod': battery_data.avg_dod,
        'capacity_kwh': battery_data.capacity_kwh,
        'ambient_temp_avg': battery_data.ambient_temp_avg,
    }
    
    prediction = model.predict(features)
    return RULPrediction(**prediction)


@app.post("/api/ev/predict-rul/batch", response_model=List[RULPrediction], tags=["EV Fleet"])
async def predict_battery_rul_batch(batteries: List[EVBatteryData]):
    """Predict RUL for multiple batteries."""
    model = get_model()
    
    predictions = []
    for battery in batteries:
        features = battery.model_dump()
        prediction = model.predict(features)
        predictions.append(RULPrediction(**prediction))
    
    return predictions


@app.get("/api/ev/model-info", tags=["EV Fleet"])
async def get_model_info():
    """Get information about the RUL prediction model."""
    model = get_model()
    
    return {
        "is_trained": model.is_trained,
        "training_metrics": model.training_metrics,
        "feature_importance": model.get_feature_importance() if model.is_trained else {},
        "features": model.FEATURE_NAMES,
        "eol_threshold": model.EOL_THRESHOLD,
    }


# =============================================================================
# Payment Processing Helpers
# =============================================================================

def calculate_retry_delay(retry_count: int) -> timedelta:
    """
    Calculate exponential backoff delay for payment retries.
    
    Retry schedule:
    - 1st retry (count=1): 1 hour
    - 2nd retry (count=2): 4 hours  
    - 3rd retry (count=3): 1 day
    - 4th+ retry (count=4+): 3 days max
    
    Args:
        retry_count: Number of retries already attempted
    
    Returns:
        timedelta: Delay before next retry attempt
    """
    if retry_count <= 0:
        return timedelta(hours=1)
    elif retry_count == 1:
        return timedelta(hours=1)
    elif retry_count == 2:
        return timedelta(hours=4)
    elif retry_count == 3:
        return timedelta(days=1)
    else:  # retry_count >= 4
        return timedelta(days=3)


def should_retry_payment(payment_tx) -> bool:
    """
    Determine if a failed payment should be retried.
    
    Criteria:
    - Status is 'Failed'
    - Retry count is less than 5
    - Sufficient time has passed since last retry
    
    Args:
        payment_tx: PaymentTransaction object
    
    Returns:
        bool: True if payment should be retried
    """
    if payment_tx.status != 'Failed':
        return False
    
    if payment_tx.retry_count >= 5:
        logger.info(f"Payment {payment_tx.id} has exceeded max retries (5)")
        return False
    
    if payment_tx.last_retry_at is None:
        # First retry
        return True
    
    # Check if enough time has passed
    delay = calculate_retry_delay(payment_tx.retry_count)
    time_since_last_retry = datetime.utcnow() - payment_tx.last_retry_at
    
    if time_since_last_retry >= delay:
        return True
    
    return False


# =============================================================================
# Payment Processing Endpoints (PayFast)
# =============================================================================

@app.post("/api/payment/create", response_model=dict, tags=["Payments"])
async def create_payment(
    req: PaymentCreateRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Generate PayFast payment URL for an invoice.
    
    Returns the PayFast redirect URL that customer should navigate to for payment.
    """
    invoice_id = req.invoice_id
    company_id = current_user.company_id
    
    # Get invoice from DB or in-memory store
    invoice = None
    if DB_AVAILABLE:
        with get_db_context() as db:
            invoice = db.query(DBInvoice).filter(DBInvoice.id == invoice_id).first()
    
    if not invoice:
        invoice = _invoices.get(invoice_id, {})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Verify company scoping
    if invoice.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Get customer details
    customer_id = invoice.get("customer_id")
    customer = _customers.get(customer_id, {})
    if not customer:
        raise HTTPException(status_code=400, detail="Customer information missing")
    
    # Generate payment URL from PayFast service
    payment_url = payfast_service.generate_payment_url(
        invoice_id=invoice_id,
        invoice_number=invoice.get("number", invoice_id),
        amount=float(invoice.get("total", 0)),
        customer_email=customer.get("email", ""),
        customer_name=customer.get("name", ""),
        description=f"Invoice {invoice.get('number')} - Workshop Services",
        return_url=req.return_url or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment/success",
        cancel_url=req.cancel_url or f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment/cancel",
        notify_url=req.notify_url or f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/api/payment/notify",
    )
    
    # Create payment transaction record (if DB available)
    if DB_AVAILABLE:
        with get_db_context() as db:
            payment_tx = DBPaymentTransaction(
                company_id=company_id,
                invoice_id=invoice_id,
                payment_id=invoice_id,  # Use invoice ID as payment_id for reference
                amount=float(invoice.get("total", 0)),
                status="Pending",
            )
            db.add(payment_tx)
            db.commit()
    
    return {
        "payment_url": payment_url,
        "invoice_id": invoice_id,
        "amount": float(invoice.get("total", 0)),
        "message": "Redirect customer to payment_url to complete payment"
    }


@app.post("/api/payment/notify", status_code=200, tags=["Payments"])
async def payfast_itn_notify(request: Request):
    """
    Handle PayFast Instant Transaction Notification (ITN) webhook.
    
    Called by PayFast after payment attempt. Verifies signature and updates invoice status.
    Sends payment confirmation/failure emails to customer.
    """
    import asyncio
    
    # Get raw POST data
    data = await request.form()
    data_dict = dict(data)
    
    # Extract signature
    signature = data_dict.get('pf_signature', '')
    
    # Verify PayFast signature
    if not payfast_service.verify_webhook_signature(data_dict, signature):
        logger.warning(f"Invalid PayFast signature for payment {data_dict.get('m_payment_id')}")
        return {"status": "error", "message": "Signature verification failed"}
    
    # Validate ITN data
    is_valid, error_msg = payfast_service.validate_itn_data(data_dict)
    if not is_valid:
        logger.warning(f"Invalid ITN data: {error_msg}")
        return {"status": "error", "message": error_msg}
    
    # Extract key fields
    invoice_id = data_dict.get('m_payment_id')
    pf_payment_id = data_dict.get('pf_payment_id')
    pf_status = data_dict.get('pf_payment_status', '').upper()
    amount = float(data_dict.get('pf_amount', 0))
    
    logger.info(f"PayFast ITN: invoice={invoice_id}, pf_id={pf_payment_id}, status={pf_status}")
    
    customer_email = None
    customer_name = None
    customer_phone = None
    invoice_number = None
    company_name = None
    
    # Update payment transaction in DB
    if DB_AVAILABLE:
        with get_db_context() as db:
            # Find existing payment transaction
            payment_tx = db.query(DBPaymentTransaction).filter(
                DBPaymentTransaction.payment_id == invoice_id
            ).first()
            
            if payment_tx:
                payment_tx.pf_payment_id = pf_payment_id
                payment_tx.status = pf_status
                payment_tx.signature_valid = True
                payment_tx.signature_hash = signature
                payment_tx.amount_gross = float(data_dict.get('amount_gross', amount))
                payment_tx.amount_fee = float(data_dict.get('amount_fee', 0))
                payment_tx.amount_net = float(data_dict.get('amount_net', 0))
                payment_tx.payfast_response = data_dict
                
                if pf_status == 'COMPLETE':
                    payment_tx.completed_at = datetime.utcnow()
                    payment_tx.status = 'Complete'
                elif pf_status == 'FAILED':
                    payment_tx.status = 'Failed'
                    payment_tx.error_message = data_dict.get('reason_code', 'Payment failed')
                elif pf_status == 'PENDING':
                    payment_tx.status = 'Pending'
                
                db.commit()
                
                # Update invoice status if payment complete
                invoice = db.query(DBInvoice).filter(
                    DBInvoice.id == invoice_id
                ).first()
                
                if invoice:
                    # Get customer and company details for notifications
                    customer = db.query(DBCustomer).filter(
                        DBCustomer.id == invoice.customer_id
                    ).first()
                    
                    company = db.query(DBCompany).filter(
                        DBCompany.id == invoice.company_id
                    ).first()
                    
                    if customer:
                        customer_email = customer.email
                        customer_name = customer.name
                        customer_phone = customer.phone
                        invoice_number = invoice.invoice_number
                    
                    if company:
                        company_name = company.name
                    
                    if pf_status == 'COMPLETE':
                        invoice.status = 'Paid'
                        invoice.paid_at = datetime.utcnow()
                        invoice.payment_method = 'PayFast'
                        db.commit()
                        
                        logger.info(f"Invoice {invoice_id} marked as paid via PayFast")
                    elif pf_status == 'FAILED':
                        invoice.status = 'Overdue'  # Mark as overdue if payment fails
                        db.commit()
                        logger.info(f"Invoice {invoice_id} payment failed, marked as overdue")
    else:
        # Update in-memory invoice
        if invoice_id in _invoices:
            if pf_status == 'COMPLETE':
                _invoices[invoice_id]['status'] = InvoiceStatus.PAID
                _invoices[invoice_id]['paid_at'] = datetime.utcnow()
                _invoices[invoice_id]['payment_method'] = 'PayFast'
                invoice_number = _invoices[invoice_id].get('invoice_number')
    
    # Send notifications asynchronously (non-blocking)
    if customer_email and customer_name and invoice_number:
        async def send_notifications_async():
            try:
                if pf_status == 'COMPLETE':
                    # Send email confirmation
                    await email_service.send_payment_confirmation(
                        customer_email=customer_email,
                        customer_name=customer_name,
                        invoice_number=invoice_number,
                        amount=amount,
                        payment_method='PayFast',
                        job_id=None
                    )
                    
                    # Send SMS confirmation if phone is available
                    if customer_phone:
                        await sms_service.send_payment_confirmation(
                            customer_phone=customer_phone,
                            customer_name=customer_name,
                            invoice_number=invoice_number,
                            amount=amount,
                            company_name=company_name or 'Workshop Management System'
                        )
                    
                elif pf_status == 'FAILED':
                    reason = data_dict.get('reason_code', 'Payment was declined')
                    
                    # Send email notification
                    await email_service.send_payment_failed(
                        customer_email=customer_email,
                        customer_name=customer_name,
                        invoice_number=invoice_number,
                        amount=amount,
                        reason=reason
                    )
                    
                    # Send SMS notification if phone is available
                    if customer_phone:
                        await sms_service.send_payment_failed(
                            customer_phone=customer_phone,
                            customer_name=customer_name,
                            invoice_number=invoice_number,
                            amount=amount,
                            company_name=company_name or 'Workshop Management System'
                        )
            except Exception as e:
                logger.error(f"Failed to send payment notifications: {e}")
        
        # Schedule notification sending without blocking webhook response
        asyncio.create_task(send_notifications_async())
    
    return {"status": "success", "message": "ITN processed"}


@app.get("/api/payment/verify/{invoice_id}", response_model=PaymentVerifyResponse, tags=["Payments"])
async def verify_payment(
    invoice_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Verify payment status for an invoice.
    
    Returns the current payment status from the payment transaction record.
    """
    company_id = current_user.company_id
    
    # Get payment transaction from DB
    payment_tx = None
    if DB_AVAILABLE:
        with get_db_context() as db:
            payment_tx = db.query(DBPaymentTransaction).filter(
                DBPaymentTransaction.invoice_id == invoice_id,
                DBPaymentTransaction.company_id == company_id
            ).first()
    
    if not payment_tx:
        raise HTTPException(status_code=404, detail="Payment not found for this invoice")
    
    # Get invoice to return final status
    invoice = _invoices.get(invoice_id, {})
    if DB_AVAILABLE:
        with get_db_context() as db:
            db_invoice = db.query(DBInvoice).filter(DBInvoice.id == invoice_id).first()
            if db_invoice:
                invoice = {
                    "id": db_invoice.id,
                    "status": db_invoice.status.value if hasattr(db_invoice.status, 'value') else str(db_invoice.status),
                    "total": db_invoice.total,
                    "paid_at": db_invoice.paid_at,
                }
    
    return PaymentVerifyResponse(
        invoice_id=invoice_id,
        status=invoice.get("status", payment_tx.status),
        amount=payment_tx.amount,
        payment_id=payment_tx.payment_id,
        pf_payment_id=payment_tx.pf_payment_id,
        completed_at=payment_tx.completed_at,
    )


@app.post("/api/payment/retry", response_model=dict, tags=["Payments"])
async def retry_payment(
    req: PaymentRetryRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Retry a failed payment by generating a new PayFast payment URL.
    
    Uses exponential backoff to limit retry frequency.
    Max 5 retry attempts allowed before manual intervention required.
    """


# Additional payment endpoints: history, refund, reminders


@app.get("/api/payment/history/{invoice_id}", response_model=List[PaymentResponse], tags=["Payments"])
async def payment_history(
    invoice_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Return all payment transactions for a given invoice."""
    company_id = current_user.company_id
    results = []
    if DB_AVAILABLE:
        with get_db_context() as db:
            txs = db.query(DBPaymentTransaction).filter(
                DBPaymentTransaction.invoice_id == invoice_id,
                DBPaymentTransaction.company_id == company_id
            ).order_by(DBPaymentTransaction.created_at.desc()).all()
            for tx in txs:
                results.append(PaymentResponse.from_orm(tx))
    else:
        for tx in _payment_transactions.values():
            if tx.get("invoice_id") == invoice_id and tx.get("company_id") == company_id:
                results.append(PaymentResponse(**tx))
    return results


class PaymentRefundRequest(BaseModel):
    payment_id: str
    amount: Optional[float] = None
    reason: Optional[str] = None


@app.post("/api/payment/refund", response_model=dict, tags=["Payments"])
async def refund_payment(
    req: PaymentRefundRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Mark a payment transaction as refunded and update invoice status."""
    company_id = current_user.company_id
    payment_tx = None
    invoice = None
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            payment_tx = db.query(DBPaymentTransaction).filter(
                DBPaymentTransaction.payment_id == req.payment_id,
                DBPaymentTransaction.company_id == company_id
            ).first()
            if not payment_tx:
                raise HTTPException(status_code=404, detail="Payment not found")
            
            # mark as cancelled/refunded
            payment_tx.status = 'Cancelled'
            if req.reason:
                payment_tx.error_message = req.reason
            payment_tx.payfast_response = payment_tx.payfast_response or {}
            payment_tx.payfast_response['refund_requested'] = True
            payment_tx.payfast_response['refund_amount'] = req.amount
            db.commit()
            
            invoice = db.query(DBInvoice).filter(DBInvoice.id == payment_tx.invoice_id).first()
            if invoice:
                invoice.status = 'Cancelled'
                db.commit()
    else:
        if req.payment_id in _payment_transactions:
            tx = _payment_transactions[req.payment_id]
            tx['status'] = 'Cancelled'
            if req.reason:
                tx['error_message'] = req.reason
            tx.setdefault('payfast_response', {})['refund_requested'] = True
            invoice = _invoices.get(tx.get('invoice_id'))
            if invoice:
                invoice['status'] = InvoiceStatus.CANCELLED
    
    return {"status": "success", "message": "Payment marked as refunded/cancelled"}


@app.post("/api/invoices/{invoice_id}/reminder", response_model=dict, tags=["Payments"])
async def send_payment_reminder(
    invoice_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Send payment reminder email/SMS for an overdue invoice."""
    company_id = current_user.company_id
    invoice = None
    customer = None
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            invoice = db.query(DBInvoice).filter(
                DBInvoice.id == invoice_id,
                DBInvoice.company_id == company_id
            ).first()
            if invoice:
                customer = db.query(DBCustomer).filter(DBCustomer.id == invoice.customer_id).first()
    else:
        invoice = _invoices.get(invoice_id)
        if invoice and invoice.get('company_id') == company_id:
            customer = _customers.get(invoice.get('customer_id'))
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    amount = invoice.total if hasattr(invoice, 'total') else invoice.get('total', 0)
    email_sent = False
    sms_sent = False
    
    # send notifications
    email_sent = await email_service.send_payment_reminder(
        customer_email=customer.email,
        customer_name=customer.name,
        invoice_number=invoice.invoice_number if hasattr(invoice, 'invoice_number') else invoice.get('invoice_number'),
        amount=amount,
        due_date=invoice.due_date.strftime('%Y-%m-%d') if hasattr(invoice, 'due_date') else str(invoice.get('due_date'))
    )
    
    if hasattr(customer, 'phone') and customer.phone:
        sms_sent = await sms_service.send_payment_reminder(
            customer_phone=customer.phone,
            customer_name=customer.name,
            invoice_number=invoice.invoice_number if hasattr(invoice, 'invoice_number') else invoice.get('invoice_number'),
            amount=amount,
            due_date=invoice.due_date.strftime('%Y-%m-%d') if hasattr(invoice, 'due_date') else str(invoice.get('due_date'))
        )
    
    return {"email_sent": email_sent, "sms_sent": sms_sent}


# =============================================================================

# Analytics & Dashboard Endpoints
# =============================================================================
    payment_id = req.payment_id
    company_id = current_user.company_id
    
    # Get payment transaction from DB
    payment_tx = None
    invoice = None
    customer = None
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            payment_tx = db.query(DBPaymentTransaction).filter(
                DBPaymentTransaction.payment_id == payment_id,
                DBPaymentTransaction.company_id == company_id
            ).first()
            
            if not payment_tx:
                raise HTTPException(status_code=404, detail="Payment not found")
            
            # Check if payment can be retried
            if payment_tx.status != 'Failed':
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot retry payment with status '{payment_tx.status}'. Only failed payments can be retried."
                )
            
            if payment_tx.retry_count >= 5:
                raise HTTPException(
                    status_code=400,
                    detail="Maximum retry attempts (5) exceeded. Please contact support."
                )
            
            # Check if enough time has passed for retry
            if not should_retry_payment(payment_tx):
                delay = calculate_retry_delay(payment_tx.retry_count)
                next_retry_time = payment_tx.last_retry_at + delay
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait until {next_retry_time.isoformat()} before retrying. Exponential backoff in effect."
                )
            
            # Get invoice and customer details
            invoice = db.query(DBInvoice).filter(
                DBInvoice.id == payment_tx.invoice_id
            ).first()
            
            if invoice:
                customer = db.query(DBCustomer).filter(
                    DBCustomer.id == invoice.customer_id
                ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Associated invoice not found")
    
    if not customer:
        raise HTTPException(status_code=400, detail="Customer information missing")
    
    # Generate new payment URL for retry
    payment_url = payfast_service.generate_payment_url(
        invoice_id=str(invoice.id),
        invoice_number=invoice.invoice_number,
        amount=float(invoice.total),
        customer_email=customer.email,
        customer_name=customer.name,
        description=f"Retry: Invoice {invoice.invoice_number} - Workshop Services (Attempt {payment_tx.retry_count + 1})",
        return_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment/success",
        cancel_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment/cancel",
        notify_url=f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/api/payment/notify",
    )
    
    # Update retry tracking in DB
    if DB_AVAILABLE:
        with get_db_context() as db:
            payment_tx = db.query(DBPaymentTransaction).filter(
                DBPaymentTransaction.payment_id == payment_id
            ).first()
            
            if payment_tx:
                payment_tx.retry_count += 1
                payment_tx.last_retry_at = datetime.utcnow()
                db.commit()
                
                logger.info(f"Payment retry initiated: {payment_id}, attempt #{payment_tx.retry_count}")
    
    return {
        "payment_url": payment_url,
        "invoice_id": str(invoice.id),
        "amount": float(invoice.total),
        "retry_count": payment_tx.retry_count + 1 if payment_tx else 1,
        "message": "Retry payment URL generated. Redirect customer to payment_url to complete payment."
    }


# =============================================================================

# Analytics & Dashboard Endpoints
# =============================================================================

@app.get("/api/analytics/dashboard", response_model=DashboardStats, tags=["Analytics"])
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get dashboard statistics scoped to the current user's company."""
    company_id = current_user.company_id
    jobs = [j for j in _jobs.values() if j.get("company_id") == company_id]
    customers = [c for c in _customers.values() if c.get("company_id") == company_id]
    vehicles = [v for v in _vehicles.values() if _customers.get(v.get("owner_id"), {}).get("company_id") == company_id]
    parts = [p for p in _parts.values() if p.get("company_id") == company_id]
    invoices = [i for i in _invoices.values() if i.get("company_id") == company_id]
    
    return DashboardStats(
        total_jobs=len(jobs),
        pending_jobs=sum(1 for j in jobs if j.get("status") == JobStatus.PENDING),
        in_progress_jobs=sum(1 for j in jobs if j.get("status") == JobStatus.IN_PROGRESS),
        completed_jobs=sum(1 for j in jobs if j.get("status") in [JobStatus.COMPLETED, JobStatus.PAID]),
        total_revenue=sum(i.get("total", 0) for i in invoices if i.get("status") == InvoiceStatus.PAID),
        total_customers=len(customers),
        total_vehicles=len(vehicles),
        low_stock_count=sum(1 for p in parts if p.get("quantity", 0) <= p.get("min_level", 0)),
    )


@app.get("/api/analytics/revenue", tags=["Analytics"])
async def get_revenue_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get revenue analytics over time for the current user's company."""
    company_id = current_user.company_id
    invoices = [i for i in _invoices.values() if i.get("company_id") == company_id]
    total_revenue = sum(i.get("total", 0) for i in invoices if i.get("status") == InvoiceStatus.PAID)
    # Simple monthly trend derived from invoice issue_date
    monthly = {}
    for inv in invoices:
        month = inv.get("issue_date").strftime("%b") if isinstance(inv.get("issue_date"), datetime) else "N/A"
        monthly[month] = monthly.get(month, 0) + inv.get("total", 0)

    return {
        "total_revenue": total_revenue,
        "average_job_value": (total_revenue / max(1, sum(1 for i in invoices if i.get("type") == "Invoice"))),
        "revenue_by_service": {},
        "monthly_trend": [{"month": m, "revenue": v} for m, v in monthly.items()],
    }


@app.get("/api/analytics/jobs", tags=["Analytics"])
async def get_job_analytics(current_user: UserResponse = Depends(get_current_user)):
    """Get job analytics scoped to the user's company."""
    company_id = current_user.company_id
    jobs = [j for j in _jobs.values() if j.get("company_id") == company_id]
    
    return {
        "total": len(jobs),
        "by_status": {
            status.value: sum(1 for j in jobs if j.get("status") == status)
            for status in JobStatus
        },
        "by_priority": {
            priority.value: sum(1 for j in jobs if j.get("priority") == priority)
            for priority in Priority
        },
        "average_completion_days": 3.5,
    }


@app.get("/api/analytics/invoices/aging", response_model=InvoiceAgingReport, tags=["Analytics"])
async def get_invoice_aging_report(current_user: UserResponse = Depends(get_current_user)):
    """
    Get invoice aging report showing overdue invoices awaiting payment.
    
    Groups invoices by age: 0-30 days, 31-60 days, 61-90 days, 90+ days overdue.
    """
    company_id = current_user.company_id
    today = datetime.utcnow().date()
    
    # Get all overdue invoices scoped to company
    overdue_invoices = []
    
    if DB_AVAILABLE:
        with get_db_context() as db:
            # Query for unpaid invoices past due date
            invoices = db.query(DBInvoice).filter(
                DBInvoice.company_id == company_id,
                DBInvoice.status.in_(['Draft', 'Sent', 'Overdue']),
                DBInvoice.due_date <= datetime.utcnow()
            ).all()
            
            for invoice in invoices:
                days_overdue = (today - invoice.due_date.date()).days
                if days_overdue >= 0:
                    overdue_invoices.append({
                        'id': invoice.id,
                        'invoice_number': invoice.invoice_number,
                        'customer_name': invoice.customer.name if invoice.customer else 'Unknown',
                        'amount': invoice.total,
                        'due_date': invoice.due_date,
                        'days_overdue': days_overdue,
                        'status': invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status),
                    })
    else:
        # Use in-memory store
        invoices = _invoices.values()
        for invoice in invoices:
            if invoice.get("company_id") != company_id:
                continue
            if invoice.get("status") not in [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.OVERDUE]:
                continue
            
            due_date = invoice.get("due_date")
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date)
            
            if due_date <= datetime.utcnow():
                days_overdue = (today - due_date.date()).days
                if days_overdue >= 0:
                    customer = _customers.get(invoice.get("customer_id"), {})
                    overdue_invoices.append({
                        'id': invoice.get('id'),
                        'invoice_number': invoice.get('invoice_number', ''),
                        'customer_name': customer.get('name', 'Unknown'),
                        'amount': invoice.get('total', 0),
                        'due_date': due_date,
                        'days_overdue': days_overdue,
                        'status': invoice.get('status', 'Unknown'),
                    })
    
    # Sort by days overdue (most overdue first)
    overdue_invoices.sort(key=lambda x: x['days_overdue'], reverse=True)
    
    # Group by age
    age_groups = [
        {'label': '0-30 days overdue', 'min_days': 0, 'max_days': 30},
        {'label': '31-60 days overdue', 'min_days': 31, 'max_days': 60},
        {'label': '61-90 days overdue', 'min_days': 61, 'max_days': 90},
        {'label': '90+ days overdue', 'min_days': 91, 'max_days': 999},
    ]
    
    age_group_results = []
    for group in age_groups:
        matching = [
            inv for inv in overdue_invoices
            if group['min_days'] <= inv['days_overdue'] <= group['max_days']
        ]
        
        group_result = InvoiceAgeGroup(
            label=group['label'],
            min_days=group['min_days'],
            max_days=group['max_days'],
            count=len(matching),
            total_amount=sum(inv['amount'] for inv in matching)
        )
        age_group_results.append(group_result)
    
    total_overdue_amount = sum(inv['amount'] for inv in overdue_invoices)
    
    return InvoiceAgingReport(
        generated_at=datetime.utcnow(),
        total_overdue_amount=total_overdue_amount,
        total_overdue_count=len(overdue_invoices),
        age_groups=age_group_results,
        invoices=overdue_invoices
    )


# =============================================================================
# Messaging Endpoints
# =============================================================================

class SendMessageRequest(BaseModel):
    """Request to send SMS/WhatsApp message."""
    template_id: str = Field(..., description="Message template ID (job_received, appointment_confirmation, etc.)")
    customer_id: str = Field(..., description="Customer ID")
    variables: Dict[str, str] = Field(..., description="Template variables for rendering")
    trigger_event: str = Field(..., description="Event that triggered the message")
    job_id: Optional[str] = None
    invoice_id: Optional[str] = None
    appointment_id: Optional[str] = None


@app.post("/api/messages/send", response_model=dict, tags=["Messaging"])
async def send_message(
    req: SendMessageRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send SMS/WhatsApp message based on template.
    
    Triggers:
    - job_received: When job is created
    - job_in_progress: When job status changes to "In Progress"
    - job_ready: When job is awaiting pickup/delivery
    - job_completion: When job is completed
    - appointment_confirmation: When appointment is scheduled
    - appointment_reminder: 24 hours before appointment
    - invoice_created: When invoice is generated
    - invoice_reminder: For overdue invoices
    - payment_confirmed: When payment is received
    - satisfaction_survey: Post-job completion
    """
    try:
        # Get customer for phone number
        if DB_AVAILABLE and db:
            customer = db.query(DBCustomer).filter(DBCustomer.id == req.customer_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            
            recipient_phone = customer.phone
        else:
            # Fallback to in-memory
            customer = _customers.get(req.customer_id, {})
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            recipient_phone = customer.get('phone', '')
        
        # Get company ID from current user
        company_id = current_user.company_id
        
        # Create messaging service with SMS service
        messaging_svc = MessagingService(sms_service=sms_service, db=db)
        
        # Send message
        success = await messaging_svc.send_message(
            template_id=req.template_id,
            customer_id=req.customer_id,
            company_id=company_id,
            recipient_phone=recipient_phone,
            variables=req.variables,
            trigger_event=req.trigger_event,
            job_id=req.job_id,
            invoice_id=req.invoice_id,
            appointment_id=req.appointment_id,
        )
        
        return {
            "success": success,
            "message": "Message sent successfully" if success else "Failed to send message",
            "template_id": req.template_id,
            "customer_id": req.customer_id,
            "trigger_event": req.trigger_event,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/messages/templates", response_model=dict, tags=["Messaging"])
async def get_message_templates(current_user: UserResponse = Depends(get_current_user)):
    """
    Get available message templates.
    
    Templates:
    - job_received, job_in_progress, job_ready, job_completion
    - appointment_confirmation, appointment_reminder
    - invoice_created, invoice_reminder
    - payment_confirmed
    - satisfaction_survey
    """
    templates = {}
    for template_id, template_info in MessagingTemplates.TEMPLATES.items():
        templates[template_id] = {
            'name': template_info['name'],
            'channel': template_info['channel'],
            'variables': [
                var.strip('{}')
                for var in set(
                    s for s in template_info['content'].split()
                    if s.startswith('{') and s.endswith('}')
                )
            ]
        }
    
    return {"templates": templates}


@app.get("/api/messages/history", response_model=list, tags=["Messaging"])
async def get_message_history(
    limit: int = Query(100, ge=1, le=1000),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get message sending history for current company."""
    if not DB_AVAILABLE or not db:
        return []
    
    try:
        company_id = current_user.company_id
        
        messages = db.query(DBMessageLog)\
            .filter(DBMessageLog.company_id == company_id)\
            .order_by(DBMessageLog.created_at.desc())\
            .limit(limit)\
            .all()
        
        return [
            {
                'id': msg.id,
                'template_id': msg.template_id,
                'template_name': msg.template_name,
                'customer_id': msg.customer_id,
                'recipient_phone': msg.recipient_phone,
                'channel': msg.channel.value,
                'status': msg.status.value,
                'trigger_event': msg.trigger_event,
                'sent_at': msg.sent_at.isoformat() if msg.sent_at else None,
                'created_at': msg.created_at.isoformat(),
            }
            for msg in messages
        ]
    except Exception as e:
        logger.error(f"Error retrieving message history: {e}")
        return []


# =============================================================================
# User Invitation Endpoints
# =============================================================================

@app.post("/api/admin/users/invite", response_model=Dict[str, Any], tags=["Admin"])
async def invite_user(
    invitation: UserInvitationCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Invite a new user to join the company via email."""
    if not DB_AVAILABLE or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check if current user is admin
    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can invite users")
    
    try:
        # Enforce subscription user limit (counts pending invites)
        _enforce_user_limit_for_invite(current_user.company_id, db=db)

        # Create invitation via async session
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
        from sqlalchemy import select
        
        # Use sync session to check and create
        existing_user = db.query(DBUser).filter(DBUser.email == invitation.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        existing_invite = db.query(DBUserInvitation).filter(
            DBUserInvitation.email == invitation.email,
            DBUserInvitation.company_id == current_user.company_id,
            DBUserInvitation.accepted_at == None
        ).first()
        if existing_invite:
            raise HTTPException(status_code=400, detail="Invitation already sent to this email")
        
        # Create invitation
        token = invitation_service.generate_token()
        expires_at = invitation_service.get_expiry_time()
        
        new_invitation = DBUserInvitation(
            company_id=current_user.company_id,
            email=invitation.email,
            role=invitation.role,
            token=token,
            expires_at=expires_at
        )
        
        db.add(new_invitation)
        db.flush()
        
        # Send email asynchronously
        asyncio.create_task(
            invitation_service._send_invitation_email(
                invitation.email,
                token,
                os.getenv("APP_BASE_URL", "http://localhost:5173")
            )
        )
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Invitation sent to {invitation.email}",
            "invitation": {
                "id": new_invitation.id,
                "email": new_invitation.email,
                "role": invitation.role,
                "created_at": new_invitation.created_at.isoformat(),
                "expires_at": new_invitation.expires_at.isoformat()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating invitation: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating invitation: {str(e)}")


@app.get("/api/admin/users/invitations", response_model=PendingInvitationsResponse, tags=["Admin"])
async def get_pending_invitations(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending invitations for the current company."""
    if not DB_AVAILABLE or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check if current user is admin
    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can view invitations")
    
    try:
        invitations = db.query(DBUserInvitation).filter(
            DBUserInvitation.company_id == current_user.company_id,
            DBUserInvitation.accepted_at == None
        ).order_by(DBUserInvitation.created_at.desc()).all()
        
        invitations_list = [
            PendingInvitationItem(
                id=inv.id,
                email=inv.email,
                role=inv.role.value,
                created_at=inv.created_at.isoformat(),
                expires_at=inv.expires_at.isoformat(),
                is_expired=inv.expires_at < datetime.utcnow()
            )
            for inv in invitations
        ]
        
        return PendingInvitationsResponse(
            invitations=invitations_list,
            total=len(invitations_list)
        )
    except Exception as e:
        logger.error(f"Error retrieving pending invitations: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving invitations")


@app.delete("/api/admin/users/invitations/{invitation_id}", tags=["Admin"])
async def cancel_invitation(
    invitation_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a pending invitation."""
    if not DB_AVAILABLE or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check if current user is admin
    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can cancel invitations")
    
    try:
        invitation = db.query(DBUserInvitation).filter(
            DBUserInvitation.id == invitation_id,
            DBUserInvitation.company_id == current_user.company_id
        ).first()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        if invitation.accepted_at:
            raise HTTPException(status_code=400, detail="Cannot cancel accepted invitation")
        
        db.delete(invitation)
        db.commit()
        
        return {"success": True, "message": "Invitation cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling invitation: {e}")
        raise HTTPException(status_code=500, detail="Error cancelling invitation")


@app.post("/api/invitations/accept", response_model=AcceptInvitationResponse, tags=["Auth"])
async def accept_invitation(
    data: AcceptInvitationRequest,
    db: Session = Depends(get_db)
):
    """Accept an invitation and create user account."""
    if not DB_AVAILABLE or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get invitation by token
        invitation = db.query(DBUserInvitation).filter(
            DBUserInvitation.token == data.token
        ).first()
        
        if not invitation:
            return AcceptInvitationResponse(
                success=False,
                message="Invalid or expired invitation"
            )
        
        # Check if expired
        if invitation.expires_at < datetime.utcnow():
            return AcceptInvitationResponse(
                success=False,
                message="Invitation has expired"
            )
        
        # Check if already accepted
        if invitation.accepted_at:
            return AcceptInvitationResponse(
                success=False,
                message="Invitation already accepted"
            )
        
        # Check if email already exists
        existing_user = db.query(DBUser).filter(DBUser.email == invitation.email).first()
        if existing_user:
            return AcceptInvitationResponse(
                success=False,
                message="Email already registered"
            )

        # Enforce subscription user limit (user creation)
        try:
            _enforce_user_limit_for_create(invitation.company_id, db=db)
        except HTTPException as e:
            return AcceptInvitationResponse(success=False, message=str(e.detail))
        
        # Hash password
        password_hash = hash_password(data.password)
        
        # Create user
        new_user = DBUser(
            company_id=invitation.company_id,
            email=invitation.email,
            name=data.name,
            password_hash=password_hash,
            role=invitation.role,
            email_verified=True
        )
        
        db.add(new_user)
        db.flush()
        
        # Mark invitation as accepted
        invitation.accepted_at = datetime.utcnow()
        db.add(invitation)
        
        db.commit()
        db.refresh(new_user)
        
        user_response = UserResponse(
            id=new_user.id,
            email=new_user.email,
            name=new_user.name,
            role=UserRole[new_user.role.value] if hasattr(new_user.role, 'value') else new_user.role,
            created_at=new_user.created_at,
            company_id=new_user.company_id
        )
        
        return AcceptInvitationResponse(
            success=True,
            message="Account created successfully",
            user=user_response
        )
    except Exception as e:
        logger.error(f"Error accepting invitation: {e}")
        return AcceptInvitationResponse(
            success=False,
            message=f"Error creating account: {str(e)}"
        )


@app.get("/api/invitations/validate/{token}", tags=["Auth"])
async def validate_invitation(
    token: str,
    db: Session = Depends(get_db)
):
    """Validate an invitation token and return invitation details."""
    if not DB_AVAILABLE or not db:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        invitation = db.query(DBUserInvitation).filter(
            DBUserInvitation.token == token
        ).first()
        
        if not invitation:
            return {"valid": False, "message": "Invalid token"}
        
        # Check if expired
        if invitation.expires_at < datetime.utcnow():
            return {"valid": False, "message": "Invitation has expired"}
        
        # Check if already accepted
        if invitation.accepted_at:
            return {"valid": False, "message": "Invitation already accepted"}
        
        return {
            "valid": True,
            "email": invitation.email,
            "role": invitation.role.value if hasattr(invitation.role, 'value') else invitation.role,
            "company_id": invitation.company_id,
            "expires_at": invitation.expires_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Error validating invitation: {e}")
        raise HTTPException(status_code=500, detail="Error validating invitation")


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


@app.get("/api", tags=["System"])
async def api_info():
    """API information."""
    return {
        "name": "Workshop Management System API",
        "version": "1.0.0",
        "endpoints": {
            "auth": ["/api/auth/token", "/api/auth/register", "/api/auth/me"],
            "customers": ["/api/customers"],
            "vehicles": ["/api/vehicles"],
            "jobs": ["/api/jobs"],
            "parts": ["/api/parts"],
            "invoices": ["/api/invoices"],
            "messages": ["/api/messages/send", "/api/messages/templates", "/api/messages/history"],
            "ev": ["/api/ev/predict-rul", "/api/ev/model-info"],
            "analytics": ["/api/analytics/dashboard", "/api/analytics/revenue", "/api/analytics/invoices/aging"],
        },
    }


# =============================================================================
# Include Routers
# =============================================================================

app.include_router(voice_router, prefix="/api")


# =============================================================================
# Run Server
# =============================================================================

# WebSocket endpoint for notifications
@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


# Helper to trigger in-app notifications
async def trigger_notification(user_id: str, title: str, message: str, type: str = "info", link: Optional[str] = None):
    notification_data = {
        "type": "notification",
        "payload": {
            "title": title,
            "message": message,
            "type": type,
            "link": link
        }
    }
    await manager.send_personal_message(notification_data, user_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
