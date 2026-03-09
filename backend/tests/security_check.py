import sys
import os
from pathlib import Path
import hmac
import hashlib
from datetime import datetime, timedelta
import time
import uuid

# Add project root to sys.path
root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root))

from fastapi.testclient import TestClient
from backend.api.main import app, JWT_SECRET, create_token

client = TestClient(app)

def run_tests():
    print("Running Security Standalone Checks...")
    
    # 1. Signature Spoofing
    print("Check: Signature Spoofing...", end=" ")
    payload = "fake-user|spoof@example.com|ADMIN|companyA|2026-03-01T12:00:00"
    fake_token = f"{payload}|this-is-not-a-valid-hmac-signature"
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    assert "Invalid token signature" in resp.json()["detail"]
    print("PASSED")

    # 2. Token Expiration
    print("Check: Token Expiration...", end=" ")
    old_time = (datetime.utcnow() - timedelta(hours=25)).isoformat()
    payload_exp = f"user-exp|exp@test.com|ADMIN|compA|{old_time}"
    sig_exp = hmac.new(JWT_SECRET.encode(), payload_exp.encode(), hashlib.sha256).hexdigest()
    expired_token = f"{payload_exp}|{sig_exp}"
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    assert "Token expired" in resp.json()["detail"]
    print("PASSED")

    # 3. Multi-tenancy Isolation
    print("Check: Multi-tenancy Isolation...", end=" ")
    token_a = create_token("user-a", "a@compA.com", "ADMIN", "comp-A")
    token_b = create_token("user-b", "b@compB.com", "ADMIN", "comp-B")
    
    # Prerequisite: Seed a customer for Company B
    cust_b_resp = client.post("/api/customers", json={
        "name": "Customer B", "email": "b@test.com", "phone": "555-B", "address": "123 B St"
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert cust_b_resp.status_code == 201, f"Failed to create customer: {cust_b_resp.text}"
    cust_b_id = cust_b_resp.json()["id"]

    # Prerequisite: Seed a vehicle for Company B
    veh_b_resp = client.post("/api/vehicles", json={
        "owner_id": cust_b_id,
        "registration": "B-TEST-123", "make": "Tesla", "model": "S", "year": 2024, 
        "vin": str(uuid.uuid4()), "color": "Red", "fuel_type": "Electric"
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert veh_b_resp.status_code == 201, f"Failed to create vehicle: {veh_b_resp.text}"
    veh_b_id = veh_b_resp.json()["id"]
    
    job_b = client.post("/api/jobs", json={
        "customer_id": cust_b_id, "vehicle_id": veh_b_id, "service_type": "SecTest",
        "description": "Secret B", "priority": "High", 
        "due_date": (datetime.utcnow() + timedelta(days=1)).isoformat()
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert job_b.status_code == 201, f"Failed to create Job B: {job_b.text}"
    job_b_id = job_b.json()["id"]
    
    resp = client.get(f"/api/jobs/{job_b_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 404, f"Expected 404 for cross-company access, got {resp.status_code}"
    print("PASSED")

    # 4. Rate Limiting (shorter trial)
    print("Check: Rate Limiting...", end=" ")
    for i in range(100):
        client.post("/api/auth/token", data={"username": "t", "password": "p"})
    resp = client.post("/api/auth/token", data={"username": "t", "password": "p"})
    assert resp.status_code == 429, f"Expected 429 after 100 requests, got {resp.status_code}"
    print("PASSED")

    # 5. Security Headers
    print("Check: Security Headers...", end=" ")
    resp = client.get("/api/companies")
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    print("PASSED")

    print("\nALL SECURITY CHECKS PASSED ✅")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)
