@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

title iKnow99 - PersonalDataCatch (Office of William)

echo [1/3] Checking Python environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python and add to PATH.
    pause
    exit /b 1
)

echo [2/3] Checking dependencies (playwright, rich)...
python -m pip install -r requirements.txt --quiet
python -m playwright install chromium

echo.
echo [3/3] Starting iKnow99 Data Harvester...
echo.

python main.py

echo.
echo ======================================================================
echo Process finished. Press any key to exit...
pause >nul
