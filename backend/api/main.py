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

from fastapi import FastAPI, HTTPException, Depends, status, Query
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
from pathlib import Path
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.ev_rul_model import get_model, EVBatteryRULModel

# Voice router
from api.voice import router as voice_router

# Database imports (optional — falls back to in-memory if unavailable)
try:
    from sqlalchemy.orm import Session
    from db.database import get_db, engine, SessionLocal
    from db.models import (
        Base, Customer as DBCustomer, Vehicle as DBVehicle,
        Job as DBJob, Part as DBPart, Invoice as DBInvoice, User as DBUser,
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
    
    job_data = job
    update_data = update.model_dump(exclude_unset=True)
    job_data.update(update_data)
    
    # Set completed_at if status changed to Completed or Paid
    if update.status in [JobStatus.COMPLETED, JobStatus.PAID]:
        job_data["completed_at"] = datetime.now()
    
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
            "ev": ["/api/ev/predict-rul", "/api/ev/model-info"],
            "analytics": ["/api/analytics/dashboard", "/api/analytics/revenue"],
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
