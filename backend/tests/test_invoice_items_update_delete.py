import pytest
from datetime import datetime
from fastapi.testclient import TestClient
import sys, os

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if root not in sys.path:
    sys.path.insert(0, root)

from backend.api.main import app, _invoices, _invoice_items, _users, create_token

client = TestClient(app)


def make_token_for_user(user_dict: dict) -> str:
    return create_token(user_dict['id'], user_dict['email'], user_dict['role'], user_dict.get('company_id',''))


def test_update_invoice_item_and_recalc_totals():
    _invoices.clear()
    _invoice_items.clear()
    _users.clear()

    user = {"id": "u1", "email": "x@example.com", "role": "ADMIN", "company_id": "compX"}
    _users[user['id']] = user

    invoice_id = "invUpd"
    now = datetime.utcnow()
    _invoices[invoice_id] = {
        "id": invoice_id,
        "company_id": "compX",
        "type": "Invoice",
        "customer_id": "",
        "vehicle_id": None,
        "job_id": None,
        "items": [],
        "number": "INV-invUpd",
        "issue_date": now,
        "due_date": now,
        "subtotal": 0,
        "tax_amount": 0,
        "total": 0,
        "status": "DRAFT",
    }

    token = make_token_for_user(user)

    # create two items
    resp1 = client.post(f"/api/invoices/{invoice_id}/items", json={"description": "A", "quantity": 1, "unit_price": 100}, headers={"Authorization": f"Bearer {token}"})
    assert resp1.status_code == 201
    item1 = resp1.json()

    resp2 = client.post(f"/api/invoices/{invoice_id}/items", json={"description": "B", "quantity": 2, "unit_price": 50}, headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 201
    item2 = resp2.json()

    # check subtotal
    inv = _invoices[invoice_id]
    assert inv['subtotal'] == pytest.approx(200)

    # update item2 quantity to 3 -> subtotal should increase by 50
    resp_upd = client.patch(f"/api/invoices/{invoice_id}/items/{item2['id']}", json={"quantity": 3}, headers={"Authorization": f"Bearer {token}"})
    assert resp_upd.status_code == 200
    updated = resp_upd.json()
    assert updated['quantity'] == 3

    inv = _invoices[invoice_id]
    assert inv['subtotal'] == pytest.approx(250)


def test_delete_invoice_item_and_recalc_totals_and_isolation():
    _invoices.clear()
    _invoice_items.clear()
    _users.clear()

    user_a = {"id": "ua", "email": "a@example.com", "role": "ADMIN", "company_id": "compA"}
    user_b = {"id": "ub", "email": "b@example.com", "role": "ADMIN", "company_id": "compB"}
    _users[user_a['id']] = user_a
    _users[user_b['id']] = user_b

    invoice_id = "invDel"
    now = datetime.utcnow()
    _invoices[invoice_id] = {
        "id": invoice_id,
        "company_id": "compA",
        "type": "Invoice",
        "customer_id": "",
        "vehicle_id": None,
        "job_id": None,
        "items": [],
        "number": "INV-invDel",
        "issue_date": now,
        "due_date": now,
        "subtotal": 0,
        "tax_amount": 0,
        "total": 0,
        "status": "DRAFT",
    }

    token_a = make_token_for_user(user_a)
    token_b = make_token_for_user(user_b)

    # create item as user A
    resp = client.post(f"/api/invoices/{invoice_id}/items", json={"description": "Rem", "quantity": 2, "unit_price": 30}, headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 201
    item = resp.json()

    inv = _invoices[invoice_id]
    assert inv['subtotal'] == pytest.approx(60)

    # user B cannot delete
    resp_bad = client.delete(f"/api/invoices/{invoice_id}/items/{item['id']}", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_bad.status_code == 404

    # user A deletes
    resp_del = client.delete(f"/api/invoices/{invoice_id}/items/{item['id']}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_del.status_code == 204

    # totals should be zero
    inv = _invoices[invoice_id]
    assert inv['subtotal'] == pytest.approx(0)

    # listing items should be empty
    resp_list = client.get(f"/api/invoices/{invoice_id}/items", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_list.status_code == 200
    assert resp_list.json() == []
