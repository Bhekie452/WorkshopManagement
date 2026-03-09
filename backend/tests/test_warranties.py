import pytest
from datetime import datetime, timedelta
import uuid
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.main import app, _warranties, _users, _companies, create_token, UserRole

client = TestClient(app)

@pytest.fixture
def auth_headers():
    company_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    _companies[company_id] = {"id": company_id, "name": "Test Co", "is_active": True, "email": "w@co.com", "phone": "1", "address": "A"}
    _users[user_id] = {
        "id": user_id, "email": "w@example.com", "name": "W", "role": "TECHNICIAN", "company_id": company_id,
        "created_at": datetime.utcnow()
    }
    token = create_token(user_id, "w@example.com", "TECHNICIAN", company_id)
    return {"Authorization": f"Bearer {token}"}

def test_create_warranty(auth_headers):
    # Base warranty doesn't have a separate create schema in main.py, 
    # but let's assume it uses WarrantyBase fields.
    payload = {
        "job_id": str(uuid.uuid4()),
        "vehicle_id": str(uuid.uuid4()),
        "expiry_date": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        "warranty_type": "Standard",
        "coverage_description": "Parts and Labor"
    }
    # If endpoint exists
    response = client.post("/api/warranties", json=payload, headers=auth_headers)
    assert response.status_code == 201

def test_list_warranties(auth_headers):
    response = client.get("/api/warranties", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
