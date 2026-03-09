import pytest
from datetime import datetime, timedelta
import uuid
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.main import app, _appointments, _users, _companies, create_token, UserRole

client = TestClient(app)

@pytest.fixture
def auth_headers():
    """Create auth headers for a test user."""
    company_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    
    _companies[company_id] = {"id": company_id, "name": "Test Co", "is_active": True, "email": "test@co.com", "phone": "123", "address": "Add"}
    _users[user_id] = {
        "id": user_id,
        "email": f"test_{user_id}@example.com",
        "name": "Test User",
        "role": "TECHNICIAN",
        "company_id": company_id,
        "password_hash": "dummy",
        "created_at": datetime.utcnow()
    }
    
    token = create_token(user_id, f"test_{user_id}@example.com", "TECHNICIAN", company_id)
    return {"Authorization": f"Bearer {token}"}

def test_create_appointment(auth_headers):
    """Test creating an appointment using correct AppointmentCreate schema."""
    start = datetime.utcnow() + timedelta(days=1)
    end = start + timedelta(hours=1)
    
    payload = {
        "title": "Service Appointment",
        "appointment_type": "Repair",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "customer_id": str(uuid.uuid4()),
        "vehicle_id": str(uuid.uuid4()),
        "assigned_to": str(uuid.uuid4()),
        "status": "scheduled",
        "notes": "Test appointment notes"
    }
    
    response = client.post("/api/appointments", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Service Appointment"
    # Account for multi-tenancy nesting in _appointments
    company_id = auth_headers["Authorization"] # Wait, this isn't right. The company_id is internal.
    # We can just check across all companies since it's a test global
    assert any(data["id"] in co_appts for co_appts in _appointments.values())

def test_list_appointments(auth_headers):
    """Test listing appointments."""
    response = client.get("/api/appointments", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_update_appointment_status(auth_headers):
    """Test updating appointment status."""
    # First create one
    start = datetime.utcnow() + timedelta(days=2)
    end = start + timedelta(hours=1)
    payload = {
        "title": "Initial Appt",
        "appointment_type": "Oil Change",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "customer_id": str(uuid.uuid4()),
        "status": "scheduled"
    }
    create_resp = client.post("/api/appointments", json=payload, headers=auth_headers)
    appt_id = create_resp.json()["id"]
    
    # Update status (using AppointmentUpdate partial)
    response = client.patch(f"/api/appointments/{appt_id}", 
                           json={"status": "Confirmed"}, 
                           headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"].lower() == "confirmed"
