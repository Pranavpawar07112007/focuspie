from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
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
import re

# Create DB tables
Base.metadata.create_all(bind=engine)

def migrate_database_to_local_time(db):
    """Automatically convert old UTC timestamps to local time exactly once on first startup."""
    try:
        db.execute(text("CREATE TABLE IF NOT EXISTS db_metadata (key TEXT PRIMARY KEY, value TEXT)"))
        result = db.execute(text("SELECT value FROM db_metadata WHERE key = 'timezone_migrated'")).fetchone()
        if result and result[0] == 'true':
            return

        from datetime import datetime
        now = datetime.now()
        utcnow = datetime.utcnow()
        offset = now - utcnow
        
        offset_seconds = round(offset.total_seconds())
        if abs(offset_seconds) < 60:
            db.execute(text("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('timezone_migrated', 'true')"))
            db.commit()
            return

        sign = "+" if offset_seconds >= 0 else "-"
        offset_str = f"{sign}{abs(offset_seconds)} seconds"
        
        # Update focus_sessions
        db.execute(
            text("UPDATE focus_sessions SET start_time = datetime(start_time, :offset), end_time = datetime(end_time, :offset) WHERE start_time IS NOT NULL"),
            {"offset": offset_str}
        )
        # Update window_logs
        db.execute(
            text("UPDATE window_logs SET timestamp = datetime(timestamp, :offset) WHERE timestamp IS NOT NULL"),
            {"offset": offset_str}
        )
        # Update todos: created_at
        db.execute(
            text("UPDATE todos SET created_at = datetime(created_at, :offset) WHERE created_at IS NOT NULL"),
            {"offset": offset_str}
        )
        
        db.execute(text("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('timezone_migrated', 'true')"))
        db.commit()
        print(f"Successfully migrated existing database UTC timestamps to local time using offset: {offset_str}")
    except Exception as e:
        print(f"Error migrating database timestamps: {e}")
        db.rollback()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run automatic timezone migration first
    db = SessionLocal()
    try:
        migrate_database_to_local_time(db)
    finally:
        db.close()

    # Clean up orphan active sessions on startup
    db = SessionLocal()
    try:
        active_sessions = db.query(FocusSession).filter(FocusSession.status == "active").all()
        for s in active_sessions:
            logs = db.query(WindowLog).filter(WindowLog.session_id == s.id).order_by(WindowLog.timestamp.desc()).all()
            if logs:
                s.status = "completed"
                s.end_time = logs[0].timestamp
                s.total_duration = int((s.end_time - s.start_time).total_seconds())
            else:
                db.delete(s)
        db.commit()
    except Exception as e:
        print(f"Error cleaning up orphan sessions: {e}")
        db.rollback()
    finally:
        db.close()

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
    now = datetime.now()
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
    now = datetime.now()

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
    new_session = FocusSession(start_time=datetime.now(), status="active")
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
    session.end_time = datetime.now()
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

# ─── Smart Name Extraction Helpers ───────────────────────────────────

