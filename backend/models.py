from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from pydantic import BaseModel
from typing import Optional, List
import enum


# ─── Enums ───────────────────────────────────────────────────────────

class PriorityEnum(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"

class StatusEnum(str, enum.Enum):
    pending = "pending"
    ongoing = "ongoing"
    completed = "completed"


# ─── SQLAlchemy Models ───────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("FocusSession", back_populates="user", cascade="all, delete-orphan")
    todos = relationship("Todo", back_populates="user", cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    focus_duration = Column(Integer, default=25)        # minutes
    short_break_duration = Column(Integer, default=5)   # minutes
    long_break_duration = Column(Integer, default=15)   # minutes
    pomodoro_intervals = Column(Integer, default=4)
    distraction_keywords = Column(Text, default='["YouTube","Netflix","Twitch","Facebook","Instagram","Reddit","Twitter","x.com","Pinterest","LinkedIn","WhatsApp","Discord","Spotify","Steam","Roblox","TikTok"]')
    theme = Column(String, default="light")
    avatar_style = Column(String, default="fox")

    user = relationship("User", back_populates="settings")


class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.now)
    end_time = Column(DateTime, nullable=True)
    total_duration = Column(Integer, default=0)  # seconds
    status = Column(String, default="active")     # active, completed, stopped
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    logs = relationship("WindowLog", back_populates="session")
    user = relationship("User", back_populates="sessions")


class WindowLog(Base):
    __tablename__ = "window_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.now)
    window_title = Column(String)
    application_name = Column(String)
    is_distraction = Column(Boolean, default=False)
    session_id = Column(Integer, ForeignKey("focus_sessions.id"))

    session = relationship("FocusSession", back_populates="logs")


class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    task = Column(String, index=True)
    completed = Column(Boolean, default=False)
    priority = Column(String, default="medium")   # high, medium, low
    status = Column(String, default="pending")     # pending, ongoing, completed
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="todos")


# ─── Pydantic Schemas ────────────────────────────────────────────────

class TodoBase(BaseModel):
    task: str
    completed: bool = False
    priority: str = "medium"
    status: str = "pending"
    deadline: Optional[datetime] = None

class TodoCreate(TodoBase):
    pass

class TodoUpdate(BaseModel):
    task: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None

class TodoResponse(TodoBase):
    id: int
    created_at: datetime
    deadline_warning: Optional[str] = None

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: int
    start_time: datetime
    status: str

    class Config:
        from_attributes = True

class SessionStopResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: datetime
    total_duration: int
    status: str

    class Config:
        from_attributes = True


# ─── Auth Schemas ────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Settings Schemas ────────────────────────────────────────────────

class UserSettingsResponse(BaseModel):
    focus_duration: int
    short_break_duration: int
    long_break_duration: int
    pomodoro_intervals: int
    distraction_keywords: List[str]
    theme: str
    avatar_style: str

class UserSettingsUpdate(BaseModel):
    focus_duration: Optional[int] = None
    short_break_duration: Optional[int] = None
    long_break_duration: Optional[int] = None
    pomodoro_intervals: Optional[int] = None
    distraction_keywords: Optional[List[str]] = None
    theme: Optional[str] = None
    avatar_style: Optional[str] = None
