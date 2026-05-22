from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import asyncio
import json
from contextlib import asynccontextmanager

from database import engine, Base, get_db, SessionLocal
from models import (
    FocusSession, WindowLog, Todo,
    TodoCreate, TodoUpdate, TodoResponse,
    SessionResponse, SessionStopResponse,
)
from tracker import app_state, start_tracker

# Create DB tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background tracker thread exactly once safely on startup
    start_tracker(SessionLocal)
    yield

app = FastAPI(title="FocusPie API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    app_state.distraction_attempts = 0 # Reset distraction attempts on new session
    app_state.on_break = False # Reset break state
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
    app_state.on_break = False
    return session

@app.post("/api/session/pause")
def pause_session():
    if not app_state.is_tracking:
        raise HTTPException(status_code=400, detail="No active session to pause")
    app_state.on_break = True
    return {"message": "Session paused"}

@app.post("/api/session/resume")
def resume_session():
    if not app_state.is_tracking:
        raise HTTPException(status_code=400, detail="No active session to resume")
    app_state.on_break = False
    return {"message": "Session resumed"}

@app.get("/api/session/status")
def session_status():
    return {
        "is_active": app_state.is_tracking,
        "session_id": app_state.active_session_id,
        "on_break": app_state.on_break,
    }


# ─── Granular Session Explorer Endpoints ─────────────────────────────

@app.get("/api/sessions")
def get_all_sessions(db: Session = Depends(get_db)):
    """Get all completed focus sessions with summary statistics."""
    sessions = db.query(FocusSession).filter(FocusSession.status == "completed").order_by(FocusSession.start_time.desc()).all()
    
    result = []
    for s in sessions:
        logs = db.query(WindowLog).filter(WindowLog.session_id == s.id).all()
        total_logs = len(logs)
        distraction_logs = sum(1 for l in logs if l.is_distraction)
        focus_score = round(((total_logs - distraction_logs) / max(total_logs, 1)) * 100) if total_logs > 0 else 0
        
        result.append({
            "id": s.id,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time": s.end_time.isoformat() if s.end_time else None,
            "duration_minutes": round((s.total_duration or 0) / 60, 1),
            "focus_score": focus_score,
            "total_logs": total_logs,
            "distraction_logs": distraction_logs
        })
    return result

@app.get("/api/sessions/{session_id}")
def get_session_details(session_id: int, db: Session = Depends(get_db)):
    """Get detailed minute-binned timeline, top distractions, AI classification and incidents for a specific session."""
    session = db.query(FocusSession).filter(FocusSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    logs = db.query(WindowLog).filter(WindowLog.session_id == session_id).all()
    total_logs = len(logs)
    distraction_logs = sum(1 for l in logs if l.is_distraction)
    focus_logs = total_logs - distraction_logs
    
    focus_score = round((focus_logs / max(total_logs, 1)) * 100) if total_logs > 0 else 0
    
    # Group distractions
    distractions_count = {}
    for log in logs:
        if log.is_distraction:
            key = log.application_name or "Unknown"
            distractions_count[key] = distractions_count.get(key, 0) + 1
            
    top_distractions = [
        {"name": k, "minutes": round(v / 60, 1), "seconds": v}
        for k, v in sorted(distractions_count.items(), key=lambda x: x[1], reverse=True)[:6]
    ]
    
    # Granular minute bins
    minute_bins = {}
    for log in logs:
        elapsed = int((log.timestamp - session.start_time).total_seconds())
        minute_idx = elapsed // 60
        minute_key = f"{minute_idx}m"
        if minute_idx not in minute_bins:
            minute_bins[minute_idx] = {"Focus": 0, "Distraction": 0}
        if log.is_distraction:
            minute_bins[minute_idx]["Distraction"] += 1
        else:
            minute_bins[minute_idx]["Focus"] += 1
            
    timeline = [
        {"time": f"{k}m", "Focus": round(v["Focus"] / 60, 1), "Distraction": round(v["Distraction"] / 60, 1)}
        for k, v in sorted(minute_bins.items())
    ]
    
    # Detailed distraction incidents
    incidents = []
    for log in logs:
        if log.is_distraction:
            incidents.append({
                "time": log.timestamp.strftime("%H:%M:%S"),
                "title": log.window_title,
                "app": log.application_name
            })
            
    # AI Classification of window logs
    from ml_service import activity_classifier
    cat_counts = {}
    for log in logs:
        cat, _ = activity_classifier.classify(log.window_title)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        
    ai_categories = [
        {"name": k, "value": v}
        for k, v in cat_counts.items() if v > 0
    ]
    
    return {
        "id": session.id,
        "start_time": session.start_time.isoformat() if session.start_time else None,
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "duration_minutes": round((session.total_duration or 0) / 60, 1),
        "focus_score": focus_score,
        "summary": {
            "total_minutes": round((session.total_duration or 0) / 60, 1),
            "focus_minutes": round(focus_logs / 60, 1),
            "distraction_minutes": round(distraction_logs / 60, 1),
            "focus_score": focus_score
        },
        "top_distractions": top_distractions,
        "timeline": timeline,
    }

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a focus session and cascading log data."""
    session = db.query(FocusSession).filter(FocusSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Cascade delete logs
    db.query(WindowLog).filter(WindowLog.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully"}


# ─── Machine Learning Predictor Endpoints ────────────────────────────

@app.get("/api/ml/predict")
def predict_focus_forecast(db: Session = Depends(get_db)):
    """Predict expected focus score and return productivity categorization and trends."""
    sessions = db.query(FocusSession).filter(FocusSession.status == "completed").all()
    
    session_data = []
    for s in sessions:
        logs = db.query(WindowLog).filter(WindowLog.session_id == s.id).all()
        if not logs:
            continue
        distraction_logs = sum(1 for l in logs if l.is_distraction)
        score = round(((len(logs) - distraction_logs) / len(logs)) * 100)
        session_data.append({
            "start_time": s.start_time,
            "focus_score": score
        })
        
    from ml_service import focus_predictor, activity_classifier
    focus_predictor.load_historical_data(session_data)
    predicted_score, advice = focus_predictor.predict()
    
    # Calculate 24h expected focus curve using Circular KNN circular distances
    circadian_curve = []
    base_time = datetime.now()
    for h in range(24):
        test_time = base_time.replace(hour=h, minute=0, second=0, microsecond=0)
        score_h, _ = focus_predictor.predict(target_time=test_time)
        circadian_curve.append({
            "hour": f"{h:02d}:00",
            "Expected Focus": score_h
        })

    # Calculate global categorization distribution
    all_logs = db.query(WindowLog).all()
    cat_counts = {"Work": 0, "Entertainment": 0, "Social Media": 0, "Communication": 0, "Utilities": 0}
    for l in all_logs:
        if l.window_title:
            cat, _ = activity_classifier.classify(l.window_title)
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            
    # Calculate historical focus score trend by date (last 7 dates)
    daily_scores = {}
    for s in sessions:
        logs = db.query(WindowLog).filter(WindowLog.session_id == s.id).all()
        if not logs:
            continue
        distraction_logs = sum(1 for l in logs if l.is_distraction)
        score = round(((len(logs) - distraction_logs) / len(logs)) * 100)
        
        date_str = s.start_time.strftime("%b %d")
        if date_str not in daily_scores:
            daily_scores[date_str] = []
        daily_scores[date_str].append(score)
        
    trend = []
    for date, scores in daily_scores.items():
        trend.append({
            "date": date,
            "Score": round(sum(scores) / len(scores))
        })
        
    # Sort trend chronological-like
    def sort_trend_key(item):
        try:
            return datetime.strptime(f"{datetime.now().year} {item['date']}", "%Y %b %d")
        except:
            return datetime.now()
            
    trend = sorted(trend, key=sort_trend_key)[-7:]
    
    return {
        "predicted_score": predicted_score,
        "advice": advice,
        "trend": trend,
        "distribution": [
            {"name": k, "value": v}
            for k, v in cat_counts.items() if v > 0
        ],
        "circadian_curve": circadian_curve
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
