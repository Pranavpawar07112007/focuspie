import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Update create_todo, update_todo, get_calendar, get_live_timeline, delete_todo to use current_user strictly
# Actually, I'll just do a precise replace for each one.

# update_todo
content = re.sub(r'def update_todo\(todo_id: int, todo_update: TodoUpdate, db: Session = Depends\(get_db\)\):\s+db_todo = db\.query\(Todo\)\.filter\(Todo\.id == todo_id\)\.first\(\)',
r'''def update_todo(todo_id: int, todo_update: TodoUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == current_user.id).first()''', content)

# delete_todo (if it exists)
content = re.sub(r'def delete_todo\(todo_id: int, db: Session = Depends\(get_db\)\):\s+db_todo = db\.query\(Todo\)\.filter\(Todo\.id == todo_id\)\.first\(\)',
r'''def delete_todo(todo_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == current_user.id).first()''', content)

# get_calendar
content = re.sub(r'def get_calendar\(db: Session = Depends\(get_db\)\):\s+"""Return all tasks and sessions organized by date for calendar view."""\s+todos = db\.query\(Todo\)\.all\(\)\s+sessions = db\.query\(FocusSession\)\.filter\(FocusSession\.status == "completed"\)\.all\(\)',
r'''def get_calendar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all tasks and sessions organized by date for calendar view."""
    todos = db.query(Todo).filter(Todo.user_id == current_user.id).all()
    sessions = db.query(FocusSession).filter(FocusSession.status == "completed", FocusSession.user_id == current_user.id).all()''', content)

# get_live_timeline
content = re.sub(r'def get_live_timeline\(db: Session = Depends\(get_db\)\):\s+"""Get the activity timeline for the currently active session \(real-time\)\."""\s+if not app_state\.is_tracking or app_state\.active_session_id is None:\s+return {"active": False, "timeline": \[\], "stats": None}\s+session = db\.query\(FocusSession\)\.filter\(',
r'''def get_live_timeline(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the activity timeline for the currently active session (real-time)."""
    if not app_state.is_tracking or app_state.active_session_id is None:
        return {"active": False, "timeline": [], "stats": None}
    
    session = db.query(FocusSession).filter(FocusSession.user_id == current_user.id, ''', content)


with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
