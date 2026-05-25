import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'@app\.get\("/api/insights"\)\s*\ndef get_insights.*?return \{\n\s*"summary": summary,\n\s*"timeline": timeline,\n\s*"ai_categories": ai_categories\n\s*\}'

replacement = '''@app.get("/api/insights")
def get_insights(range: str = "today", current_user: User = Depends(get_optional_user), db: Session = Depends(get_db)):
    now = datetime.now()
    user_id = current_user.id if current_user else None
    
    # Filter base queries by date range
    if range == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
        sessions = db.query(FocusSession).filter(FocusSession.status == "completed", FocusSession.start_time >= start_time, FocusSession.user_id == user_id).all()
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
        sessions = db.query(FocusSession).filter(FocusSession.status == "completed", FocusSession.start_time >= start_time, FocusSession.user_id == user_id).all()
        session_ids = [s.id for s in sessions]
        logs = db.query(WindowLog).filter(WindowLog.timestamp >= start_time, WindowLog.session_id.in_(session_ids)).all() if session_ids else []
        
        todos = db.query(Todo).filter(
            Todo.user_id == user_id,
            ((Todo.deadline >= start_time) | (Todo.created_at >= start_time))
        ).all()
    else: # all time
        sessions = db.query(FocusSession).filter(FocusSession.status == "completed", FocusSession.user_id == user_id).all()
        session_ids = [s.id for s in sessions]
        logs = db.query(WindowLog).filter(WindowLog.session_id.in_(session_ids)).all() if session_ids else []
        todos = db.query(Todo).filter(Todo.user_id == user_id).all()

    # Calculate Summary
    total_duration = sum((s.total_duration or 0) for s in sessions)
    total_logs = len(logs)
    distraction_logs = sum(1 for l in logs if l.is_distraction)
    focus_logs = total_logs - distraction_logs
    
    focus_score = round((focus_logs / max(total_logs, 1)) * 100) if total_logs > 0 else 0
    
    summary = {
        "total_sessions": len(sessions),
        "total_minutes": round(total_duration / 60, 1),
        "focus_score": focus_score,
        "tasks_completed": sum(1 for t in todos if t.completed),
        "tasks_total": len(todos)
    }

    # Group distractions
    distractions_count = {}
    for log in logs:
        if log.is_distraction:
            key = extract_specific_name(log.application_name, log.window_title)
            distractions_count[key] = distractions_count.get(key, 0) + 1
            
    top_distractions = [
        {"name": k, "minutes": round(v / 60, 1)}
        for k, v in sorted(distractions_count.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    summary["top_distractions"] = top_distractions

    # Build detailed timeline
    timeline = []
    
    if range == "today":
        # Group by hour for today
        hour_bins = {}
        for log in logs:
            hour = log.timestamp.replace(minute=0, second=0, microsecond=0)
            if hour not in hour_bins:
                hour_bins[hour] = {"Focus": 0, "Distraction": 0}
            if log.is_distraction:
                hour_bins[hour]["Distraction"] += 1
            else:
                hour_bins[hour]["Focus"] += 1
                
        for hour in sorted(hour_bins.keys()):
            timeline.append({
                "time": hour.strftime("%I %p"),
                "Focus": round(hour_bins[hour]["Focus"] / 60, 1),
                "Distraction": round(hour_bins[hour]["Distraction"] / 60, 1)
            })
    else:
        # Group by day for week/all time
        day_bins = {}
        for log in logs:
            day = log.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
            if day not in day_bins:
                day_bins[day] = {"Focus": 0, "Distraction": 0}
            if log.is_distraction:
                day_bins[day]["Distraction"] += 1
            else:
                day_bins[day]["Focus"] += 1
                
        for day in sorted(day_bins.keys()):
            timeline.append({
                "time": day.strftime("%b %d"),
                "Focus": round(day_bins[day]["Focus"] / 60, 1),
                "Distraction": round(day_bins[day]["Distraction"] / 60, 1)
            })

    # AI Categories
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
        "summary": summary,
        "timeline": timeline,
        "ai_categories": ai_categories
    }'''

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
with open('main.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
