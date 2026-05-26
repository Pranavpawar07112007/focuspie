from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
import asyncio
import json
import csv
import io
from contextlib import asynccontextmanager

from database import engine, Base, get_db, SessionLocal
from models import (
    FocusSession, WindowLog, Todo, User, UserSettings, FocusRoom, FocusRoomMember,
    TodoCreate, TodoUpdate, TodoResponse,
    SessionResponse, SessionStopResponse,
    UserCreate, UserLogin, TokenResponse, UserResponse,
    UserSettingsResponse, UserSettingsUpdate,
    RoomCreate, RoomResponse, JoinRoom, RoomMemberResponse
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_user,
)
from tracker import app_state, start_tracker
from blocker import block_websites, unblock_websites
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

def migrate_schema(db):
    try:
        result = db.execute(text("PRAGMA table_info(user_settings)")).fetchall()
        columns = [row[1] for row in result]
        if columns:
            if 'focus_duration' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN focus_duration INTEGER DEFAULT 25"))
            if 'short_break_duration' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN short_break_duration INTEGER DEFAULT 5"))
            if 'long_break_duration' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN long_break_duration INTEGER DEFAULT 15"))
            if 'pomodoro_intervals' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN pomodoro_intervals INTEGER DEFAULT 4"))
            if 'distraction_keywords' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN distraction_keywords TEXT DEFAULT '[]'"))
            if 'blocked_websites' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN blocked_websites TEXT DEFAULT '[]'"))
            if 'theme' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN theme TEXT DEFAULT 'light'"))
            if 'avatar_style' not in columns:
                db.execute(text("ALTER TABLE user_settings ADD COLUMN avatar_style TEXT DEFAULT 'fox'"))
            db.commit()
            print("Successfully migrated user_settings schema")
    except Exception as e:
        print(f"Error migrating schema: {e}")
        db.rollback()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure hosts file is clean on startup
    unblock_websites()

    # Run automatic timezone migration first
    db = SessionLocal()
    try:
        migrate_database_to_local_time(db)
        migrate_schema(db)
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


# ─── Health Check (unprotected, used by Electron) ────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ─── Auth Endpoints ──────────────────────────────────────────────────

