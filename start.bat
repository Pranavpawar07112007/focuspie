@echo off
title FocusPie Launcher
echo ===================================================
echo           Starting FocusPie Suite...
echo ===================================================

:: Ensure backend virtual environment python exists
if not exist "backend\venv\Scripts\python.exe" (
    echo [ERROR] Backend virtual environment not found in backend\venv.
    echo Please ensure the backend virtual environment is created before launching.
    pause
    exit /b 1
)

:: Ensure frontend dependencies are installed
if not exist "frontend\node_modules\" (
    echo [INFO] Frontend node_modules not found. Installing dependencies...
    cd frontend
    call npm install
    cd ..
)

echo [1/3] Spinning up FastAPI backend server on port 8000...
start "FocusPie Backend" /b cmd /c "cd backend && venv\Scripts\python.exe -m uvicorn main:app --port 8000"

echo [2/3] Spinning up Vite React frontend server on port 5173...
start "FocusPie Frontend" /b cmd /c "cd frontend && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo Opening browser at http://localhost:5173...
start http://localhost:5173

echo ===================================================
echo  FocusPie is now running! 
echo  Keep this terminal open to keep the servers active.
echo  Press Ctrl+C or close this window to stop both servers.
echo ===================================================

:: Loop to wait and keep batch active
:loop
pause >nul
goto loop
