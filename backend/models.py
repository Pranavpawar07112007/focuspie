from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
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

class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    total_duration = Column(Integer, default=0)  # seconds
    status = Column(String, default="active")     # active, completed, stopped

    logs = relationship("WindowLog", back_populates="session")


class WindowLog(Base):
    __tablename__ = "window_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
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
    created_at = Column(DateTime, default=datetime.utcnow)


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
