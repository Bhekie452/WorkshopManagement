import pytest
from datetime import datetime, timedelta
import uuid
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.main import app, _jobs, _users, _companies, create_token, UserRole

client = TestClient(app)

@pytest.fixture
def auth_headers():
    company_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    _companies[company_id] = {"id": company_id, "name": "Test Co", "is_active": True, "email": "l@co.com", "phone": "1", "address": "A"}
    _users[user_id] = {
        "id": user_id, "email": "l@example.com", "name": "L", "role": "TECHNICIAN", "company_id": company_id,
        "created_at": datetime.utcnow()
    }
    token = create_token(user_id, "l@example.com", "TECHNICIAN", company_id)
    return {"Authorization": f"Bearer {token}"}

def test_add_labor_log(auth_headers):
    # First create a job record in the global dictionary
    job_id = str(uuid.uuid4())
    company_id = _companies[list(_companies.keys())[-1]]["id"]
    
    _jobs[job_id] = {
        "id": job_id,
        "company_id": company_id,
        "customer_id": str(uuid.uuid4()),
        "vehicle_id": str(uuid.uuid4()),
        "service_type": "Repair",
        "description": "Test job",
        "status": "Pending",
        "created_at": datetime.utcnow(),
        "due_date": datetime.utcnow() + timedelta(days=1),
        "tasks": []
    }
    
    payload = {
        "job_id": job_id,
        "technician_id": str(uuid.uuid4()),
        "description": "Welding",
        "hours": 2.0,
        "rate_per_hour": 450.0,
        "entry_date": datetime.utcnow().isoformat()
    }
    
    # Check if/how main.py handles labor logging
    response = client.post(f"/api/jobs/{job_id}/labor", json=payload, headers=auth_headers)
    assert response.status_code == 201
