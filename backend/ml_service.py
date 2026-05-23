import math
from datetime import datetime

# ─── Naive Bayes Activity Classifier ─────────────────────────────────

class ActivityClassifier:
    def __init__(self):
        import os
        # Bootstrap training data for standard categories
        self.categories = ["Work", "Entertainment", "Social Media", "Communication", "Utilities"]
        
        # Word counts per category
        self.word_counts = {cat: {} for cat in self.categories}
        # Total words count in each category
        self.total_word_counts = {cat: 0 for cat in self.categories}
        # Vocabulary set
        self.vocab = set()
        
        # Persistent model path setup — use AppData for PyInstaller compatibility
        app_data = os.environ.get('LOCALAPPDATA')
        if app_data:
            model_dir = os.path.join(app_data, 'FocusPie')
        else:
            model_dir = os.path.join(os.path.expanduser('~'), '.focuspie')
        os.makedirs(model_dir, exist_ok=True)
        self.model_path = os.path.join(model_dir, "activity_model.json")
        
        if os.path.exists(self.model_path):
            self.load_model()
        else:
            self._bootstrap_vocabulary()
            self.save_model()

    def _bootstrap_vocabulary(self):
        # Bootstrapping common keywords to make classification work perfectly out of the box
        bootstrap_data = {
            "Work": [
                "python", "code", "vscode", "developer", "main.py", "tracker.py", "github", 
                "gitlab", "terminal", "powershell", "cmd", "stack", "overflow", "fastapi", 
                "react", "vite", "npm", "node", "doc", "pdf", "classroom", "canvas", 
                "excel", "word", "notion", "figma", "database", "sqlite", "db", "localhost", 
                "tutorial", "stackoverflow", "rust", "cpp", "java", "coursera", "udemy",
                "google", "drive", "docs", "sheets", "slides", "search", "assignment",
                "homework", "lecture", "notes", "study", "research", "thesis", "paper",
                "module", "chapter", "exam", "quiz", "beta", "gamma", "distribution",
                "probability", "statistics", "math", "calculate", "formula", "equation",
                "normal", "exponential", "mean", "median", "deviation", "integral",
                "focuspie", "antigravity", "ide", "workspace", "project"
            ],
            "Entertainment": [
                "youtube", "netflix", "twitch", "spotify", "movie", "anime", "video", 
                "steam", "roblox", "game", "minecraft", "play", "music", "song", "hulu", 
                "prime", "disney", "valheim", "epic", "gta", "fifa", "cyberpunk"
            ],
            "Social Media": [
                "reddit", "facebook", "instagram", "twitter", "x.com", "pinterest", 
                "linkedin", "tiktok", "snapchat", "tumblr", "quora", "weibo"
            ],
            "Communication": [
                "discord", "whatsapp", "slack", "mail", "outlook", "gmail", "teams", 
                "zoom", "meet", "messenger", "skype", "telegram"
            ],
            "Utilities": [
                "explorer", "settings", "taskmgr", "desktop", "download", "calculator", 
                "notepad", "control panel", "file explorer", "system", "properties",
                "shellexperiencehost", "applicationframehost", "searchhost",
                "new tab", "start menu", "taskbar", "action center", "notification"
            ]
        }
        
        for cat, words in bootstrap_data.items():
            for word in words:
                self.train_word(word, cat, weight=10) # Heavy bootstrapping weight

    def train_word(self, word, category, weight=1):
        word = word.lower().strip()
        if not word or len(word) < 2:
            return
            
        self.vocab.add(word)
        self.word_counts[category][word] = self.word_counts[category].get(word, 0) + weight
        self.total_word_counts[category] += weight

    def save_model(self):
        import json
        try:
            data = {
                "word_counts": self.word_counts,
                "total_word_counts": self.total_word_counts,
                "vocab": list(self.vocab)
            }
            with open(self.model_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            print(f"Failed to save ML model: {e}")

    def load_model(self):
        import json
        try:
            with open(self.model_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.word_counts = data.get("word_counts", {cat: {} for cat in self.categories})
            self.total_word_counts = data.get("total_word_counts", {cat: 0 for cat in self.categories})
            self.vocab = set(data.get("vocab", []))
        except Exception as e:
            print(f"Failed to load ML model, reverting to bootstrap: {e}")
            self._bootstrap_vocabulary()

    def tokenize(self, title):
        if not title:
            return []
        # Simple tokenizer: split by non-alphabetic characters
        cleaned = "".join([c.lower() if c.isalnum() else " " for c in title])
        words = [w for w in cleaned.split() if len(w) >= 3]
        return words

    def train(self, title, category):
        words = self.tokenize(title)
        for w in words:
            self.train_word(w, category, weight=1)
        self.save_model()

    def classify(self, title, is_distraction=None):
        words = self.tokenize(title)
        
        # Filter categories based on distraction flag if provided
        if is_distraction is True:
            allowed_cats = ["Entertainment", "Social Media", "Communication"]
            default_cat = "Entertainment"
        elif is_distraction is False:
            allowed_cats = ["Work", "Utilities"]
            default_cat = "Work"
        else:
            allowed_cats = self.categories
            default_cat = "Work"
            
        if not words:
            # Default fallback based on basic keyword check
            title_lower = title.lower()
            
            # If we know it's a distraction, classify into distraction categories
            if is_distraction is True or is_distraction is None:
                if any(kw in title_lower for kw in ["youtube", "netflix", "twitch", "spotify", "steam", "roblox", "game", "minecraft", "play", "music", "song"]):
                    return "Entertainment", 0.9
                if any(kw in title_lower for kw in ["reddit", "facebook", "instagram", "twitter", "x.com", "pinterest", "linkedin", "tiktok", "snapchat"]):
                    return "Social Media", 0.9
                if any(kw in title_lower for kw in ["discord", "whatsapp", "slack", "messenger", "telegram"]):
                    return "Communication", 0.9
                if is_distraction is True:
                    return "Entertainment", 0.6
                    
            # If we know it's not a distraction, or we don't know
            if is_distraction is False or is_distraction is None:
                if any(kw in title_lower for kw in ["explorer", "settings", "taskmgr", "desktop", "calculator", "notepad", "control panel", "system"]):
                    return "Utilities", 0.9
                return "Work", 0.6
                
            return default_cat, 0.5
            
        best_cat = default_cat
        best_prob = -float("inf")
        probs = {}
        
        vocab_size = len(self.vocab)
        
        for cat in allowed_cats:
            # Log probability initialized to class prior P(C) - assuming uniform prior for simplicity
            log_prob = 0.0
            
            for word in words:
                count = self.word_counts[cat].get(word, 0)
                # Laplace smoothing
                word_prob = (count + 1) / (self.total_word_counts[cat] + vocab_size + 1)
                log_prob += math.log(word_prob)
                
            probs[cat] = log_prob
            if log_prob > best_prob:
                best_prob = log_prob
                best_cat = cat
                
        # Convert log probability to a soft confidence rating [0, 1]
        max_log = max(probs.values())
        sum_exp = sum(math.exp(p - max_log) for p in probs.values())
        confidence = 1.0 / sum_exp
        
        return best_cat, round(confidence, 2)


# ─── K-Nearest Neighbors (KNN) Focus Score Forecast ─────────────────

class FocusPredictor:
    def __init__(self):
        # Training data list of tuples: (hour_normalized, weekday_normalized, focus_score)
        self.data_points = []

    def load_historical_data(self, sessions_list):
        """
        sessions_list is a list of dicts:
        [{"start_time": datetime, "focus_score": int}]
        """
        self.data_points = []
        for s in sessions_list:
            dt = s["start_time"]
            score = s["focus_score"]
            
            # Normalize circular values:
            # Hour: 0-23
            hour_normalized = dt.hour + (dt.minute / 60.0)
            # Weekday: 0-6
            weekday_normalized = dt.weekday()
            
            self.data_points.append((hour_normalized, weekday_normalized, score))

    def predict(self, target_time=None, K=3):
        """
        Predict expected focus score for target_time (default now).
        Calculates distance using circular mathematics.
        """
        if target_time is None:
            target_time = datetime.now()
            
        if len(self.data_points) < 2:
            # Fallback when there is not enough historical data
            return self._get_time_of_day_default(target_time.hour), "Insufficient data to calibrate AI"
            
        target_h = target_time.hour + (target_time.minute / 60.0)
        target_w = target_time.weekday()
        
        distances = []
        for hour, weekday, score in self.data_points:
            # Circular distance for Hour (0-24)
            diff_h = abs(target_h - hour)
            dist_h = min(diff_h, 24.0 - diff_h) / 12.0 # Normalized [0, 1]
            
            # Circular distance for Weekday (0-7)
            diff_w = abs(target_w - weekday)
            dist_w = min(diff_w, 7.0 - diff_w) / 3.5 # Normalized [0, 1]
            
            # Euclidean distance
            total_dist = math.sqrt(dist_h**2 + dist_w**2)
            distances.append((total_dist, score))
            
        # Sort by distance
        distances.sort(key=lambda x: x[0])
        
        # Take K nearest neighbors
        k_neighbors = distances[:min(K, len(distances))]
        
        # Average with distance-based weighting (closer neighbors have more weight)
        total_weight = 0
        weighted_sum = 0
        
        for dist, score in k_neighbors:
            # Add small epsilon to avoid divide-by-zero
            weight = 1.0 / (dist + 0.05)
            weighted_sum += score * weight
            total_weight += weight
            
        predicted_score = round(weighted_sum / total_weight)
        
        # Formulate AI description advice
        advice = self._generate_ai_advice(predicted_score, target_time.hour)
        
        return predicted_score, advice

    def _get_time_of_day_default(self, hour):
        # High quality defaults based on human circadian rhythm studies
        if 8 <= hour < 12:   # Morning focus peak
            return 82
        elif 12 <= hour < 14: # Lunch dip
            return 65
        elif 14 <= hour < 18: # Afternoon secondary peak
            return 78
        elif 18 <= hour < 22: # Evening relaxation
            return 60
        else:                 # Late night fatigue
            return 50

    def _generate_ai_advice(self, score, hour):
        if score >= 80:
            return f"Optimal deep work state. Your historical focus shows high concentration at this time ({hour}:00)."
        elif score >= 65:
            return f"Moderate focus expected. Good time for regular tasks, but shield yourself from distractions."
        else:
            return f"Fatigue/distraction warning. Historically, your focus drops around this time. We recommend a 25-minute Pomodoro break."


# Global Instances
activity_classifier = ActivityClassifier()
focus_predictor = FocusPredictor()
