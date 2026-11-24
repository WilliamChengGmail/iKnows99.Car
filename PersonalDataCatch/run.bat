@echo off
chcp 65001 >nul
title iKnow99 車輛歷程資料擷取系統 (PersonalDataCatch)
echo ======================================================================
echo    iKnow99 車輛歷程資料擷取系統 - Office of William
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] 檢查 Python 環境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Python，請先安裝 Python 並加入 PATH 環境變數。
    pause
    exit /b 1
)

echo [2/3] 檢查與安裝依賴套件 (playwright, rich)...
pip install -r requirements.txt --quiet
python -m playwright install chromium

echo.
echo [3/3] 正在啟動資料擷取主程式...
echo 提示：請在即將彈出的瀏覽器視窗中手動完成 Google 登入。
echo.

python main.py

echo.
echo ======================================================================
echo 程式執行完畢。按下任意鍵關閉此視窗...
pause >nul

