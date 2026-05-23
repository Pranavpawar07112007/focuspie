@echo off
title FocusPie Backend Builder
echo ===================================================
echo   Building FocusPie Backend with PyInstaller...
echo ===================================================

:: Activate venv
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found in venv\
    pause
    exit /b 1
)
call venv\Scripts\activate.bat

:: Install PyInstaller if not present
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)

:: Run PyInstaller with spec file
echo [BUILD] Running PyInstaller...
pyinstaller focuspie.spec --noconfirm --clean

if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo ===================================================
echo   Build complete! Output: dist\focuspie_server\
echo ===================================================
pause
