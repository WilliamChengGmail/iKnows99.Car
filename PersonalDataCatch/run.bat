@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

title iKnow99 - PersonalDataCatch (Office of William)

if not exist "%~dp0Logs" mkdir "%~dp0Logs"

for /f "usebackq" %%a in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set TIMESTAMP=%%a
if "%TIMESTAMP%"=="" set TIMESTAMP=%random%

set LOG_FILE=%~dp0Logs\Extraction_Report_%TIMESTAMP%.md

echo # iKnow99 車輛歷程資料擷取作業日誌 (Audit Log) > "%LOG_FILE%"
echo. >> "%LOG_FILE%"
echo * **啟動時間**：%date% %time% >> "%LOG_FILE%"
echo * **執行人員/單位**：Office of William >> "%LOG_FILE%"
echo * **日誌檔案**：`%LOG_FILE%` >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"
echo ## 一、啟動引導階段 (run.bat) >> "%LOG_FILE%"
echo ```text >> "%LOG_FILE%"
echo [%time%] [run.bat] [1/3] 檢查 Python 環境... >> "%LOG_FILE%"

echo [1/3] Checking Python environment...
python --version >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python and add to PATH.
    echo [%time%] [run.bat] [ERROR] Python not found. >> "%LOG_FILE%"
    echo ``` >> "%LOG_FILE%"
    pause
    exit /b 1
)

echo [2/3] Checking dependencies (playwright, rich)...
echo [%time%] [run.bat] [2/3] 檢查並安裝依賴套件 (playwright, rich)... >> "%LOG_FILE%"
python -m pip install -r requirements.txt --quiet >> "%LOG_FILE%" 2>&1
python -m playwright install chromium >> "%LOG_FILE%" 2>&1

echo.
echo [3/3] Starting iKnow99 Data Harvester...
echo [%time%] [run.bat] [3/3] 啟動 Python 主程式... >> "%LOG_FILE%"
echo ``` >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"

python main.py --log-file "%LOG_FILE%"

echo.
echo ======================================================================
echo Process finished. Press any key to exit...
pause >nul
