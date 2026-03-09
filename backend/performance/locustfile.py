from locust import HttpUser, task, between
import random

class WorkshopUser(HttpUser):
    wait_time = between(1, 5)
    token = None
    company_id = "perf-company-123"

    def on_start(self):
        # Login and get token
        # Using the admin account seeded by seed_data.py
        with self.client.post("/api/auth/login", data={
            "username": "admin@perf.com",
            "password": "password123"
        }, catch_response=True) as response:
            if response.status_code == 200:
                self.token = response.json()["access_token"]
            else:
                response.failure(f"Login failed with status {response.status_code}: {response.text}")

    @task(3)
    def view_dashboard(self):
        if not self.token: return
        self.client.get("/api/analytics/dashboard", headers={"Authorization": f"Bearer {self.token}"})

    @task(5)
    def list_jobs(self):
        if not self.token: return
        self.client.get("/api/jobs?limit=50", headers={"Authorization": f"Bearer {self.token}"})

    @task(2)
    def batch_invoices(self):
        if not self.token: return
        # Simulate batch invoice processing
        payload = {
            "invoices": [
                {
                    "customer_id": f"cust-{random.randint(0, 999)}",
                    "type": "Invoice",
                    "items": [
                        {"description": "Labor", "quantity": 1, "unit_price": 500}
                    ]
                } for _ in range(10)
            ]
        }
        self.client.post("/api/invoices/batch", json=payload, headers={"Authorization": f"Bearer {self.token}"})

    @task(1)
    def download_pdf(self):
        if not self.token: return
        self.client.get("/api/reports/pdf", headers={"Authorization": f"Bearer {self.token}"})

    @task(2)
    def list_appointments(self):
        if not self.token: return
        self.client.get("/api/appointments", headers={"Authorization": f"Bearer {self.token}"})
