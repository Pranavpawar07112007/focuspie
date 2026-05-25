import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace get_optional_user with get_current_user
content = content.replace('Depends(get_optional_user)', 'Depends(get_current_user)')

# Replace user_id logic
# For get_settings
content = re.sub(r'def get_settings\(current_user: User = Depends\(get_current_user\), db: Session = Depends\(get_db\)\):\s+user_id = current_user\.id if current_user else None\s+settings = db\.query\(UserSettings\)\.filter\(UserSettings\.user_id == user_id\)\.first\(\)\s+if not settings:\s+settings = UserSettings\(user_id=user_id\)',
r'''def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)''', content)

# For update_settings
content = re.sub(r'def update_settings\(\s+updates: UserSettingsUpdate,\s+current_user: User = Depends\(get_current_user\),\s+db: Session = Depends\(get_db\),\s+\):\s+user_id = current_user\.id if current_user else None\s+settings = db\.query\(UserSettings\)\.filter\(UserSettings\.user_id == user_id\)\.first\(\)\s+if not settings:\s+settings = UserSettings\(user_id=user_id\)',
r'''def update_settings(
    updates: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)''', content)

# For get_all_sessions
content = re.sub(r'def get_all_sessions\(current_user: User = Depends\(get_current_user\), db: Session = Depends\(get_db\)\):\s+"""Get all completed focus sessions with summary statistics."""\s+user_id = current_user\.id if current_user else None\s+sessions = db\.query\(FocusSession\)\.filter\(\s+FocusSession\.status == "completed",\s+FocusSession\.user_id == user_id\s+\)\.order_by\(FocusSession\.start_time\.desc\(\)\)\.all\(\)',
r'''def get_all_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all completed focus sessions with summary statistics."""
    sessions = db.query(FocusSession).filter(
        FocusSession.status == "completed",
        FocusSession.user_id == current_user.id
    ).order_by(FocusSession.start_time.desc()).all()''', content)

# For get_session_details
content = re.sub(r'def get_session_details\(session_id: int, current_user: User = Depends\(get_current_user\), db: Session = Depends\(get_db\)\):\s+"""Get detailed minute-binned timeline, top distractions, AI classification and incidents for a specific session."""\s+user_id = current_user\.id if current_user else None\s+session = db\.query\(FocusSession\)\.filter\(FocusSession\.id == session_id, FocusSession\.user_id == user_id\)\.first\(\)',
r'''def get_session_details(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get detailed minute-binned timeline, top distractions, AI classification and incidents for a specific session."""
    session = db.query(FocusSession).filter(FocusSession.id == session_id, FocusSession.user_id == current_user.id).first()''', content)

# For predict_focus_forecast
content = re.sub(r'def predict_focus_forecast\(current_user: User = Depends\(get_current_user\), db: Session = Depends\(get_db\)\):\s+"""Predict expected focus score and return productivity categorization and trends."""\s+user_id = current_user\.id if current_user else None\s+sessions = db\.query\(FocusSession\)\.filter\(\s+FocusSession\.status == "completed",\s+FocusSession\.user_id == user_id\s+\)\.all\(\)',
r'''def predict_focus_forecast(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Predict expected focus score and return productivity categorization and trends."""
    sessions = db.query(FocusSession).filter(
        FocusSession.status == "completed",
        FocusSession.user_id == current_user.id
    ).all()''', content)

# For predict_focus_forecast calculate global categorization
content = re.sub(r'all_sessions = db\.query\(FocusSession\)\.filter\(FocusSession\.user_id == user_id\)\.all\(\)',
r'''all_sessions = db.query(FocusSession).filter(FocusSession.user_id == current_user.id).all()''', content)

# For get_todos
content = re.sub(r'def get_todos\(\s+current_user: User = Depends\(get_current_user\),\s+db: Session = Depends\(get_db\),\s+\):\s+user_id = current_user\.id if current_user else None\s+todos = db\.query\(Todo\)\.filter\(Todo\.user_id == user_id\)\.all\(\)',
r'''def get_todos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todos = db.query(Todo).filter(Todo.user_id == current_user.id).all()''', content)

# For get_insights
content = re.sub(r'def get_insights\(range: str = "today", current_user: User = Depends\(get_current_user\), db: Session = Depends\(get_db\)\):\s+now = datetime\.now\(\)\s+user_id = current_user\.id if current_user else None',
r'''def get_insights(range: str = "today", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now()
    user_id = current_user.id''', content)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
