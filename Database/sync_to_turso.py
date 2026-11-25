"""
Turso 雲端資料庫同步工具
作者：Office of William
功能：將本地 iknow99_car.db 完整 Schema 與所有歷史資料同步至 Turso 雲端資料庫
"""

import os
import sys
import json
import sqlite3
import requests
from typing import List, Dict, Any

SQLITE_DB_PATH = r"D:\iKnows99.Car\Database\iknow99_car.db"

def parse_turso_url(raw_url: str) -> str:
    """將 libsql:// 或 https:// 統一轉為 https://<host>/v2/pipeline"""
    url = raw_url.strip()
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    elif not url.startswith("https://") and not url.startswith("http://"):
        url = "https://" + url
    
    url = url.rstrip("/")
    if not url.endswith("/v2/pipeline"):
        url += "/v2/pipeline"
    return url

def execute_turso_pipeline(pipeline_url: str, token: str, statements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """呼叫 Turso Hrana v2 Pipeline API 執行批次 SQL"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    requests_payload = []
    for stmt in statements:
        requests_payload.append({
            "type": "execute",
            "stmt": stmt
        })
    
    payload = {"requests": requests_payload}
    
    resp = requests.post(pipeline_url, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise Exception(f"Turso API 錯誤 [{resp.status_code}]: {resp.text}")
    
    data = resp.json()
    # 檢查是否有 error
    for result in data.get("results", []):
        if result.get("type") == "error":
            raise Exception(f"SQL 執行失敗: {result.get('error', {}).get('message')}")
    return data

def to_turso_value(val):
    """將 Python 資料轉為 Hrana value 格式"""
    if val is None:
        return {"type": "null"}
    elif isinstance(val, int):
        return {"type": "integer", "value": str(val)}
    elif isinstance(val, float):
        return {"type": "float", "value": val}
    elif isinstance(val, (bytes, bytearray)):
        import base64
        return {"type": "blob", "base64": base64.b64encode(val).decode("utf-8")}
    else:
        return {"type": "text", "value": str(val)}

def sync_database(turso_url: str, token: str):
    pipeline_url = parse_turso_url(turso_url)
    print(f"[*] 連線目標：{pipeline_url}")
    print(f"[*] 本地資料庫：{SQLITE_DB_PATH}")

    if not os.path.exists(SQLITE_DB_PATH):
        raise FileNotFoundError(f"找不到本地資料庫檔案: {SQLITE_DB_PATH}")

    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. 取得所有 table schema DDL (排除 sqlite_ 系列)
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = cursor.fetchall()

    print(f"\n[1/3] 初始化資料表 Schema（共 {len(tables)} 個既有資料表）...")
    init_stmts = []
    table_names = []
    for tbl in tables:
        t_name = tbl['name']
        t_sql = tbl['sql']
        table_names.append(t_name)
        # 替換 CREATE TABLE 為 CREATE TABLE IF NOT EXISTS
        create_sql = t_sql.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1)
        init_stmts.append({"sql": create_sql})

    # 新增 CarVitals 擴充表
    extension_sqls = [
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'viewer',
          theme_pref TEXT DEFAULT 'dark',
          locale_pref TEXT DEFAULT 'zh-TW',
          is_active INTEGER DEFAULT 1,
          last_login_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS component_alerts (
          alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id TEXT NOT NULL REFERENCES vehicles(vehicle_id),
          component_name TEXT NOT NULL,
          last_replaced_date DATE,
          last_replaced_mileage INTEGER,
          lifespan_days INTEGER,
          lifespan_km INTEGER,
          alert_days_before INTEGER DEFAULT 30,
          alert_km_before INTEGER DEFAULT 500,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS system_logs (
          log_id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL,
          target TEXT,
          detail TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """
    ]
    for ext_sql in extension_sqls:
        init_stmts.append({"sql": ext_sql.strip()})

    execute_turso_pipeline(pipeline_url, token, init_stmts)
    print("  [✓] 資料表結構初始化完成！")

    # 2. 遷移資料
    print("\n[2/3] 同步資料內容至 Turso 雲端...")
    sync_tables = [
        "vehicles",
        "maintenance_records",
        "maintenance_items",
        "refueling_records",
        "other_expense_records"
    ]

    total_inserted = 0
    for t_name in sync_tables:
        cursor.execute(f"SELECT * FROM {t_name}")
        rows = cursor.fetchall()
        if not rows:
            print(f"  [-] {t_name}: 0 筆資料，略過")
            continue

        col_names = [col[0] for col in cursor.description]
        placeholders = ", ".join(["?" for _ in col_names])
        cols_str = ", ".join(col_names)
        insert_sql = f"INSERT OR REPLACE INTO {t_name} ({cols_str}) VALUES ({placeholders})"

        print(f"  [*] 正在同步 {t_name}（共 {len(rows)} 筆）...")

        # 批次傳送，每批 50 筆避免 payload 過大
        batch_size = 50
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            batch_stmts = []
            for r in batch:
                args = [to_turso_value(r[c]) for c in col_names]
                batch_stmts.append({
                    "sql": insert_sql,
                    "args": args
                })
            execute_turso_pipeline(pipeline_url, token, batch_stmts)
            total_inserted += len(batch)
            print(f"      已同步 {min(i + batch_size, len(rows))}/{len(rows)} 筆...")

        print(f"  [✓] {t_name} 同步成功！")

    # 3. 驗證資料筆數
    print("\n[3/3] 驗證 Turso 雲端資料完整性...")
    verify_stmts = [{"sql": f"SELECT COUNT(*) as count FROM {t};"} for t in sync_tables]
    verify_res = execute_turso_pipeline(pipeline_url, token, verify_stmts)

    print("\n================== 資料驗證報告 ==================")
    for idx, t_name in enumerate(sync_tables):
        res = verify_res["results"][idx]["response"]["result"]
        remote_cnt = int(res["rows"][0][0]["value"])
        cursor.execute(f"SELECT COUNT(*) FROM {t_name}")
        local_cnt = cursor.fetchone()[0]
        status = "一致 ✅" if remote_cnt == local_cnt else "不一致 ❌"
        print(f"  {t_name:<24} | 本地: {local_cnt:>4} 筆 | 雲端: {remote_cnt:>4} 筆 | {status}")
    print("==================================================")
    print(f"\n🎉 同步作業圓滿完成！共成功遷移 {total_inserted} 筆紀錄至 Turso 雲端！")

    conn.close()

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        url = sys.argv[1]
        token = sys.argv[2]
    else:
        url = os.getenv("TURSO_DATABASE_URL", "")
        token = os.getenv("TURSO_AUTH_TOKEN", "")

    if not url or not token:
        print("使用方式：")
        print("  python sync_to_turso.py <TURSO_DATABASE_URL> <TURSO_AUTH_TOKEN>")
        print("或於環境變數中設定 TURSO_DATABASE_URL 與 TURSO_AUTH_TOKEN 後直接執行。")
        sys.exit(1)

    sync_database(url, token)

