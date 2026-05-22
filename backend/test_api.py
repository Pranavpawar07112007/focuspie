import requests
import time

BASE = "http://localhost:8000/api"

def test_todos_with_priority_deadline():
    print("=== Testing Todos with Priority & Deadline ===")
    
    # Create high-priority task with deadline
    resp = requests.post(f"{BASE}/todos", json={
        "task": "Finish project report",
        "priority": "high",
        "status": "pending",
        "deadline": "2026-05-23T10:00:00",
        "completed": False,
    })
    assert resp.status_code == 200, f"Create failed: {resp.text}"
    t1 = resp.json()
    assert t1["priority"] == "high"
    assert t1["deadline"] is not None
    print(f"  Created high-priority task #{t1['id']} with deadline")
    
    # Create medium priority task (no deadline)
    resp = requests.post(f"{BASE}/todos", json={
        "task": "Review lecture notes",
        "priority": "medium",
        "status": "pending",
        "completed": False,
    })
    assert resp.status_code == 200
    t2 = resp.json()
    print(f"  Created medium-priority task #{t2['id']}")

    # Create low priority task
    resp = requests.post(f"{BASE}/todos", json={
        "task": "Organize bookmarks",
        "priority": "low",
        "status": "pending",
        "completed": False,
    })
    assert resp.status_code == 200
    t3 = resp.json()
    print(f"  Created low-priority task #{t3['id']}")

    # Verify smart sorting (high priority first)
    resp = requests.get(f"{BASE}/todos")
    assert resp.status_code == 200
    todos = resp.json()
    assert len(todos) >= 3
    assert todos[0]["priority"] == "high", f"Expected high first, got {todos[0]['priority']}"
    print("  Smart sorting verified: high > medium > low")

    # Move task to ongoing
    resp = requests.put(f"{BASE}/todos/{t1['id']}", json={"status": "ongoing"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ongoing"
    print(f"  Moved task #{t1['id']} to ongoing")

    # Complete task
    resp = requests.put(f"{BASE}/todos/{t1['id']}", json={"status": "completed"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["completed"] == True
    print(f"  Completed task #{t1['id']} (auto-set completed=True)")

    # Deadline warning check
    resp = requests.post(f"{BASE}/todos", json={
        "task": "Overdue task test",
        "priority": "high",
        "status": "pending",
        "deadline": "2025-01-01T00:00:00",
        "completed": False,
    })
    assert resp.status_code == 200
    overdue = resp.json()
    assert overdue["deadline_warning"] == "overdue", f"Expected overdue, got {overdue['deadline_warning']}"
    print(f"  Deadline warning 'overdue' verified for past deadline")

    # Clean up
    for t in [t1, t2, t3, overdue]:
        requests.delete(f"{BASE}/todos/{t['id']}")
    print("  Cleaned up test todos")
    print("  PASSED!\n")

def test_session():
    print("=== Testing Session ===")
    resp = requests.post(f"{BASE}/session/start")
    if resp.status_code == 400:
        requests.post(f"{BASE}/session/stop")
        resp = requests.post(f"{BASE}/session/start")
    assert resp.status_code == 200
    print(f"  Started session #{resp.json()['id']}")
    
    # Check status
    resp = requests.get(f"{BASE}/session/status")
    assert resp.status_code == 200
    assert resp.json()["is_active"] == True
    print("  Session status: active")
    
    time.sleep(2)
    
    resp = requests.post(f"{BASE}/session/stop")
    assert resp.status_code == 200
    print("  Stopped session")
    
    resp = requests.get(f"{BASE}/session/status")
    assert resp.json()["is_active"] == False
    print("  Session status: inactive")
    print("  PASSED!\n")

def test_calendar():
    print("=== Testing Calendar Endpoint ===")
    # Create a task with deadline first
    task_resp = requests.post(f"{BASE}/todos", json={
        "task": "Calendar test task",
        "priority": "medium",
        "deadline": "2026-05-25T14:00:00",
        "completed": False,
    })
    assert task_resp.status_code == 200
    task_id = task_resp.json()["id"]
    
    resp = requests.get(f"{BASE}/calendar")
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data
    task_events = [e for e in data["events"] if e["type"] == "task"]
    assert len(task_events) >= 1
    print(f"  Calendar returned {len(data['events'])} events ({len(task_events)} task deadlines)")
    
    requests.delete(f"{BASE}/todos/{task_id}")
    print("  PASSED!\n")

def test_insights():
    print("=== Testing Insights ===")
    resp = requests.get(f"{BASE}/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert "task_stats" in data
    assert "timeline" in data
    assert "top_distractions" in data
    assert "recent_sessions" in data
    print(f"  Summary: {data['summary']}")
    print(f"  Task stats: {data['task_stats']}")
    print("  PASSED!\n")

if __name__ == "__main__":
    print("\n[TEST] FocusPie Automated Test Suite\n" + "="*40 + "\n")
    try:
        test_todos_with_priority_deadline()
        test_session()
        test_calendar()
        test_insights()
        print("="*40)
        print("[SUCCESS] All tests passed!")
    except AssertionError as e:
        print(f"[FAIL] Test failed: {e}")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
