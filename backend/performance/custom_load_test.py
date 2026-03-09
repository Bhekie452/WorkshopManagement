import asyncio
import httpx
import time
import random
import uuid

BASE_URL = "http://127.0.0.1:8000"
USER_EMAIL = "admin@perf.com"
PASSWORD = "password123"

async def authenticate(client):
    resp = await client.post("/api/auth/token", data={"username": USER_EMAIL, "password": PASSWORD})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return None

async def run_task(client, token, name, endpoint, method="GET", json_data=None):
    headers = {"Authorization": f"Bearer {token}"}
    start = time.perf_counter()
    try:
        if method == "GET":
            resp = await client.get(endpoint, headers=headers)
        else:
            resp = await client.post(endpoint, json=json_data, headers=headers)
        latency = time.perf_counter() - start
        return {"name": name, "status": resp.status_code, "latency": latency, "success": 200 <= resp.status_code < 300}
    except Exception as e:
        return {"name": name, "status": "ERROR", "latency": time.perf_counter() - start, "success": False, "error": str(e)}

async def simulate_user(user_id, total_requests=10):
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        token = await authenticate(client)
        if not token:
            return []
        
        results = []
        for _ in range(total_requests):
            # Randomly pick a task
            task_choice = random.choice([
                ("Dashboard", "/api/analytics/dashboard", "GET", None),
                ("List Jobs", "/api/jobs?limit=50", "GET", None),
                ("Batch Invoices", "/api/invoices/batch", "POST", {
                    "invoices": [
                        {
                            "customer_id": f"cust-{random.randint(0, 999)}", 
                            "type": "Invoice", 
                            "items": [{
                                "id": str(uuid.uuid4()),
                                "description": "Labor", 
                                "quantity": 1, 
                                "unit_price": 500.0,
                                "total": 500.0
                            }]
                        }
                        for _ in range(5)
                    ]
                }),
                ("PDF Report", "/api/reports/pdf", "GET", None)
            ])
            
            res = await run_task(client, token, *task_choice)
            results.append(res)
            await asyncio.sleep(random.uniform(0.1, 0.5))
        return results

async def main():
    print("Starting custom load test: 100 concurrent users...")
    start_time = time.perf_counter()
    
    # 100 users, each doing 5 requests
    tasks = [simulate_user(i, 5) for i in range(100)]
    all_results = await asyncio.gather(*tasks)
    
    total_time = time.perf_counter() - start_time
    flattened = [res for user_res in all_results for res in user_res]
    
    # Calculate stats
    successes = [r for r in flattened if r["success"]]
    latencies = [r["latency"] for r in flattened if r["success"]]
    
    print("\n--- Load Test Results ---")
    print(f"Total Users: 100")
    print(f"Total Requests: {len(flattened)}")
    print(f"Success Rate: {len(successes)}/{len(flattened)} ({len(successes)/len(flattened)*100 if flattened else 0:.1f}%)")
    if latencies:
        print(f"Avg Latency: {sum(latencies)/len(latencies)*1000:.2f}ms")
        print(f"Max Latency: {max(latencies)*1000:.2f}ms")
    print(f"Total Test Time: {total_time:.2f}s")
    print(f"Requests/Second: {len(flattened)/total_time:.2f}")

if __name__ == "__main__":
    asyncio.run(main())
