import time
import threading
import win32gui
import win32process
import psutil
from datetime import datetime

class AppState:
    def __init__(self):
        self.active_session_id = None
        self.is_tracking = False
        self.distraction_keywords = ["YouTube", "Netflix", "Twitch"]
        self.alerts = []
        self.lock = threading.Lock()

app_state = AppState()

def get_active_window_info():
    try:
        window = win32gui.GetForegroundWindow()
        title = win32gui.GetWindowText(window)
        
        _, pid = win32process.GetWindowThreadProcessId(window)
        process = psutil.Process(pid)
        app_name = process.name()
        
        return title, app_name, window
    except Exception as e:
        return "Unknown", "Unknown", None

def minimize_window(hwnd):
    try:
        import win32con
        win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)
    except Exception as e:
        pass

def tracker_thread(db_session_maker):
    while True:
        if app_state.is_tracking and app_state.active_session_id is not None:
            title, app_name, hwnd = get_active_window_info()
            
            if title and title != "Unknown":
                is_distraction = any(keyword.lower() in title.lower() for keyword in app_state.distraction_keywords)
                
                # Log to DB
                db = db_session_maker()
                try:
                    from models import WindowLog
                    log = WindowLog(
                        window_title=title,
                        application_name=app_name,
                        is_distraction=is_distraction,
                        session_id=app_state.active_session_id
                    )
                    db.add(log)
                    db.commit()
                except Exception as e:
                    print(f"DB Error: {e}")
                finally:
                    db.close()
                
                if is_distraction:
                    print(f"Distraction detected: {title}")
                    if hwnd:
                        minimize_window(hwnd)
                    
                    with app_state.lock:
                        app_state.alerts.append({"type": "distraction", "title": title, "app": app_name})
                        
        time.sleep(1)

def start_tracker(db_session_maker):
    thread = threading.Thread(target=tracker_thread, args=(db_session_maker,), daemon=True)
    thread.start()
