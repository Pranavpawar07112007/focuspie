from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import asyncio
import json

from database import engine, Base, get_db, SessionLocal
from models import (
    FocusSession, WindowLog, Todo,
    TodoCreate, TodoUpdate, TodoResponse,
    SessionResponse, SessionStopResponse,
)
from tracker import app_state, start_tracker

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FocusPie API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start background tracker
start_tracker(SessionLocal)


# ─── Helpers ─────────────────────────────────────────────────────────

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

def compute_deadline_warning(deadline):
    """Return a warning string if deadline is close or overdue."""
    if not deadline:
        return None
    now = datetime.utcnow()
    delta = deadline - now
    if delta.total_seconds() < 0:
        return "overdue"
    elif delta.total_seconds() < 3600:
        return "due_within_1h"
    elif delta.total_seconds() < 86400:
        return "due_today"
    elif delta.total_seconds() < 172800:
        return "due_tomorrow"
    return None

def todo_to_response(todo):
    """Convert a Todo ORM object to a TodoResponse with computed warning."""
    return TodoResponse(
        id=todo.id,
        task=todo.task,
        completed=todo.completed,
        priority=todo.priority or "medium",
        status=todo.status or "pending",
        deadline=todo.deadline,
        created_at=todo.created_at,
        deadline_warning=compute_deadline_warning(todo.deadline),
    )

def smart_sort(todos):
    """Sort todos by: overdue first, then priority, then deadline proximity."""
    now = datetime.utcnow()

    def sort_key(t):
        p = PRIORITY_ORDER.get(t.priority, 1)
        if t.deadline:
            delta = (t.deadline - now).total_seconds()
            if delta < 0:
                return (-1, p, delta)      # overdue first
            return (0, p, delta)           # then by priority + deadline
        return (1, p, 0)                   # no deadline last

    return sorted(todos, key=sort_key)


# ─── Session Endpoints ───────────────────────────────────────────────

@app.post("/api/session/start", response_model=SessionResponse)
def start_session(db: Session = Depends(get_db)):
    if app_state.is_tracking:
        raise HTTPException(status_code=400, detail="A session is already active")
    new_session = FocusSession(start_time=datetime.utcnow(), status="active")
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    app_state.active_session_id = new_session.id
    app_state.is_tracking = True
    return new_session

@app.post("/api/session/stop", response_model=SessionStopResponse)
def stop_session(db: Session = Depends(get_db)):
    if not app_state.is_tracking or app_state.active_session_id is None:
        raise HTTPException(status_code=400, detail="No active session to stop")
    session = db.query(FocusSession).filter(
        FocusSession.id == app_state.active_session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.end_time = datetime.utcnow()
    session.total_duration = int((session.end_time - session.start_time).total_seconds())
    session.status = "completed"
    db.commit()
    db.refresh(session)
    app_state.is_tracking = False
    app_state.active_session_id = None
    return session

@app.get("/api/session/status")
def session_status():
    return {
        "is_active": app_state.is_tracking,
        "session_id": app_state.active_session_id,
    }


# ─── Todo Endpoints ─────────────────────────────────────────────────

@app.get("/api/todos")
def get_todos(db: Session = Depends(get_db)):
    todos = db.query(Todo).all()
    sorted_todos = smart_sort(todos)
    return [todo_to_response(t) for t in sorted_todos]

@app.post("/api/todos")
def create_todo(todo: TodoCreate, db: Session = Depends(get_db)):
    new_todo = Todo(
        task=todo.task,
        completed=todo.completed,
        priority=todo.priority,
        status=todo.status,
        deadline=todo.deadline,
    )
    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)
    return todo_to_response(new_todo)

