import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ─── Resolve database path to user's AppData/Local for PyInstaller compatibility ───
def _get_db_path():
    """Get the absolute path to the SQLite database file.
    Uses %LOCALAPPDATA%/FocusPie/ on Windows so the DB survives PyInstaller temp extraction."""
    app_data = os.environ.get('LOCALAPPDATA')
    if app_data:
        db_dir = os.path.join(app_data, 'FocusPie')
    else:
        # Fallback for non-Windows or missing env var
        db_dir = os.path.join(os.path.expanduser('~'), '.focuspie')
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, 'focuspie.db')

DB_PATH = _get_db_path()
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 15}
)

from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
