import os
from pathlib import Path

# 專案路徑設定
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_DIR = BASE_DIR / "Database"
DATABASE_PATH = DATABASE_DIR / "iknow99_car.db"

MODULE_DIR = BASE_DIR / "PersonalDataCatch"
LOGS_DIR = MODULE_DIR / "Logs"

# 目標網址
SIGN_IN_URL = "https://iknow99.com/user.sign_in"
TARGET_URL = "https://iknow99.com/car.manager"

# 確保必要資料夾存在
DATABASE_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