@app.post("/api/auth/signup", response_model=TokenResponse)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    if not user_data.username or len(user_data.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if not user_data.password or len(user_data.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    
    existing = db.query(User).filter(User.username == user_data.username.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user = User(
        username=user_data.username.strip(),
        hashed_password=hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create default settings for the new user
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    db.commit()
    
    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, username=user.username)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_data.username.strip()).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, username=user.username)


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ─── Settings Endpoints ──────────────────────────────────────────────

@app.get("/api/settings", response_model=UserSettingsResponse)
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    keywords = json.loads(settings.distraction_keywords) if settings.distraction_keywords else []
    blocked_websites = json.loads(settings.blocked_websites) if settings.blocked_websites else []
    return UserSettingsResponse(
        focus_duration=settings.focus_duration,
        short_break_duration=settings.short_break_duration,
        long_break_duration=settings.long_break_duration,
        pomodoro_intervals=settings.pomodoro_intervals,
        distraction_keywords=keywords,
        blocked_websites=blocked_websites,
        theme=settings.theme,
        avatar_style=settings.avatar_style,
    )


@app.put("/api/settings", response_model=UserSettingsResponse)
def update_settings(
    updates: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    if updates.focus_duration is not None:
        settings.focus_duration = max(1, min(180, updates.focus_duration))
    if updates.short_break_duration is not None:
        settings.short_break_duration = max(1, min(60, updates.short_break_duration))
    if updates.long_break_duration is not None:
        settings.long_break_duration = max(1, min(60, updates.long_break_duration))
    if updates.pomodoro_intervals is not None:
        settings.pomodoro_intervals = max(1, min(10, updates.pomodoro_intervals))
    if updates.distraction_keywords is not None:
        settings.distraction_keywords = json.dumps(updates.distraction_keywords)
        # Update the tracker's live keywords
        app_state.update_keywords(updates.distraction_keywords)
    if updates.blocked_websites is not None:
        settings.blocked_websites = json.dumps(updates.blocked_websites)
    if updates.theme is not None:
        settings.theme = updates.theme
    if updates.avatar_style is not None:
        settings.avatar_style = updates.avatar_style
    
    db.commit()
    db.refresh(settings)
    
    keywords = json.loads(settings.distraction_keywords) if settings.distraction_keywords else []
    blocked_websites = json.loads(settings.blocked_websites) if settings.blocked_websites else []
    return UserSettingsResponse(
        focus_duration=settings.focus_duration,
        short_break_duration=settings.short_break_duration,
        long_break_duration=settings.long_break_duration,
        pomodoro_intervals=settings.pomodoro_intervals,
        distraction_keywords=keywords,
        blocked_websites=blocked_websites,
        theme=settings.theme,
        avatar_style=settings.avatar_style,
    )


# ─── Data Management Endpoints ───────────────────────────────────────

@app.get("/api/data/export")
def export_data(
    format: str = Query("json", regex="^(json|csv)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all user data as JSON or CSV."""
    sessions = db.query(FocusSession).filter(FocusSession.user_id == current_user.id).all()
    todos = db.query(Todo).filter(Todo.user_id == current_user.id).all()
    
    if format == "json":
        data = {
            "user": {"username": current_user.username, "created_at": current_user.created_at.isoformat()},
            "sessions": [
                {
                    "id": s.id,
                    "start_time": s.start_time.isoformat() if s.start_time else None,
                    "end_time": s.end_time.isoformat() if s.end_time else None,
                    "total_duration": s.total_duration,
                    "status": s.status,
                }
                for s in sessions
            ],
            "todos": [
                {
                    "id": t.id,
                    "task": t.task,
                    "completed": t.completed,
                    "priority": t.priority,
                    "status": t.status,
                    "deadline": t.deadline.isoformat() if t.deadline else None,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in todos
            ],
        }
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=focuspie_export.json"},
        )
    else:
        # CSV format
        output = io.StringIO()
        
        # Sessions sheet
        output.write("=== FOCUS SESSIONS ===\n")
        writer = csv.writer(output)
        writer.writerow(["ID", "Start Time", "End Time", "Duration (seconds)", "Status"])
        for s in sessions:
            writer.writerow([
                s.id,
                s.start_time.isoformat() if s.start_time else "",
                s.end_time.isoformat() if s.end_time else "",
                s.total_duration or 0,
                s.status,
            ])
        
        output.write("\n=== TODOS ===\n")
        writer.writerow(["ID", "Task", "Completed", "Priority", "Status", "Deadline", "Created At"])
        for t in todos:
            writer.writerow([
                t.id,
                t.task,
                t.completed,
                t.priority,
                t.status,
                t.deadline.isoformat() if t.deadline else "",
                t.created_at.isoformat() if t.created_at else "",
            ])
        
        content = output.getvalue()
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=focuspie_export.csv"},
        )


@app.delete("/api/data/delete-account")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete user account and all associated data."""
    # Delete window logs for user's sessions
    user_sessions = db.query(FocusSession).filter(FocusSession.user_id == current_user.id).all()
    for s in user_sessions:
        db.query(WindowLog).filter(WindowLog.session_id == s.id).delete()
    
    # Delete sessions
    db.query(FocusSession).filter(FocusSession.user_id == current_user.id).delete()
    # Delete todos
    db.query(Todo).filter(Todo.user_id == current_user.id).delete()
    # Delete settings
    db.query(UserSettings).filter(UserSettings.user_id == current_user.id).delete()
    # Delete user
    db.query(User).filter(User.id == current_user.id).delete()
    
    db.commit()
    return {"message": "Account and all data deleted permanently"}


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

from pydantic import BaseModel
class SessionStartRequest(BaseModel):
    room_id: Optional[int] = None

@app.post("/api/session/start", response_model=SessionResponse)
def start_session(
    req: Optional[SessionStartRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if app_state.is_tracking:
        raise HTTPException(status_code=400, detail="A session is already active")
    
    # Load user's custom distraction keywords and blocked websites if authenticated
    if current_user:
        settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
        if settings:
            if settings.distraction_keywords:
                try:
                    keywords = json.loads(settings.distraction_keywords)
                    app_state.update_keywords(keywords)
                except json.JSONDecodeError:
                    pass
            if settings.blocked_websites:
                try:
                    sites = json.loads(settings.blocked_websites)
                    block_websites(sites)
                except json.JSONDecodeError:
                    pass
    
    new_session = FocusSession(
        start_time=datetime.now(),
        status="active",
        user_id=current_user.id if current_user else None,
        room_id=req.room_id if req else None,
    )
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
    unblock_websites()
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
def get_all_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all completed focus sessions with summary statistics."""
    sessions = db.query(FocusSession).filter(
        FocusSession.status == "completed",
        FocusSession.user_id == current_user.id
    ).order_by(FocusSession.start_time.desc()).all()
    
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
def get_session_details(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get detailed minute-binned timeline, top distractions, AI classification and incidents for a specific session."""
    session = db.query(FocusSession).filter(FocusSession.id == session_id, FocusSession.user_id == current_user.id).first()
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
def predict_focus_forecast(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Predict expected focus score and return productivity categorization and trends."""
    sessions = db.query(FocusSession).filter(
        FocusSession.status == "completed",
        FocusSession.user_id == current_user.id
    ).all()
    
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
    all_sessions = db.query(FocusSession).filter(FocusSession.user_id == current_user.id).all()
    session_ids = [s.id for s in all_sessions]
    if session_ids:
        all_logs = db.query(WindowLog).filter(WindowLog.session_id.in_(session_ids)).all()
    else:
        all_logs = []
        
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
def get_todos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todos = db.query(Todo).filter(Todo.user_id == current_user.id).all()
    sorted_todos = smart_sort(todos)
    return [todo_to_response(t) for t in sorted_todos]

@app.post("/api/todos")
def create_todo(
    todo: TodoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_todo = Todo(
        task=todo.task,
        completed=todo.completed,
        priority=todo.priority,
        status=todo.status,
        deadline=todo.deadline,
        user_id=current_user.id if current_user else None,
    )
    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)
    return todo_to_response(new_todo)

@app.put("/api/todos/{todo_id}")
def update_todo(todo_id: int, todo_update: TodoUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == current_user.id).first()
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
def delete_todo(todo_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == current_user.id).first()
    if not db_todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(db_todo)
    db.commit()
    return {"message": "Todo deleted successfully"}


# ─── Calendar Endpoint ───────────────────────────────────────────────

@app.get("/api/calendar")
def get_calendar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all tasks and sessions organized by date for calendar view."""
    todos = db.query(Todo).filter(Todo.user_id == current_user.id).all()
    sessions = db.query(FocusSession).filter(FocusSession.status == "completed", FocusSession.user_id == current_user.id).all()

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
def get_insights(range: str = "today", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now()
    user_id = current_user.id
    
    # Filter base queries by date range, excluding room sessions
    if range == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
        sessions = db.query(FocusSession).filter(
            FocusSession.status == "completed", 
            FocusSession.start_time >= start_time, 
            FocusSession.user_id == user_id,
            FocusSession.room_id == None
        ).all()
        session_ids = [s.id for s in sessions]
        logs = db.query(WindowLog).filter(WindowLog.timestamp >= start_time, WindowLog.session_id.in_(session_ids)).all() if session_ids else []
        
        # Filter todos due today or created today
        end_time = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        todos = db.query(Todo).filter(
            Todo.user_id == user_id,
            (((Todo.deadline >= start_time) & (Todo.deadline <= end_time)) |
            ((Todo.created_at >= start_time) & (Todo.created_at <= end_time)))
        ).all()
    elif range == "week":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
        sessions = db.query(FocusSession).filter(
            FocusSession.status == "completed", 
            FocusSession.start_time >= start_time, 
            FocusSession.user_id == user_id,
            FocusSession.room_id == None
        ).all()
        session_ids = [s.id for s in sessions]
        logs = db.query(WindowLog).filter(WindowLog.timestamp >= start_time, WindowLog.session_id.in_(session_ids)).all() if session_ids else []
        
        todos = db.query(Todo).filter(
            Todo.user_id == user_id,
            ((Todo.deadline >= start_time) |
            (Todo.created_at >= start_time))
        ).all()
    else:
        # "all"
        sessions = db.query(FocusSession).filter(
            FocusSession.status == "completed", 
            FocusSession.user_id == user_id,
            FocusSession.room_id == None
        ).all()
        session_ids = [s.id for s in sessions]
        logs = db.query(WindowLog).filter(WindowLog.session_id.in_(session_ids)).all() if session_ids else []
        todos = db.query(Todo).filter(Todo.user_id == user_id).all()

    total_focus_seconds = sum(s.total_duration or 0 for s in sessions)
    total_sessions = len(sessions)

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
def get_live_timeline(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the activity timeline for the currently active session (real-time)."""
    if not app_state.is_tracking or app_state.active_session_id is None:
        return {"active": False, "timeline": [], "stats": None}
    
    session = db.query(FocusSession).filter(FocusSession.user_id == current_user.id, 
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


# ─── Room Endpoints ──────────────────────────────────────────────────

import string
import random

def generate_invite_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@app.post("/api/rooms", response_model=RoomResponse)
def create_room(room: RoomCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    code = generate_invite_code()
    while db.query(FocusRoom).filter(FocusRoom.invite_code == code).first():
        code = generate_invite_code()
        
    new_room = FocusRoom(
        name=room.name, 
        invite_code=code, 
        owner_id=current_user.id,
        timer_mode=room.timer_mode
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    # Add owner as member
    member = FocusRoomMember(user_id=current_user.id, room_id=new_room.id)
    db.add(member)
    db.commit()
    
    return get_room_response(new_room.id, db)

@app.post("/api/rooms/join", response_model=RoomResponse)
def join_room(join: JoinRoom, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.query(FocusRoom).filter(FocusRoom.invite_code == join.invite_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="Invalid invite code")
        
    existing = db.query(FocusRoomMember).filter(FocusRoomMember.user_id == current_user.id, FocusRoomMember.room_id == room.id).first()
    if not existing:
        member = FocusRoomMember(user_id=current_user.id, room_id=room.id)
        db.add(member)
        db.commit()
        
    return get_room_response(room.id, db)

@app.get("/api/rooms", response_model=list[RoomResponse])
def list_rooms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(FocusRoomMember).filter(FocusRoomMember.user_id == current_user.id).all()
    rooms = []
    for m in memberships:
        rooms.append(get_room_response(m.room_id, db))
    return rooms

@app.get("/api/rooms/{room_id}", response_model=RoomResponse)
def get_room(room_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(FocusRoomMember).filter(FocusRoomMember.user_id == current_user.id, FocusRoomMember.room_id == room_id).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    return get_room_response(room_id, db)

def get_room_response(room_id: int, db: Session):
    room = db.query(FocusRoom).filter(FocusRoom.id == room_id).first()
    members = db.query(FocusRoomMember).filter(FocusRoomMember.room_id == room.id).all()
    member_responses = []
    for m in members:
        settings = db.query(UserSettings).filter(UserSettings.user_id == m.user_id).first()
        user_obj = db.query(User).filter(User.id == m.user_id).first()
        member_responses.append({
            "user_id": m.user_id,
            "username": user_obj.username,
            "avatar_style": settings.avatar_style if settings else "fox"
        })
    return {
        "id": room.id,
        "name": room.name,
        "invite_code": room.invite_code,
        "owner_id": room.owner_id,
        "timer_mode": room.timer_mode,
        "members": member_responses
    }

@app.get("/api/rooms/{room_id}/insights")
def get_room_insights(room_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify membership
    membership = db.query(FocusRoomMember).filter(FocusRoomMember.user_id == current_user.id, FocusRoomMember.room_id == room_id).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")
        
    sessions = db.query(FocusSession).filter(
        FocusSession.status == "completed", 
        FocusSession.room_id == room_id
    ).all()
    
    session_ids = [s.id for s in sessions]
    logs = db.query(WindowLog).filter(WindowLog.session_id.in_(session_ids)).all() if session_ids else []
    
    total_focus_seconds = sum(s.total_duration or 0 for s in sessions)
    total_sessions = len(sessions)
    distraction_seconds = sum(1 for l in logs if l.is_distraction)
    focus_seconds = sum(1 for l in logs if not l.is_distraction)
    
    focus_score = round(focus_seconds / max(focus_seconds + distraction_seconds, 1) * 100) if logs else 0
    
    distractions_count = {}
    for log in logs:
        if log.is_distraction:
            key = extract_specific_name(log.application_name, log.window_title)
            distractions_count[key] = distractions_count.get(key, 0) + 1
            
    top_distractions = [
        {"name": k, "minutes": round(v / 60, 1)}
        for k, v in sorted(distractions_count.items(), key=lambda x: x[1], reverse=True)[:6]
    ]
    
    # Timeline
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
    
    return {
        "summary": {
            "total_focus_minutes": round(total_focus_seconds / 60, 1),
            "total_distraction_minutes": round(distraction_seconds / 60, 1),
            "total_sessions": total_sessions,
            "focus_score": focus_score,
        },
        "timeline": timeline,
        "top_distractions": top_distractions
    }

@app.delete("/api/rooms/{room_id}")
async def delete_room(room_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.query(FocusRoom).filter(FocusRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete the room")
    
    db.query(FocusRoomMember).filter(FocusRoomMember.room_id == room_id).delete()
    db.delete(room)
    db.commit()
    
    await manager.broadcast(json.dumps({"type": "ROOM_DELETED"}), room_id)
    return {"message": "Room deleted"}

@app.delete("/api/rooms/{room_id}/members/{user_id}")
async def kick_member(room_id: int, user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.query(FocusRoom).filter(FocusRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can kick members")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot kick yourself")
        
    member = db.query(FocusRoomMember).filter(FocusRoomMember.room_id == room_id, FocusRoomMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not in room")
        
    db.delete(member)
    db.commit()
    
    await manager.broadcast(json.dumps({"type": "MEMBER_KICKED", "user_id": user_id}), room_id)
    return {"message": "Member removed"}

@app.delete("/api/rooms/{room_id}/leave")
async def leave_room(room_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(FocusRoomMember).filter(FocusRoomMember.user_id == current_user.id, FocusRoomMember.room_id == room_id).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Not in room")
    db.delete(membership)
    db.commit()

    room = db.query(FocusRoom).filter(FocusRoom.id == room_id).first()
    if room:
        members = db.query(FocusRoomMember).filter(FocusRoomMember.room_id == room.id).all()
        if not members:
            # delete room if empty
            db.delete(room)
            db.commit()
        elif room.owner_id == current_user.id:
            # transfer ownership to oldest remaining member
            next_owner = db.query(FocusRoomMember).filter(FocusRoomMember.room_id == room.id).order_by(FocusRoomMember.id.asc()).first()
            if next_owner:
                room.owner_id = next_owner.user_id
                db.commit()
                
        # Broadcast that the member left to trigger a refresh for remaining members
        asyncio.create_task(manager.broadcast(json.dumps({"type": "MEMBER_LEFT"}), room_id))

    return {"message": "Left room"}

# ─── WebSocket ───────────────────────────────────────────────────────

from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # room_id -> list of WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Track owner presence: room_id -> boolean
        self.owner_online: Dict[int, bool] = {}
        # Track socket to user map to detect owner
        self.socket_user_map: Dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, room_id: int, user_id: int = None):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        
        if user_id is not None:
            self.socket_user_map[websocket] = user_id
            # Check if this user is the owner
            db = SessionLocal()
            try:
                room = db.query(FocusRoom).filter(FocusRoom.id == room_id).first()
                if room and room.owner_id == user_id:
                    self.owner_online[room_id] = True
                    await self.broadcast(json.dumps({"type": "OWNER_ONLINE"}), room_id)
            finally:
                db.close()
                
            # If they just joined, broadcast current owner status to them just in case
            if room_id in self.owner_online and not self.owner_online[room_id]:
                await websocket.send_text(json.dumps({"type": "OWNER_OFFLINE"}))

    async def disconnect(self, websocket: WebSocket, room_id: int):
        if room_id in self.active_connections:
            try:
                self.active_connections[room_id].remove(websocket)
            except ValueError:
                pass
                
        user_id = self.socket_user_map.pop(websocket, None)
        if user_id is not None:
            db = SessionLocal()
            try:
                room = db.query(FocusRoom).filter(FocusRoom.id == room_id).first()
                if room and room.owner_id == user_id:
                    self.owner_online[room_id] = False
                    await self.broadcast(json.dumps({"type": "OWNER_OFFLINE"}), room_id)
            finally:
                db.close()

    async def broadcast(self, message: str, room_id: int):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass

manager = ConnectionManager()

@app.websocket("/ws/rooms/{room_id}")
async def websocket_room(websocket: WebSocket, room_id: int, user_id: int = Query(None)):
    await manager.connect(websocket, room_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast the state to all connected clients in the room
            await manager.broadcast(data, room_id)
    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id)

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

if __name__ == "__main__":
    import uvicorn
    import multiprocessing
    
    # On Windows, PyInstaller requires this for multiprocessing to work safely
    multiprocessing.freeze_support()
    
    # Run the server
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
