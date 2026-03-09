import sqlite3
import json
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta
import random
import os

DB_PATH = "backend/workshop_store.db"

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{hashed}"

def seed():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    print(f"Connected to {DB_PATH}")
    
    company_id = "perf-company-123"
    
    conn.execute("DELETE FROM kv_store")
    conn.execute("DELETE FROM list_store")
    
    def save_kv(namespace, key, value):
        conn.execute("INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES (?, ?, ?)",
                     (namespace, key, json.dumps(value, default=str)))

    # Company
    save_kv("companies", company_id, {
        "id": company_id,
        "name": "Performance Test Workshop",
        "email": "perf@workshop.com",
        "status": "ACTIVE"
    })
    
    # Admin User
    user_id = str(uuid.uuid4())
    save_kv("users", user_id, {
        "id": user_id,
        "email": "admin@perf.com",
        "name": "Admin Performance",
        "role": "ADMIN",
        "company_id": company_id,
        "password_hash": hash_password("password123"),
        "created_at": datetime.now().isoformat()
    })
    
    # Customers
    print("Seeding 1000 customers...")
    for i in range(1000):
        c_id = f"cust-{i}"
        save_kv("customers", c_id, {
            "id": c_id,
            "company_id": company_id,
            "name": f"Customer {i}",
            "email": f"cust{i}@example.com",
            "phone": f"555-{i:04d}"
        })
        
    # Jobs
    print("Seeding 10,000 jobs...")
    for i in range(10000):
        j_id = f"job-{i}"
        save_kv("jobs", j_id, {
            "id": j_id,
            "company_id": company_id,
            "customer_id": f"cust-{random.randint(0, 999)}",
            "vehicle_id": f"veh-{random.randint(0, 500)}",
            "service_type": random.choice(["Oil Change", "Brakes", "Tyres", "Engine"]),
            "description": f"Performance test job {i}",
            "priority": "Medium",
            "status": "Pending",
            "estimated_cost": random.uniform(100, 5000),
            "estimated_hours": random.uniform(1, 10),
            "due_date": (datetime.now() + timedelta(days=random.randint(1, 14))).isoformat(),
            "created_at": (datetime.now() - timedelta(days=random.randint(0, 365))).isoformat(),
            "tasks": [],
            "partsUsed": [],
            "laborEntries": []
        })
        if i % 2000 == 0:
            print(f"Seeded {i} jobs...")
            conn.commit()
            
    conn.commit()
    conn.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed()
