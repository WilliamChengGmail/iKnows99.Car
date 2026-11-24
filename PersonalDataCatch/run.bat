@echo off
setlocal
cd /d "%~dp0"

title iKnow99 - PersonalDataCatch (Office of William)

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python is not found. Please install Python and add it to PATH.
    echo.
    pause
    exit /b 1
)

python main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] An error occurred during execution.
    pause
)
