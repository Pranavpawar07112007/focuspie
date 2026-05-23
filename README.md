# FocusPie

FocusPie is a comprehensive productivity application designed to help you stay focused, track your activities, manage your tasks, and utilize machine learning to predict your productivity trends. It comes with a robust backend powered by FastAPI, a modern frontend built with React and Vite, and an optional Electron wrapper for desktop distribution.

## ✨ Features

- **Activity Tracking**: Automatically tracks the windows you have open and how long you spend on them.
- **Distraction Management**: Identify and limit time spent on distracting websites or applications.
- **Smart Todo List**: Manage tasks with priority levels, deadlines, and smart sorting.
- **AI-Powered Insights**: Utilizes a machine learning service to categorize your activities and forecast your optimal focus curve throughout the day.
- **Pomodoro Timer**: Customizable focus sessions, short breaks, and long breaks.
- **Cross-Platform**: Run it as a lightweight local web app or package it as a standalone Desktop application via Electron.

---

## 🏗 Architecture

The application is built using a modern decoupled architecture:

- **Frontend (`/frontend`)**: A Single Page Application (SPA) built with React, Vite, and TailwindCSS. It communicates with the backend via RESTful APIs.
- **Backend (`/backend`)**: A high-performance Python backend powered by FastAPI. It handles API requests, database operations (SQLite via SQLAlchemy), user authentication, and runs background threads for OS-level window activity tracking.
- **Machine Learning (`/backend/ml_service.py`)**: An embedded ML component that classifies activities and predicts productivity scores based on historical data.
- **Desktop Wrapper (`/electron`)**: An Electron-based wrapper that packages the pre-built React frontend and a compiled executable of the Python backend into a single installable desktop app.

---

## 🚀 Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js (v16+)

### 1. Backend Setup
1. Navigate to the `backend` directory:
   ```cmd
   cd backend
   ```
2. Create and activate a virtual environment:
   ```cmd
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install dependencies:
   ```cmd
   pip install -r requirements.txt
   ```
   *(Note: Ensure you install necessary packages like `fastapi`, `uvicorn`, `sqlalchemy`, etc., if `requirements.txt` is missing).*

### 2. Frontend Setup
1. Navigate to the `frontend` directory:
   ```cmd
   cd frontend
   ```
2. Install Node dependencies and build the static files:
   ```cmd
   npm install
   npm run build
   ```

---

## 🏃‍♂️ Running the Application

### The Easy Way (Web View Without NPM)
You can launch both the backend and the frontend using the provided batch file. This serves the pre-built frontend directly using Python, meaning you don't need `npm` running!

Simply double-click `start.bat` in the project root, or run it from the command line:
```cmd
start.bat
```
This will start the backend on port `8000` and the frontend on port `5173`, and automatically open your web browser.

### The Developer Way
If you are actively developing the frontend and need hot-reloading:
1. **Start the backend** (in one terminal):
   ```cmd
   cd backend
   venv\Scripts\activate
   python -m uvicorn main:app --reload --port 8000
   ```
2. **Start the frontend** (in another terminal):
   ```cmd
   cd frontend
   npm run dev
   ```

---

## 🖥 Desktop App Installation (Electron)

If you want to run FocusPie as a standalone desktop application, you can compile and package it using Electron.

1. **Build the Backend Executable:**
   First, we need to package the Python backend into a standalone executable using PyInstaller.
   ```cmd
   cd backend
   build_backend.bat
   ```
   *(This script activates your venv, installs PyInstaller if needed, and builds the executable into `backend/dist/focuspie_server/`).*

2. **Build the Frontend:**
   Ensure your React frontend is fully built.
   ```cmd
   cd frontend
   npm run build
   ```

3. **Package with Electron:**
   Navigate to the `electron` directory, install dependencies, and run the build script.
   ```cmd
   cd electron
   npm install
   npm run build
   ```
   
Once the build is complete, the installer (e.g., `FocusPie Setup.exe`) will be located in the `electron/dist/` directory. Run the installer to install FocusPie on your system.
