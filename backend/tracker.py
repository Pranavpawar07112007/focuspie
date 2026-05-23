import time
import threading
import win32gui
import win32process
import psutil
import subprocess
from datetime import datetime

def send_notification(title, message):
    msg_escaped = message.replace('"', '`"').replace("'", "`'")
    title_escaped = title.replace('"', '`"').replace("'", "`'")
    ps_cmd = f'''
    [void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
    $objNotifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $objNotifyIcon.Icon = [System.Drawing.SystemIcons]::Warning
    $objNotifyIcon.BalloonTipIcon = "Warning"
    $objNotifyIcon.BalloonTipText = "{msg_escaped}"
    $objNotifyIcon.BalloonTipTitle = "{title_escaped}"
    $objNotifyIcon.Visible = $True
    $objNotifyIcon.ShowBalloonTip(7000)
    '''
    try:
        subprocess.Popen(["powershell", "-Command", ps_cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"Failed to send notification: {e}")

class AppState:
    def __init__(self):
        self.active_session_id = None
        self.is_tracking = False
        self.on_break = False # Support Pomodoro breaks and pauses
        self.distraction_keywords = [
            "YouTube", "Netflix", "Twitch", "Facebook", "Instagram", 
            "Reddit", "Twitter", "x.com", "Pinterest", "LinkedIn", 
            "WhatsApp", "Discord", "Spotify", "Steam", "Roblox", "TikTok"
        ]
        self.alerts = []
        self.lock = threading.Lock()
        
        # Distraction tracking state
        self.current_distraction_hwnd = None
        self.current_distraction_start_time = None
        self.distraction_attempts = 0
        self.last_alert_timestamp = 0 # Prevent double notifications/double counting within cooldown

    def update_keywords(self, keywords_list):
        """Update distraction keywords dynamically from user settings."""
        with self.lock:
            self.distraction_keywords = list(keywords_list)

app_state = AppState()

SYSTEM_FRIENDLY_NAMES = {
    "shellexperiencehost.exe": "Windows Shell",
    "applicationframehost.exe": "UWP App",
    "searchhost.exe": "Windows Search",
    "explorer.exe": "File Explorer",
    "taskmgr.exe": "Task Manager",
    "systemsettings.exe": "Settings",
}

BROWSER_TITLE_SUFFIXES = [
    " - Google Chrome", " - Microsoft\u200b Edge", " - Microsoft Edge",
    " - Mozilla Firefox", " - Brave", " - Opera", " - Vivaldi",
]

def get_specific_app_name(title, app_name):
    """Return a highly specific site/app name for browsers instead of generic chrome.exe/msedge.exe."""
    if not title or title == "Unknown":
        return app_name.replace(".exe", "").capitalize()
        
    app_lower = app_name.lower()
    
    # Handle known system processes
    if app_lower in SYSTEM_FRIENDLY_NAMES:
        return SYSTEM_FRIENDLY_NAMES[app_lower]
    
    if app_lower in ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"]:
        # It's a browser. Check if any distraction keyword matches
        for keyword in app_state.distraction_keywords:
            if keyword.lower() in title.lower():
                return keyword
                
        # Strip browser suffix from the title (handle invisible unicode too)
        cleaned_title = title
        for suffix in BROWSER_TITLE_SUFFIXES:
            if cleaned_title.endswith(suffix):
                cleaned_title = cleaned_title[:-len(suffix)]
                break
        
        # If the cleaned title contains " - ", the last part is usually the site/app name
        cleaned_title = cleaned_title.strip()
        if " - " in cleaned_title:
            parts = cleaned_title.split(" - ")
            # Return the last meaningful part (usually the site/app name like "Google Drive")
            site = parts[-1].strip()
            if len(site) > 2:
                return site
            return parts[0].strip()
        
        # Return cleaned title if it's not too long, otherwise truncate
        if cleaned_title:
            return cleaned_title[:50] if len(cleaned_title) > 50 else cleaned_title
        return title[:50] if len(title) > 50 else title
        
    return app_name.replace(".exe", "").capitalize()

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

def terminate_process(hwnd):
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        process = psutil.Process(pid)
        process.terminate()
        return process.name()
    except Exception as e:
        print(f"Failed to terminate process: {e}")
        return "Unknown"

def tracker_thread(db_session_maker):
    while True:
        # Check if tracking, has active session, and NOT on break
        if app_state.is_tracking and app_state.active_session_id is not None and not app_state.on_break:
            title, app_name, hwnd = get_active_window_info()
            
            if title and title != "Unknown":
                is_distraction = any(keyword.lower() in title.lower() for keyword in app_state.distraction_keywords)
                specific_app = get_specific_app_name(title, app_name)
                
                # Log to DB (only log positive active detections)
                db = db_session_maker()
                try:
                    from models import WindowLog
                    log = WindowLog(
                        window_title=title,
                        application_name=specific_app, # Save the specific website/application activity
                        is_distraction=is_distraction,
                        session_id=app_state.active_session_id
                    )
                    db.add(log)
                    db.commit()
                except Exception as e:
                    print(f"DB Error: {e}")
                finally:
                    db.close()
                
                # Online Machine Learning classification training
                try:
                    from ml_service import activity_classifier
                    if is_distraction:
                        matched_cat = "Entertainment"
                        for kw in ["reddit", "facebook", "instagram", "twitter", "x.com", "pinterest", "linkedin"]:
                            if kw in title.lower():
                                matched_cat = "Social Media"
                                break
                        for kw in ["discord", "whatsapp", "slack"]:
                            if kw in title.lower():
                                matched_cat = "Communication"
                                break
                        activity_classifier.train(title, matched_cat)
                    else:
                        matched_cat = "Work"
                        for kw in ["explorer", "settings", "taskmgr", "desktop", "calculator", "notepad", "control panel", "system"]:
                            if kw in title.lower():
                                matched_cat = "Utilities"
                                break
                        activity_classifier.train(title, matched_cat)
                except Exception as e:
                    print(f"ML online training error: {e}")
                
                if is_distraction:
                    # Distraction opened/detected
                    if hwnd != app_state.current_distraction_hwnd:
                        now_time = time.time()
                        # Cooldown check: prevent double counting attempts if focus shifted recently (cooldown: 5.0 seconds)
                        if now_time - app_state.last_alert_timestamp > 5.0:
                            if app_state.distraction_attempts >= 10:
                                # Close the app directly!
                                terminated_app = terminate_process(hwnd)
                                send_notification(
                                    "App Force Closed! 🚫", 
                                    f"Distracting app {terminated_app} was closed because you reached 10 attempts."
                                )
                                app_state.current_distraction_hwnd = None
                                app_state.current_distraction_start_time = None
                            else:
                                app_state.distraction_attempts += 1
                                app_state.current_distraction_hwnd = hwnd
                                app_state.current_distraction_start_time = now_time
                                app_state.last_alert_timestamp = now_time
                                
                                warning_msg = f"Distraction detected: {specific_app}! Close it in 15s or it will be minimized. (Attempt {app_state.distraction_attempts}/10)"
                                if app_state.distraction_attempts >= 8:
                                    warning_msg = f"DANGER: Attempt {app_state.distraction_attempts}/10! Opening distractions 10 times will FORCE CLOSE the app entirely!"
                                
                                send_notification("Focus Alert! ⚠️", warning_msg)
                                
                                with app_state.lock:
                                    app_state.alerts.append({
                                        "type": "distraction", 
                                        "title": f"{specific_app} (Warning: Attempt {app_state.distraction_attempts}/10)", 
                                        "app": specific_app
                                    })
                        else:
                            # Keep tracking current window but skip counting as new attempt
                            app_state.current_distraction_hwnd = hwnd
                    else:
                        # Continuing distraction window
                        elapsed = time.time() - app_state.current_distraction_start_time
                        if elapsed >= 15: # Return timer increased to 15s
                            if app_state.distraction_attempts >= 10:
                                # Close the app directly!
                                terminated_app = terminate_process(hwnd)
                                send_notification(
                                    "App Force Closed! 🚫", 
                                    f"Distracting app {terminated_app} was closed because you reached 10 attempts."
                                )
                            else:
                                # Minimize it!
                                minimize_window(hwnd)
                                send_notification(
                                    "Focus Restored! 🔒", 
                                    f"Distracting window was minimized. Keep focused!"
                                )
                            
                            app_state.current_distraction_hwnd = None
                            app_state.current_distraction_start_time = None
                else:
                    # User is focused
                    app_state.current_distraction_hwnd = None
                    app_state.current_distraction_start_time = None
                        
        time.sleep(1)

def start_tracker(db_session_maker):
    thread = threading.Thread(target=tracker_thread, args=(db_session_maker,), daemon=True)
    thread.start()