@app.put("/api/todos/{todo_id}")
def update_todo(todo_id: int, todo_update: TodoUpdate, db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not db_todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    if todo_update.task is not None:
        db_todo.task = todo_update.task
    if todo_update.completed is not None:
        db_todo.completed = todo_update.completed
        if todo_update.completed:
            db_todo.status = "completed"
    if todo_update.priority is not None:
        db_todo.priority = todo_update.priority
    if todo_update.status is not None:
        db_todo.status = todo_update.status
        if todo_update.status == "completed":
            db_todo.completed = True
        elif todo_update.status in ("pending", "ongoing"):
            db_todo.completed = False
    if todo_update.deadline is not None:
        db_todo.deadline = todo_update.deadline
    db.commit()
    db.refresh(db_todo)
    return todo_to_response(db_todo)

@app.delete("/api/todos/{todo_id}")
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not db_todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(db_todo)
    db.commit()
    return {"message": "Todo deleted successfully"}


# ─── Calendar Endpoint ───────────────────────────────────────────────

@app.get("/api/calendar")
def get_calendar(db: Session = Depends(get_db)):
    """Return all tasks and sessions organized by date for calendar view."""
    todos = db.query(Todo).all()
    sessions = db.query(FocusSession).filter(FocusSession.status == "completed").all()

    events = []

    # Add tasks with deadlines
    for t in todos:
        if t.deadline:
            events.append({
                "id": f"task-{t.id}",
                "type": "task",
                "title": t.task,
                "date": t.deadline.strftime("%Y-%m-%d"),
                "time": t.deadline.strftime("%H:%M"),
                "priority": t.priority or "medium",
                "status": t.status or "pending",
                "deadline_warning": compute_deadline_warning(t.deadline),
            })
        # Also add creation date events
        events.append({
            "id": f"task-created-{t.id}",
            "type": "task_created",
            "title": f"Created: {t.task}",
            "date": t.created_at.strftime("%Y-%m-%d") if t.created_at else None,
            "time": t.created_at.strftime("%H:%M") if t.created_at else None,
            "priority": t.priority or "medium",
            "status": t.status or "pending",
        })

    # Add focus sessions
    for s in sessions:
        events.append({
            "id": f"session-{s.id}",
            "type": "session",
            "title": f"Focus Session ({round((s.total_duration or 0) / 60)}m)",
            "date": s.start_time.strftime("%Y-%m-%d") if s.start_time else None,
            "time": s.start_time.strftime("%H:%M") if s.start_time else None,
            "duration_minutes": round((s.total_duration or 0) / 60, 1),
        })

    return {"events": events}


# ─── Insights Endpoint (REAL data) ───────────────────────────────────

@app.get("/api/insights")
def get_insights(db: Session = Depends(get_db)):
    sessions = db.query(FocusSession).filter(FocusSession.status == "completed").all()
    total_focus_seconds = sum(s.total_duration or 0 for s in sessions)
    total_sessions = len(sessions)

    logs = db.query(WindowLog).all()
    distraction_seconds = sum(1 for l in logs if l.is_distraction)
    focus_seconds = sum(1 for l in logs if not l.is_distraction)

    # Top distractions grouped by app
    distractions_count = {}
    for log in logs:
        if log.is_distraction:
            key = log.application_name or log.window_title or "Unknown"
            key = key.replace(".exe", "").capitalize()
            distractions_count[key] = distractions_count.get(key, 0) + 1

    top_distractions = [
        {"name": k, "minutes": round(v / 60, 1)}
        for k, v in sorted(distractions_count.items(), key=lambda x: x[1], reverse=True)[:6]
    ]

    # Timeline grouped by hour
    hourly = {}
    for log in logs:
        hour_key = log.timestamp.strftime("%H:00") if log.timestamp else "00:00"
        if hour_key not in hourly:
            hourly[hour_key] = {"focus": 0, "distraction": 0}
        if log.is_distraction:
            hourly[hour_key]["distraction"] += 1
        else:
            hourly[hour_key]["focus"] += 1

    timeline = [
        {"time": k, "Focus": round(v["focus"] / 60, 1), "Distraction": round(v["distraction"] / 60, 1)}
        for k, v in sorted(hourly.items())
    ]

    # Recent sessions
    recent_sessions = []
    for s in sorted(sessions, key=lambda x: x.start_time, reverse=True)[:10]:
        recent_sessions.append({
            "id": s.id,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time": s.end_time.isoformat() if s.end_time else None,
            "duration_minutes": round((s.total_duration or 0) / 60, 1),
            "status": s.status,
        })

    # Task stats
    todos = db.query(Todo).all()
    task_stats = {
        "total": len(todos),
        "pending": sum(1 for t in todos if t.status == "pending"),
        "ongoing": sum(1 for t in todos if t.status == "ongoing"),
        "completed": sum(1 for t in todos if t.status == "completed"),
        "overdue": sum(1 for t in todos if t.deadline and t.deadline < datetime.utcnow() and t.status != "completed"),
    }

    return {
        "summary": {
            "total_focus_minutes": round(total_focus_seconds / 60, 1),
            "total_distraction_minutes": round(distraction_seconds / 60, 1),
            "total_sessions": total_sessions,
            "focus_score": (
                round(focus_seconds / max(focus_seconds + distraction_seconds, 1) * 100)
                if logs else 0
            ),
        },
        "task_stats": task_stats,
        "timeline": timeline,
        "top_distractions": top_distractions,
        "recent_sessions": recent_sessions,
    }


# ─── WebSocket ───────────────────────────────────────────────────────

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            alerts_to_send = []
            with app_state.lock:
                if app_state.alerts:
                    alerts_to_send = list(app_state.alerts)
                    app_state.alerts.clear()
            for alert in alerts_to_send:
                await websocket.send_text(json.dumps(alert))
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print("Client disconnected")