BROWSER_PROCESSES = {"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "applicationframehost.exe"}

# Known browser title suffixes (including invisible unicode variants)
BROWSER_SUFFIXES = [
    " - Google Chrome", " - Microsoft\u200b Edge", " - Microsoft Edge",
    " - Mozilla Firefox", " - Brave", " - Opera", " - Vivaldi",
]

DISTRACTION_KEYWORDS = [
    "YouTube", "Netflix", "Twitch", "Facebook", "Instagram",
    "Reddit", "Twitter", "x.com", "Pinterest", "LinkedIn",
    "WhatsApp", "Discord", "Spotify", "Steam", "Roblox", "TikTok",
]

SYSTEM_PROCESS_NAMES = {
    "shellexperiencehost.exe": "Windows Shell",
    "applicationframehost.exe": "UWP App",
    "searchhost.exe": "Windows Search",
    "explorer.exe": "File Explorer",
    "taskmgr.exe": "Task Manager",
    "systemsettings.exe": "Settings",
}

def clean_window_title(title):
    if not title:
        return "Untitled Activity"
    # Remove browser suffix if there is one (handle invisible unicode too)
    for suffix in BROWSER_SUFFIXES:
        if title.endswith(suffix):
            title = title[:-len(suffix)]
    # Also strip with a regex for edge cases with zero-width chars
    title = re.sub(r'\s*-\s*(Google Chrome|Microsoft\u200b? Edge|Mozilla Firefox|Brave|Opera)\s*$', '', title)
    return title.strip()

def extract_specific_name(application_name, window_title):
    """Extract the most specific, human-readable app/website name from DB log data.
    Works retroactively on old data that may have raw process names stored."""
    app_raw = application_name or ""
    title = window_title or ""
    app_lower = app_raw.lower().strip()

    # 1. If already a specific name (not a process .exe), use it directly
    if app_lower and not app_lower.endswith(".exe"):
        # Already specific — could be "FocusPie", "YouTube", etc.
        # But also check if it's an absurdly long browser title stored as app name
        if len(app_raw) > 60:
            # It's a full window title stored as app_name — extract the site part
            cleaned = clean_window_title(app_raw)
            if " - " in cleaned:
                parts = cleaned.split(" - ")
                return parts[-1].strip() if len(parts[-1].strip()) > 2 else parts[0].strip()
            return cleaned[:50]
        return app_raw

    # 2. Check if it's a browser process
    if app_lower in BROWSER_PROCESSES:
        title_lower = title.lower()
        # Check for known distraction keywords first
        for kw in DISTRACTION_KEYWORDS:
            if kw.lower() in title_lower:
                return kw
        # Extract the site/page name from the title
        cleaned = clean_window_title(title)
        if cleaned and cleaned != "Untitled Activity":
            if " - " in cleaned:
                parts = cleaned.split(" - ")
                # Return the last part (usually the site/app name)
                site = parts[-1].strip()
                if len(site) > 2:
                    return site
                return parts[0].strip()
            return cleaned[:50] if len(cleaned) > 50 else cleaned
        return app_raw.replace(".exe", "").capitalize()

    # 3. Known system process friendly names
    if app_lower in SYSTEM_PROCESS_NAMES:
        return SYSTEM_PROCESS_NAMES[app_lower]

    # 4. Generic fallback: strip .exe and capitalize
    return app_raw.replace(".exe", "").capitalize() if app_raw else "Unknown"

def get_normalized_app_key(application_name, window_title):
    """Get a normalized key for grouping consecutive activity logs.
    Uses the specific name so consecutive logs of the same app group together
    even if the full window title changes slightly."""
    specific = extract_specific_name(application_name, window_title)
    # For very long specific names (like full Google Search queries), normalize to first 40 chars
    if len(specific) > 40:
        return specific[:40]
    return specific

@app.get("/api/sessions/{session_id}")
def get_session_details(session_id: int, db: Session = Depends(get_db)):
    """Get detailed minute-binned timeline, top distractions, AI classification and incidents for a specific session."""
    session = db.query(FocusSession).filter(FocusSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Query sorted chronologically ascending
    logs = db.query(WindowLog).filter(WindowLog.session_id == session_id).order_by(WindowLog.timestamp.asc()).all()
    total_logs = len(logs)
    distraction_logs = sum(1 for l in logs if l.is_distraction)
    focus_logs = total_logs - distraction_logs
    
    focus_score = round((focus_logs / max(total_logs, 1)) * 100) if total_logs > 0 else 0
    
    # Group distractions
    distractions_count = {}
    for log in logs:
        if log.is_distraction:
            key = extract_specific_name(log.application_name, log.window_title)
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
            
    # Compute chronological grouped activity timeline (both focus and distractions)
    activity_timeline = _build_activity_timeline(logs)
            
    # AI Classification of window logs — show as minutes (logs are 1/sec)
    from ml_service import activity_classifier
    cat_counts = {}
    for log in logs:
        cat, _ = activity_classifier.classify(log.window_title, log.is_distraction)
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        
    ai_categories = [
        {"name": k, "value": round(v / 60, 1)}
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
        "ai_categories": ai_categories,
        "incidents": incidents,
        "activity_timeline": activity_timeline
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

    # Calculate global categorization distribution — show as minutes (logs are 1/sec)
    all_logs = db.query(WindowLog).all()
    cat_counts = {"Work": 0, "Entertainment": 0, "Social Media": 0, "Communication": 0, "Utilities": 0}
    for l in all_logs:
        if l.window_title:
            cat, _ = activity_classifier.classify(l.window_title, l.is_distraction)
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
    # Convert raw log counts to minutes (tracker logs every 1 second)
    cat_counts = {k: round(v / 60, 1) for k, v in cat_counts.items()}
            
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

    # Top distractions grouped by SPECIFIC website/app name (not generic process name)
    distractions_count = {}
    for log in logs:
        if log.is_distraction:
            # Use smart extraction to get actual website name from window_title
            key = extract_specific_name(log.application_name, log.window_title)
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
        "overdue": sum(1 for t in todos if t.deadline and t.deadline < datetime.now() and t.status != "completed"),
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


# ─── Activity Timeline Builder ───────────────────────────────────────

def _build_activity_timeline(logs):
    """Build a chronological grouped activity timeline from a list of WindowLog entries.
    Groups consecutive logs from the same normalized app with the same distraction state."""
    activity_timeline = []
    if not logs:
        return activity_timeline
    
    current_group = None
    for log in logs:
        app_name = log.application_name or "Unknown App"
        window_title = log.window_title or "Untitled Window"
        # Use normalized key for grouping (so "Google Search query A" and "Google Search query B" group together)
        norm_key = get_normalized_app_key(app_name, window_title)
        specific_name = extract_specific_name(app_name, window_title)
        
        if not current_group:
            current_group = {
                "norm_key": norm_key,
                "specific_name": specific_name,
                "is_distraction": log.is_distraction,
                "start_time": log.timestamp,
                "end_time": log.timestamp,
                "titles": [window_title]
            }
        else:
            time_gap = (log.timestamp - current_group["end_time"]).total_seconds()
            # If same normalized app key, same distraction state, and gap is small (<= 15 seconds)
            if (current_group["norm_key"] == norm_key and 
                current_group["is_distraction"] == log.is_distraction and 
                time_gap <= 15):
                current_group["end_time"] = log.timestamp
                current_group["titles"].append(window_title)
            else:
                # Save completed group
                activity_timeline.append(_finalize_group(current_group))
                # Start new group
                current_group = {
                    "norm_key": norm_key,
                    "specific_name": specific_name,
                    "is_distraction": log.is_distraction,
                    "start_time": log.timestamp,
                    "end_time": log.timestamp,
                    "titles": [window_title]
                }
                
    # Append the final group
    if current_group:
        activity_timeline.append(_finalize_group(current_group))
    
    return activity_timeline

def _finalize_group(group):
    """Convert a raw group dict into a response-ready timeline entry."""
    duration_s = max(int((group["end_time"] - group["start_time"]).total_seconds()), 1)
    
    # Find most frequent title for display
    title_counts = {}
    for t in group["titles"]:
        title_counts[t] = title_counts.get(t, 0) + 1
    rep_title = max(title_counts, key=title_counts.get) if title_counts else "Unknown Activity"
    rep_title = clean_window_title(rep_title)
    
    if duration_s < 60:
        duration_fmt = f"{duration_s}s"
    else:
        mins = duration_s // 60
        secs = duration_s % 60
        duration_fmt = f"{mins}m {secs}s" if secs > 0 else f"{mins}m"
    
    return {
        "app": group["specific_name"],
        "title": rep_title,
        "start_time": group["start_time"].strftime("%H:%M:%S"),
        "end_time": group["end_time"].strftime("%H:%M:%S"),
        "duration_seconds": duration_s,
        "duration_formatted": duration_fmt,
        "is_distraction": group["is_distraction"]
    }


# ─── Live Session Timeline ───────────────────────────────────────────

@app.get("/api/session/live-timeline")
def get_live_timeline(db: Session = Depends(get_db)):
    """Get the activity timeline for the currently active session (real-time)."""
    if not app_state.is_tracking or app_state.active_session_id is None:
        return {"active": False, "timeline": [], "stats": None}
    
    session = db.query(FocusSession).filter(
        FocusSession.id == app_state.active_session_id
    ).first()
    if not session:
        return {"active": False, "timeline": [], "stats": None}
    
    logs = db.query(WindowLog).filter(
        WindowLog.session_id == app_state.active_session_id
    ).order_by(WindowLog.timestamp.asc()).all()
    
    total_logs = len(logs)
    distraction_logs = sum(1 for l in logs if l.is_distraction)
    focus_logs = total_logs - distraction_logs
    
    timeline = _build_activity_timeline(logs)
    
    elapsed_seconds = int((datetime.now() - session.start_time).total_seconds())
    
    return {
        "active": True,
        "session_id": session.id,
        "elapsed_seconds": elapsed_seconds,
        "elapsed_formatted": f"{elapsed_seconds // 60}m {elapsed_seconds % 60}s",
        "stats": {
            "total_logs": total_logs,
            "focus_minutes": round(focus_logs / 60, 1),
            "distraction_minutes": round(distraction_logs / 60, 1),
            "focus_score": round((focus_logs / max(total_logs, 1)) * 100) if total_logs > 0 else 0,
        },
        "timeline": timeline[-20:]  # Last 20 activity groups for performance
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
