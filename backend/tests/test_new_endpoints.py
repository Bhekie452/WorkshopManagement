import pytest
from datetime import datetime
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
import sys, os

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if root not in sys.path:
    sys.path.insert(0, root)

from backend.api.main import app, _invoices, _invoice_items, _jobs, _users, create_token

client = TestClient(app)


def make_token_for_user(user_dict: dict) -> str:
    return create_token(user_dict['id'], user_dict['email'], user_dict['role'], user_dict.get('company_id',''))


def test_invoice_items_create_and_list_company_isolation():
    # Setup companies/users/invoices
    _invoices.clear()
    _invoice_items.clear()
    _users.clear()
    user_a = {"id": "uA", "email": "a@example.com", "role": "ADMIN", "company_id": "compA"}
    user_b = {"id": "uB", "email": "b@example.com", "role": "ADMIN", "company_id": "compB"}
    _users[user_a['id']] = user_a
    _users[user_b['id']] = user_b

    invoice_id = "invA"
    now = datetime.utcnow()
    _invoices[invoice_id] = {
        "id": invoice_id,
        "company_id": "compA",
        "type": "Invoice",
        "customer_id": "",
        "vehicle_id": None,
        "job_id": None,
        "items": [],
        "number": "INV-invA",
        "issue_date": now,
        "due_date": now,
        "subtotal": 0,
        "tax_amount": 0,
        "total": 0,
        "status": "DRAFT",
    }

    token_a = make_token_for_user(user_a)
    token_b = make_token_for_user(user_b)

    # user A can create item
    resp = client.post(f"/api/invoices/{invoice_id}/items", json={"description": "Oil", "quantity": 2, "unit_price": 50}, headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 201
    item = resp.json()
    assert item["description"] == "Oil"

    # user B cannot create item on invoice belonging to compA
    resp2 = client.post(f"/api/invoices/{invoice_id}/items", json={"description": "Filter", "quantity": 1, "unit_price": 20}, headers={"Authorization": f"Bearer {token_b}"})
    assert resp2.status_code == 404

    # user A can list items
    resp3 = client.get(f"/api/invoices/{invoice_id}/items", headers={"Authorization": f"Bearer {token_a}"})
    assert resp3.status_code == 200
    items = resp3.json()
    assert len(items) == 1


def test_job_parts_patch_and_company_isolation():
    _jobs.clear()
    _users.clear()
    user_a = {"id": "uA2", "email": "a2@example.com", "role": "ADMIN", "company_id": "compA"}
    user_b = {"id": "uB2", "email": "b2@example.com", "role": "ADMIN", "company_id": "compB"}
    _users[user_a['id']] = user_a
    _users[user_b['id']] = user_b

    job_id = "job1"
    now = datetime.utcnow()
    _jobs[job_id] = {
        "id": job_id,
        "company_id": "compA",
        "customer_id": "",
        "vehicle_id": "",
        "service_type": "General",
        "description": "",
        "priority": "Medium",
        "estimated_cost": 100.0,
        "due_date": now,
        "status": "Pending",
        "created_at": now,
        "tasks": [],
        "partsUsed": [
            {"id": "pu1", "partId": "p1", "name": "Brake Pad", "quantity": 1, "unitCost": 100.0, "totalCost": 100.0}
        ],
    }

    token_a = make_token_for_user(user_a)
    token_b = make_token_for_user(user_b)

    # user A updates part quantity
    resp = client.patch(f"/api/jobs/{job_id}/parts/pu1", json={"quantity": 2}, headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    body = resp.json()
    # estimated_cost should increase by 100 (from 100 -> 200)
    assert body.get("estimated_cost", 0) >= 200

    # user B cannot update
    resp2 = client.patch(f"/api/jobs/{job_id}/parts/pu1", json={"quantity": 1}, headers={"Authorization": f"Bearer {token_b}"})
    assert resp2.status_code == 404