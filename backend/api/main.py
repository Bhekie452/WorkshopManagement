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
from pathlib import Path
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.ev_rul_model import get_model, EVBatteryRULModel

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
    allow_origins=["*"],  # Configure for production
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
    PAID = "Paid"
    CANCELLED = "Cancelled"


class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


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


class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.TECHNICIAN


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime
    company_id: Optional[str] = None

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
    number: str
    issue_date: datetime
    due_date: datetime
    subtotal: float
    tax_amount: float
    total: float
    status: InvoiceStatus

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
# In-Memory Data Store (Replace with PostgreSQL in production)
# =============================================================================

# Simple in-memory stores for demo
_users: Dict[str, dict] = {}
_customers: Dict[str, dict] = {}
_vehicles: Dict[str, dict] = {}
_jobs: Dict[str, dict] = {}
_parts: Dict[str, dict] = {}
_invoices: Dict[str, dict] = {}


# =============================================================================
# Authentication Endpoints
# =============================================================================

@app.post("/api/auth/token", response_model=Token, tags=["Authentication"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return JWT token."""
    # In production, verify against database
    # For demo, accept any credentials
    return Token(
        access_token=f"demo_token_{form_data.username}",
        expires_in=3600,
    )


@app.post("/api/auth/register", response_model=UserResponse, tags=["Authentication"])
async def register(user: UserCreate):
    """Register a new user."""
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "created_at": datetime.now(),
    }
    _users[user_id] = user_data
    return UserResponse(**user_data)


@app.get("/api/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current authenticated user."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Demo user
    return UserResponse(
        id="demo-user",
        email="demo@workshop.com",
        name="Demo User",
        role=UserRole.ADMIN,
        created_at=datetime.now(),
    )


# =============================================================================
# Customers Endpoints
# =============================================================================

@app.get("/api/customers", response_model=List[CustomerResponse], tags=["Customers"])
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
):
    """List all customers with pagination."""
    customers = list(_customers.values())
    if search:
        customers = [c for c in customers if search.lower() in c["name"].lower()]
    return [CustomerResponse(**c) for c in customers[skip:skip+limit]]


@app.post("/api/customers", response_model=CustomerResponse, status_code=201, tags=["Customers"])
async def create_customer(customer: CustomerCreate):
    """Create a new customer."""
    customer_id = str(uuid.uuid4())
    customer_data = {
        "id": customer_id,
        **customer.model_dump(),
        "created_at": datetime.now(),
        "vehicle_count": 0,
    }
    _customers[customer_id] = customer_data
    return CustomerResponse(**customer_data)


@app.get("/api/customers/{customer_id}", response_model=CustomerResponse, tags=["Customers"])
async def get_customer(customer_id: str):
    """Get a specific customer by ID."""
    if customer_id not in _customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(**_customers[customer_id])


@app.patch("/api/customers/{customer_id}", response_model=CustomerResponse, tags=["Customers"])
async def update_customer(customer_id: str, update: CustomerUpdate):
    """Update a customer."""
    if customer_id not in _customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer_data = _customers[customer_id]
    update_data = update.model_dump(exclude_unset=True)
    customer_data.update(update_data)
    return CustomerResponse(**customer_data)


@app.delete("/api/customers/{customer_id}", status_code=204, tags=["Customers"])
async def delete_customer(customer_id: str):
    """Delete a customer."""
    if customer_id not in _customers:
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
):
    """List all vehicles with optional filtering by owner."""
    vehicles = list(_vehicles.values())
    if owner_id:
        vehicles = [v for v in vehicles if v.get("owner_id") == owner_id]
    return [VehicleResponse(**v) for v in vehicles[skip:skip+limit]]


@app.post("/api/vehicles", response_model=VehicleResponse, status_code=201, tags=["Vehicles"])
async def create_vehicle(vehicle: VehicleCreate):
    """Register a new vehicle."""
    vehicle_id = str(uuid.uuid4())
    vehicle_data = {
        "id": vehicle_id,
        **vehicle.model_dump(),
        "created_at": datetime.now(),
    }
    _vehicles[vehicle_id] = vehicle_data
    return VehicleResponse(**vehicle_data)


@app.get("/api/vehicles/{vehicle_id}", response_model=VehicleResponse, tags=["Vehicles"])
async def get_vehicle(vehicle_id: str):
    """Get a specific vehicle by ID."""
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return VehicleResponse(**_vehicles[vehicle_id])


@app.patch("/api/vehicles/{vehicle_id}", response_model=VehicleResponse, tags=["Vehicles"])
async def update_vehicle(vehicle_id: str, update: VehicleUpdate):
    """Update a vehicle."""
    if vehicle_id not in _vehicles:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle_data = _vehicles[vehicle_id]
    update_data = update.model_dump(exclude_unset=True)
    vehicle_data.update(update_data)
    return VehicleResponse(**vehicle_data)


@app.delete("/api/vehicles/{vehicle_id}", status_code=204, tags=["Vehicles"])
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle."""
    if vehicle_id not in _vehicles:
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
):
    """List all jobs with optional filtering."""
    jobs = list(_jobs.values())
    if status:
        jobs = [j for j in jobs if j.get("status") == status]
    if priority:
        jobs = [j for j in jobs if j.get("priority") == priority]
    return [JobResponse(**j) for j in jobs[skip:skip+limit]]


@app.post("/api/jobs", response_model=JobResponse, status_code=201, tags=["Jobs"])
async def create_job(job: JobCreate):
    """Create a new job/work order."""
    job_id = f"JOB-{str(uuid.uuid4())[:8].upper()}"
    job_data = {
        "id": job_id,
        **job.model_dump(),
        "status": JobStatus.PENDING,
        "created_at": datetime.now(),
    }
    _jobs[job_id] = job_data
    return JobResponse(**job_data)


@app.get("/api/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
async def get_job(job_id: str):
    """Get a specific job by ID."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(**_jobs[job_id])


@app.patch("/api/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
async def update_job(job_id: str, update: JobUpdate):
    """Update a job."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_data = _jobs[job_id]
    update_data = update.model_dump(exclude_unset=True)
    job_data.update(update_data)
    
    # Set completed_at if status changed to Completed or Paid
    if update.status in [JobStatus.COMPLETED, JobStatus.PAID]:
        job_data["completed_at"] = datetime.now()
    
    return JobResponse(**job_data)


@app.delete("/api/jobs/{job_id}", status_code=204, tags=["Jobs"])
async def delete_job(job_id: str):
    """Delete a job."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    del _jobs[job_id]


@app.post("/api/jobs/{job_id}/tasks", response_model=JobResponse, tags=["Jobs"])
async def add_job_task(job_id: str, task: JobTask):
    """Add a task to a job."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    _jobs[job_id].setdefault("tasks", []).append(task.model_dump())
    return JobResponse(**_jobs[job_id])


@app.patch("/api/jobs/{job_id}/tasks/{task_id}", response_model=JobResponse, tags=["Jobs"])
async def update_job_task(job_id: str, task_id: str, completed: bool):
    """Update task completion status."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    for task in _jobs[job_id].get("tasks", []):
        if task["id"] == task_id:
            task["completed"] = completed
            break
    
    return JobResponse(**_jobs[job_id])


# =============================================================================
# Parts/Inventory Endpoints
# =============================================================================

@app.get("/api/parts", response_model=List[PartResponse], tags=["Inventory"])
async def list_parts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    low_stock: bool = False,
):
    """List all parts with optional filtering."""
    parts = list(_parts.values())
    
    # Add is_low_stock flag
    for p in parts:
        p["is_low_stock"] = p["quantity"] <= p["min_level"]
    
    if category:
        parts = [p for p in parts if p.get("category") == category]
    if low_stock:
        parts = [p for p in parts if p["is_low_stock"]]
    
    return [PartResponse(**p) for p in parts[skip:skip+limit]]


@app.post("/api/parts", response_model=PartResponse, status_code=201, tags=["Inventory"])
async def create_part(part: PartCreate):
    """Add a new part to inventory."""
    part_id = str(uuid.uuid4())
    part_data = {
        "id": part_id,
        **part.model_dump(),
        "is_low_stock": part.quantity <= part.min_level,
    }
    _parts[part_id] = part_data
    return PartResponse(**part_data)


@app.get("/api/parts/{part_id}", response_model=PartResponse, tags=["Inventory"])
async def get_part(part_id: str):
    """Get a specific part by ID."""
    if part_id not in _parts:
        raise HTTPException(status_code=404, detail="Part not found")
    part = _parts[part_id]
    part["is_low_stock"] = part["quantity"] <= part["min_level"]
    return PartResponse(**part)


@app.patch("/api/parts/{part_id}", response_model=PartResponse, tags=["Inventory"])
async def update_part(part_id: str, update: PartUpdate):
    """Update a part."""
    if part_id not in _parts:
        raise HTTPException(status_code=404, detail="Part not found")
    
    part_data = _parts[part_id]
    update_data = update.model_dump(exclude_unset=True)
    part_data.update(update_data)
    part_data["is_low_stock"] = part_data["quantity"] <= part_data["min_level"]
    
    return PartResponse(**part_data)


@app.post("/api/parts/{part_id}/adjust", response_model=PartResponse, tags=["Inventory"])
async def adjust_stock(part_id: str, quantity: int, reason: str):
    """Adjust stock quantity (positive or negative)."""
    if part_id not in _parts:
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
):
    """List all invoices/quotes."""
    invoices = list(_invoices.values())
    if type:
        invoices = [i for i in invoices if i.get("type") == type]
    if status:
        invoices = [i for i in invoices if i.get("status") == status]
    return [InvoiceResponse(**i) for i in invoices[skip:skip+limit]]


@app.post("/api/invoices", response_model=InvoiceResponse, status_code=201, tags=["Invoices"])
async def create_invoice(invoice: InvoiceCreate):
    """Create a new invoice or quote."""
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
async def get_invoice(invoice_id: str):
    """Get a specific invoice by ID."""
    if invoice_id not in _invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse(**_invoices[invoice_id])


@app.patch("/api/invoices/{invoice_id}/status", response_model=InvoiceResponse, tags=["Invoices"])
async def update_invoice_status(invoice_id: str, status: InvoiceStatus):
    """Update invoice status."""
    if invoice_id not in _invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    _invoices[invoice_id]["status"] = status
    return InvoiceResponse(**_invoices[invoice_id])


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
async def get_dashboard_stats():
    """Get dashboard statistics."""
    jobs = list(_jobs.values())
    
    return DashboardStats(
        total_jobs=len(jobs),
        pending_jobs=sum(1 for j in jobs if j.get("status") == JobStatus.PENDING),
        in_progress_jobs=sum(1 for j in jobs if j.get("status") == JobStatus.IN_PROGRESS),
        completed_jobs=sum(1 for j in jobs if j.get("status") in [JobStatus.COMPLETED, JobStatus.PAID]),
        total_revenue=sum(j.get("estimated_cost", 0) for j in jobs if j.get("status") == JobStatus.PAID),
        total_customers=len(_customers),
        total_vehicles=len(_vehicles),
        low_stock_count=sum(1 for p in _parts.values() if p.get("quantity", 0) <= p.get("min_level", 0)),
    )


@app.get("/api/analytics/revenue", tags=["Analytics"])
async def get_revenue_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    """Get revenue analytics over time."""
    # Demo data
    return {
        "total_revenue": 125000,
        "average_job_value": 2500,
        "revenue_by_service": {
            "General Service": 35000,
            "Brake Service": 25000,
            "Diagnostics": 20000,
            "Other": 45000,
        },
        "monthly_trend": [
            {"month": "Jan", "revenue": 15000},
            {"month": "Feb", "revenue": 18000},
            {"month": "Mar", "revenue": 22000},
        ],
    }


@app.get("/api/analytics/jobs", tags=["Analytics"])
async def get_job_analytics():
    """Get job analytics."""
    jobs = list(_jobs.values())
    
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
# Run Server
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
