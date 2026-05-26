from database import DB_PATH
import sqlite3

try:
    print("Using DB:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE focus_rooms ADD COLUMN timer_mode VARCHAR DEFAULT 'individual'")
        print("Added timer_mode to focus_rooms")
    except Exception as e:
        print("focus_rooms alter error:", e)
        
    try:
        c.execute("ALTER TABLE focus_sessions ADD COLUMN room_id INTEGER REFERENCES focus_rooms(id) ON DELETE SET NULL")
        print("Added room_id to focus_sessions")
    except Exception as e:
        print("focus_sessions alter error:", e)
        
    conn.commit()
    conn.close()
    print("Database altered successfully.")
except Exception as e:
    print("Global error:", e)
