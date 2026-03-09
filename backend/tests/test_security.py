import sys
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add project root to sys.path
root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root))

from backend.api.main import app, JWT_SECRET, create_token
import hmac
import hashlib
from datetime import datetime, timedelta
import time

client = TestClient(app)

def test_signature_spoofing():
    """Attempt to bypass auth with a manually crafted token missing valid signature."""
    # Format: userId:email:role:companyId:timestamp:signature
    payload = "fake-user:spoof@example.com:ADMIN:companyA:2026-03-01T12:00:00"
    fake_token = f"{payload}:this-is-not-a-valid-hmac-signature"
    
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid token signature"

def test_token_expiration():
    """Verify that old tokens are rejected even if signature is valid."""
    user_id = "expired-user"
    email = "expired@example.com"
    role = "TECHNICIAN"
    company_id = "companyA"
    
    # Create a token manually with an old timestamp
    old_time = (datetime.utcnow() - timedelta(hours=25)).isoformat()
    payload = f"{user_id}:{email}:{role}:{company_id}:{old_time}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    expired_token = f"{payload}:{sig}"
    
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Token expired"

def test_multi_tenancy_isolation():
    """Ensure User A cannot see Job B from a different company."""
    # 1. Create User A (Company A)
    user_a_token = create_token("user-a", "a@compA.com", "ADMIN", "comp-A")
    
    # 2. Create Job B (Company B) in the global store directly or via API
    # Since we use in-memory store, we can use the API if we have a Company B token
    user_b_token = create_token("user-b", "b@compB.com", "ADMIN", "comp-B")
    
    # Create Job B
    job_payload = {
        "customer_id": "cust-b",
        "vehicle_id": "veh-b",
        "service_type": "Security Test",
        "description": "Company B Secret Job",
        "priority": "High",
        "due_date": (datetime.utcnow() + timedelta(days=1)).isoformat()
    }
    create_resp = client.post("/api/jobs", json=job_payload, headers={"Authorization": f"Bearer {user_b_token}"})
    assert create_resp.status_code == 201
    job_b_id = create_resp.json()["id"]
    
    # 3. Attempt to access Job B with User A's token
    access_resp = client.get(f"/api/jobs/{job_b_id}", headers={"Authorization": f"Bearer {user_a_token}"})
    
    # Should be 404 (Not Found in User A's company context)
    assert access_resp.status_code == 404

def test_sql_injection_attempt():
    """Verify that common SQL injection patterns don't crash or leak data."""
    token = create_token("security-user", "sec@test.com", "ADMIN", "sec-comp")
    
    # Malicious search query
    params = {"q": "' OR '1'='1' --"}
    response = client.get("/api/jobs/search", params=params, headers={"Authorization": f"Bearer {token}"})
    
    # Should return 200 but find nothing (or only public data), NOT leak everything
    assert response.status_code == 200
    # Our in-memory implementation is naturally resistant to SQLi, but we test for crashes
    assert isinstance(response.json(), list)

def test_rate_limiting():
    """Verify that the /api/auth/token endpoint enforces rate limits."""
    # We set limit to 100 per minute in main.py
    # To test quickly, we'd need to emit 101 requests.
    for i in range(100):
        resp = client.post("/api/auth/token", data={"username": "test@test.com", "password": "pw"})
        # Success or failure, just want to hit the counter
        
    # The 101st request should be rate limited
    limit_resp = client.post("/api/auth/token", data={"username": "test@test.com", "password": "pw"})
    assert limit_resp.status_code == 429
    assert limit_resp.text == "Rate limit exceeded"

def test_security_headers():
    """Verify presence of security headers in responses."""
    response = client.get("/api/companies")
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "Strict-Transport-Security" in response.headers
