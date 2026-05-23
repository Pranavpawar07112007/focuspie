# FocusPie

FocusPie is a productivity application designed to help you stay focused, track your activities, and manage your tasks. It comes with a robust backend powered by FastAPI and a modern frontend built with React and Vite.

## Project Structure
- `backend/`: FastAPI application, database models, and background activity tracker.
- `frontend/`: React application built with Vite and TailwindCSS.
- `electron/`: (Optional) Electron wrapper for desktop application distribution.

## Installation

### Prerequisites
- Python 3.8+
- Node.js (v16+) (Only required if you plan to modify or rebuild the frontend)

### Backend Setup
1. Navigate to the `backend` directory:
   ```cmd
   cd backend
   ```
2. Create a virtual environment:
   ```cmd
   python -m venv venv
   ```
3. Activate the virtual environment:
   ```cmd
   venv\Scripts\activate
   ```
4. Install dependencies:
   ```cmd
   pip install -r requirements.txt
   ```
*(Note: If `requirements.txt` does not exist, install FastAPI, Uvicorn, SQLAlchemy, etc. manually based on `main.py` imports).*

### Frontend Setup
If you want to modify or rebuild the frontend:
1. Navigate to the `frontend` directory:
   ```cmd
   cd frontend
   ```
2. Install Node dependencies:
   ```cmd
   npm install
   ```
3. Build the static files (required at least once before running without npm):
   ```cmd
   npm run build
   ```

## Running the Application

### The Easy Way (Without NPM)
You can launch both the backend and the frontend using the provided batch file. This serves the pre-built frontend directly using Python, meaning you don't need `npm` running!

Simply double-click `start.bat` in the project root, or run it from the command line:
```cmd
start.bat
```
This will start the backend on port `8000` and the frontend on port `5173`, and automatically open your web browser.

### The Developer Way
If you are actively developing the frontend and need hot-reloading:
1. Start the backend:
   ```cmd
   cd backend
   venv\Scripts\activate
   python -m uvicorn main:app --reload --port 8000
   ```
2. Start the frontend development server:
   ```cmd
   cd frontend
   npm run dev
   ```
