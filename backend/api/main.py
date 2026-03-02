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
import logging
import asyncio
from pathlib import Path
import sys

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

# Database imports (optional — falls back to in-memory if unavailable)
try:
    from sqlalchemy.orm import Session
    from db.database import get_db, get_db_context, engine, SessionLocal
    from db.models import (
        Base, Customer as DBCustomer, Vehicle as DBVehicle,
        Job as DBJob, Part as DBPart, Invoice as DBInvoice, User as DBUser,
        InvoiceItem as DBInvoiceItem, PaymentTransaction as DBPaymentTransaction,
        Company as DBCompany, MessageLog as DBMessageLog,
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

# OAuth2 for JWT authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


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
    due_date: datetime


class JobCreate(JobBase):
    tasks: List[JobTask] = []


class JobUpdate(BaseModel):
    status: Optional[JobStatus] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    estimated_cost: Optional[float] = None


class JobResponse(JobBase):
    id: str
    company_id: str
    status: JobStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    tasks: List[JobTask] = []
    customer_name: Optional[str] = None
    vehicle_info: Optional[str] = None

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
    description: Optional[str] = None


class JobAttachmentCreate(BaseModel):
    filename: str
    file_type: str
    file_size: int
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


class RULPrediction(BaseModel):
    rul_months: float
    rul_cycles: int
    confidence: float
    health_status: str
    current_soh: float
    eol_threshold: float
    recommendations: List[str]


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


# JWT Secret (generate per-instance if not configured)
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

def create_token(user_id: str, email: str, role: str, company_id: str) -> str:
    """Create a simple HMAC-based token."""
    # token payload: userId:email:role:companyId:timestamp
    payload = f"{user_id}:{email}:{role}:{company_id}:{datetime.utcnow().isoformat()}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"

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


@app.post("/api/auth/register", response_model=UserResponse, tags=["Authentication"])
async def register(user: UserCreate):
    """Register a new user."""
    # Check for duplicate email
    for u in _users.values():
        if u.get("email") == user.email:
            raise HTTPException(status_code=409, detail="Email already registered")
    
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
    """Get current authenticated user by decoding our simple token."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # token format: userId:email:role:companyId:timestamp:signature
    parts = token.split(":")
    if len(parts) < 6:
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_id, email, role, company_id = parts[0], parts[1], parts[2], parts[3]
    return UserResponse(
        id=user_id,
        email=email,
        name="",  # not available in token
        role=role,
        company_id=company_id,
        created_at=datetime.now(),
    )


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
        customers = [c for c in customers if search.lower() in c["name"].lower()]
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


# =============================================================================
# Vehicles Endpoints
# =============================================================================

@app.get("/api/vehicles", response_model=List[VehicleResponse], tags=["Vehicles"])
async def list_vehicles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    owner_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all vehicles for the user's company with optional filtering by owner."""
    company_id = current_user.company_id
    vehicles = [v for v in _vehicles.values()
                if _customers.get(v.get("owner_id"), {}).get("company_id") == company_id]
    if owner_id:
        vehicles = [v for v in vehicles if v.get("owner_id") == owner_id]
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
    
    # Set completed_at if status changed to Completed or Paid
    if update.status in [JobStatus.COMPLETED, JobStatus.PAID]:
        job_data["completed_at"] = datetime.now()
    
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
    
    return JobResponse(**job_data)


@app.delete("/api/jobs/{job_id}", status_code=204, tags=["Jobs"])
async def delete_job(job_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Delete a job."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    del _jobs[job_id]


@app.post("/api/jobs/{job_id}/tasks", response_model=JobResponse, tags=["Jobs"])
async def add_job_task(job_id: str, task: JobTask, current_user: UserResponse = Depends(get_current_user)):
    """Add a task to a job."""
    job = _jobs.get(job_id)
    if not job or job.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job.setdefault("tasks", []).append(task.model_dump())
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
    job["estimated_cost"] = job.get("estimated_cost", 0) + (new_total - old_total)

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


# =============================================================================
# Invoices/Quotes Endpoints
# =============================================================================

@app.get("/api/invoices", response_model=List[InvoiceResponse], tags=["Invoices"])
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type: Optional[str] = None,
    status: Optional[InvoiceStatus] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all invoices/quotes for the user's company."""
    company_id = current_user.company_id
    invoices = [inv for inv in _invoices.values() if inv.get("company_id") == company_id]
    if type:
        invoices = [i for i in invoices if i.get("type") == type]
    if status:
        invoices = [i for i in invoices if i.get("status") == status]
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
    
    return InvoiceResponse(**invoice_data)


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
    inv = _invoices.get(invoice_id)
    if not inv or inv.get("company_id") != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    inv["status"] = status
    return InvoiceResponse(**inv)


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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    """List all appointments for the user's company with optional filtering."""
    company_id = current_user.company_id
    if company_id not in _appointments:
        return []
    
    appointments = [a for a in _appointments[company_id].values()]
    
    if status:
        appointments = [a for a in appointments if a.get("status") == status]
    
    return [AppointmentResponse(**a) for a in appointments[skip:skip+limit]]


@app.post("/api/appointments", response_model=AppointmentResponse, status_code=201, tags=["Appointments"])
async def create_appointment(appointment: AppointmentCreate, current_user: UserResponse = Depends(get_current_user)):
    """Create a new appointment for the user's company."""
    appointment_id = str(uuid.uuid4())
    company_id = current_user.company_id
    appointment_data = {
        "id": appointment_id,
        "company_id": company_id,
        **appointment.model_dump(),
    }
    
    if company_id not in _appointments:
        _appointments[company_id] = {}
    
    _appointments[company_id][appointment_id] = appointment_data
    
    # Send "appointment confirmation" notification asynchronously
    try:
        cust = _customers.get(appointment.customer_id, {})
        company = _companies.get(company_id, {})
        workshop_name = company.get('name', 'Workshop')
        
        # Format appointment details
        start_time = appointment.start_time
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        
        variables = {
            'customerName': cust.get('name', 'Customer'),
            'appointmentType': appointment.appointment_type or 'Service',
            'appointmentDate': start_time.strftime('%Y-%m-%d'),
            'appointmentTime': start_time.strftime('%H:%M'),
            'workshopName': workshop_name,
        }
        
        asyncio.create_task(send_appointment_message(
            appointment_id=appointment_id,
            template_id='appointment_confirmation',
            trigger_event='appointment_created',
            variables=variables,
            company_id=company_id,
            customer_id=appointment.customer_id,
        ))
    except Exception as e:
        logger.warning(f"Failed to queue appointment confirmation message: {e}")
    
    return AppointmentResponse(**appointment_data)


@app.get("/api/appointments/{appointment_id}", response_model=AppointmentResponse, tags=["Appointments"])
async def get_appointment(appointment_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific appointment by ID if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _appointments or appointment_id not in _appointments[company_id]:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    return AppointmentResponse(**_appointments[company_id][appointment_id])


@app.patch("/api/appointments/{appointment_id}", response_model=AppointmentResponse, tags=["Appointments"])
async def update_appointment(appointment_id: str, update: AppointmentUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update an appointment if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _appointments or appointment_id not in _appointments[company_id]:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment_data = _appointments[company_id][appointment_id]
    update_data = update.model_dump(exclude_unset=True)
    appointment_data.update(update_data)
    
    return AppointmentResponse(**appointment_data)


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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: UserResponse = Depends(get_current_user),
):
    """List all warranties for the user's company."""
    company_id = current_user.company_id
    if company_id not in _warranties:
        return []
    
    warranties = [w for w in _warranties[company_id].values()]
    return [WarrantyResponse(**w) for w in warranties[skip:skip+limit]]


@app.post("/api/warranties", response_model=WarrantyResponse, status_code=201, tags=["Warranties"])
async def create_warranty(warranty: WarrantyCreate, current_user: UserResponse = Depends(get_current_user)):
    """Create a new warranty for the user's company."""
    warranty_id = str(uuid.uuid4())
    company_id = current_user.company_id
    warranty_data = {
        "id": warranty_id,
        "company_id": company_id,
        **warranty.model_dump(),
    }
    
    if company_id not in _warranties:
        _warranties[company_id] = {}
    
    _warranties[company_id][warranty_id] = warranty_data
    return WarrantyResponse(**warranty_data)


@app.get("/api/warranties/{warranty_id}", response_model=WarrantyResponse, tags=["Warranties"])
async def get_warranty(warranty_id: str, current_user: UserResponse = Depends(get_current_user)):
    """Get a specific warranty by ID if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _warranties or warranty_id not in _warranties[company_id]:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    return WarrantyResponse(**_warranties[company_id][warranty_id])


@app.patch("/api/warranties/{warranty_id}", response_model=WarrantyResponse, tags=["Warranties"])
async def update_warranty(warranty_id: str, update: WarrantyUpdate, current_user: UserResponse = Depends(get_current_user)):
    """Update a warranty if it belongs to the user's company."""
    company_id = current_user.company_id
    if company_id not in _warranties or warranty_id not in _warranties[company_id]:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    warranty_data = _warranties[company_id][warranty_id]
    update_data = update.model_dump(exclude_unset=True)
    warranty_data.update(update_data)
    
    return WarrantyResponse(**warranty_data)


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


@app.post("/api/jobs/{job_id}/labor", response_model=LaborEntryResponse, status_code=201, tags=["Labor"])
async def create_labor_entry(
    job_id: str,
    labor: LaborEntryCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new labor entry for a job."""
    company_id = current_user.company_id
    
    # Verify job exists and belongs to company
    if job_id not in _jobs or _jobs[job_id].get("company_id") != company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Verify labor entry is for the same job
    if labor.job_id != job_id:
        raise HTTPException(status_code=400, detail="Labor entry job_id must match URL job_id")
    
    labor_id = str(uuid.uuid4())
    labor_data = {
        "id": labor_id,
        "company_id": company_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        **labor.model_dump(),
    }
    
    if company_id not in _labor_entries:
        _labor_entries[company_id] = {}
    
    _labor_entries[company_id][labor_id] = labor_data
    return LaborEntryResponse(**labor_data)


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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
