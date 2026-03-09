import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import uuid
from datetime import datetime

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.main import app, _users, hash_password, UserRole

client = TestClient(app)

def test_login_success():
    # Setup user
    uid = str(uuid.uuid4())
    email = f"auth_test_{uid}@example.com"
    _users[uid] = {
        "id": uid,
        "email": email,
        "password_hash": hash_password("password123"),
        "name": "Auth User",
        "role": "TECHNICIAN",
        "company_id": "comp-1",
        "created_at": datetime.utcnow()
    }
    
    # In main.py, OAuth2PasswordRequestForm expects data in form fields
    response = client.post("/api/auth/token", data={"username": email, "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_failure_wrong_password():
    uid = str(uuid.uuid4())
    email = f"fail_{uid}@example.com"
    _users[uid] = {
        "id": uid,
        "email": email,
        "password_hash": hash_password("correct"),
        "name": "Err",
        "role": "TECHNICIAN",
        "company_id": "comp-1",
        "created_at": datetime.utcnow()
    }
    response = client.post("/api/auth/token", data={"username": email, "password": "wrongpassword"})
    assert response.status_code == 401

def test_register_user():
    payload = {
        "email": f"new_{uuid.uuid4()}@example.com",
        "password": "newpassword123",
        "name": "New User",
        "role": "TECHNICIAN",
        "company_id": str(uuid.uuid4())
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["email"] == payload["email"]
