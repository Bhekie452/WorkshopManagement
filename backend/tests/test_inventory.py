import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import uuid
from datetime import datetime

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.main import app, _parts, _users, _companies, create_token, UserRole

client = TestClient(app)

@pytest.fixture
def auth_headers():
    company_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    _companies[company_id] = {"id": company_id, "name": "Test Co", "is_active": True, "email": "i@co.com", "phone": "1", "address": "A"}
    _users[user_id] = {
        "id": user_id, "email": "i@example.com", "name": "I", "role": "TECHNICIAN", "company_id": company_id,
        "created_at": datetime.utcnow()
    }
    token = create_token(user_id, "i@example.com", "TECHNICIAN", company_id)
    return {"Authorization": f"Bearer {token}"}

def test_create_part(auth_headers):
    payload = {
        "name": "Brake Pad",
        "sku": "BP-001",
        "category": "Brakes",
        "quantity": 20,
        "min_level": 5,
        "cost_price": 200.0,
        "selling_price": 350.0,
        "location": "A1-Shelf",
        "supplier": "BrakeWorld"
    }
    response = client.post("/api/parts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["sku"] == "BP-001"

def test_adjust_stock(auth_headers):
    # Create part
    part_id = str(uuid.uuid4())
    company_id = _companies[list(_companies.keys())[-1]]["id"]
    _parts[part_id] = {
        "id": part_id, 
        "company_id": company_id,
        "name": "Part X", 
        "sku": "X-1",
        "category": "Misc",
        "quantity": 10, 
        "min_level": 5, 
        "cost_price": 50.0,
        "selling_price": 100.0,
        "location": "B1",
        "supplier": "S1"
    }
    
    # Adjust stock
    response = client.post(f"/api/parts/{part_id}/adjust", 
                          params={"quantity": 5, "reason": "Restock"}, 
                          headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["quantity"] == 15
