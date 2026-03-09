import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import uuid
from datetime import datetime

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.main import app, _jobs, _users, _companies, _customers, create_token, UserRole

client = TestClient(app)

@pytest.fixture
def companies_setup():
    c1_id = str(uuid.uuid4())
    c2_id = str(uuid.uuid4())
    _companies[c1_id] = {"id": c1_id, "name": "Company 1", "is_active": True, "email": "c1@c.com", "phone": "1", "address": "A"}
    _companies[c2_id] = {"id": c2_id, "name": "Company 2", "is_active": True, "email": "c2@c.com", "phone": "2", "address": "B"}
    
    u1_id = str(uuid.uuid4())
    u2_id = str(uuid.uuid4())
    _users[u1_id] = {"id": u1_id, "email": "u1@c1.com", "name": "U1", "role": "TECHNICIAN", "company_id": c1_id, "created_at": datetime.utcnow()}
    _users[u2_id] = {"id": u2_id, "email": "u2@c2.com", "name": "U2", "role": "TECHNICIAN", "company_id": c2_id, "created_at": datetime.utcnow()}
    
    t1 = create_token(u1_id, "u1@c1.com", "TECHNICIAN", c1_id)
    t2 = create_token(u2_id, "u2@c2.com", "TECHNICIAN", c2_id)
    
    return {
        "c1": {"id": c1_id, "headers": {"Authorization": f"Bearer {t1}"}},
        "c2": {"id": c2_id, "headers": {"Authorization": f"Bearer {t2}"}}
    }

def test_job_isolation(companies_setup):
    c1 = companies_setup["c1"]
    c2 = companies_setup["c2"]
    
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "id": job_id, "company_id": c1["id"], 
        "customer_id": "c1", "vehicle_id": "v1", 
        "service_type": "Repair", "description": "X",
        "status": "Pending", "tasks": [],
        "created_at": datetime.utcnow(),
        "due_date": datetime.utcnow()
    }
    
    # C1 should see the job
    resp1 = client.get(f"/api/jobs/{job_id}", headers=c1["headers"])
    assert resp1.status_code == 200
    
    # C2 should NOT see the job
    resp2 = client.get(f"/api/jobs/{job_id}", headers=c2["headers"])
    assert resp2.status_code == 404

def test_customer_isolation(companies_setup):
    c1 = companies_setup["c1"]
    c2 = companies_setup["c2"]
    
    cust_id = str(uuid.uuid4())
    _customers[cust_id] = {
        "id": cust_id, "company_id": c1["id"], "name": "C1 Customer", 
        "email": "e@e.com", "phone": "1", "address": "A", "created_at": datetime.utcnow()
    }
    
    # C1 sees
    resp1 = client.get(f"/api/customers/{cust_id}", headers=c1["headers"])
    assert resp1.status_code == 200
    
    # C2 does NOT see
    resp2 = client.get(f"/api/customers/{cust_id}", headers=c2["headers"])
    assert resp2.status_code == 404
