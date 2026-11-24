import sqlite3
import hashlib
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from config import DATABASE_PATH

def get_connection() -> sqlite3.Connection:
    """取得 SQLite 資料庫連線"""
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """初始化 SQLite 資料表與 View 結構"""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. 車輛基本資料與車籍規格表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        vehicle_id TEXT PRIMARY KEY,
        plate_number TEXT,
        nickname TEXT,
        brand TEXT,
        model TEXT,
        trim TEXT,
        car_type TEXT,
        horsepower TEXT,
        displacement TEXT,
        fuel_type TEXT,
        current_mileage INTEGER,
        mileage_unit TEXT DEFAULT '公里',
        license_date DATE,
        vehicle_usage TEXT DEFAULT '自用車',
        insurance_expiry_date DATE,
        reminder_setting TEXT,
        tank_capacity REAL,
        fuel_efficiency_unit TEXT,
        reserve_fuel_volume REAL,
        fuel_warning_percentage INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. 保養維修主檔
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS maintenance_records (
        record_id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        record_date DATE,
        record_time TEXT,
        mileage INTEGER,
        title TEXT,
        total_amount REAL,
        payment_method TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
        UNIQUE(vehicle_id, record_date, record_time, title)
    );
    """)

    # 保養維修工單細項表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS maintenance_items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT,
        item_name TEXT,
        spec_detail TEXT,
        lifespan_date TEXT,
        lifespan_mileage INTEGER,
        unit_price REAL,
        quantity REAL,
        subtotal REAL,
        remarks TEXT,
        FOREIGN KEY (record_id) REFERENCES maintenance_records(record_id)
    );
    """)

    # 保養維修附件
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS maintenance_attachments (
        attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT,
        file_url TEXT,
        local_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES maintenance_records(record_id)
    );
    """)

    # 3. 加油紀錄表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS refueling_records (
        record_id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        refuel_date DATE,
        refuel_time TEXT,
        mileage INTEGER,
        total_amount REAL,
        payment_method TEXT,
        liters REAL,
        unit_price REAL,
        fuel_type TEXT,
        is_previous_missed INTEGER DEFAULT 0,
        fuel_gauge_position REAL,
        prev_mileage INTEGER,
        trip_distance REAL,
        tank_fuel_level REAL,
        fuel_efficiency REAL,
        cost_per_km REAL,
        prev_fuel_used REAL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
        UNIQUE(vehicle_id, refuel_date, refuel_time)
    );
    """)

    # 加油附件
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS refueling_attachments (
        attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT,
        file_url TEXT,
        local_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES refueling_records(record_id)
    );
    """)

    # 4. 一般費用紀錄表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS other_expense_records (
        record_id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        expense_date DATE,
        expense_time TEXT,
        mileage INTEGER,
        title TEXT,
        expense_category TEXT,
        total_amount REAL,
        payment_method TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
        UNIQUE(vehicle_id, expense_date, expense_time, title)
    );
    """)

    # 費用附件
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS expense_attachments (
        attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT,
        file_url TEXT,
        local_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES other_expense_records(record_id)
    );
    """)

    # 5. 綜合費用視圖 (View)
    cursor.execute("""
    CREATE VIEW IF NOT EXISTS v_all_expenses AS
    SELECT 
        vehicle_id, 
        '保養維修' AS main_category, 
        title AS description, 
        record_date AS trans_date, 
        record_time AS trans_time, 
        mileage, 
        total_amount AS amount, 
        payment_method, 
        notes 
    FROM maintenance_records
    UNION ALL
    SELECT 
        vehicle_id, 
        '加油' AS main_category, 
        fuel_type || ' (' || liters || '公升)' AS description, 
        refuel_date AS trans_date, 
        refuel_time AS trans_time, 
        mileage, 
        total_amount AS amount, 
        payment_method, 
        notes 
    FROM refueling_records
    UNION ALL
    SELECT 
        vehicle_id, 
        expense_category AS main_category, 
        title AS description, 
        expense_date AS trans_date, 
        expense_time AS trans_time, 
        mileage, 
        total_amount AS amount, 
        payment_method, 
        notes 
    FROM other_expense_records;
    """)

    # 6. 原始封包紀錄表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS raw_data_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        source_id TEXT,
        raw_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()

def generate_fingerprint(*args) -> str:
    """生成唯一指紋雜湊碼 (MD5)"""
    content = "_".join(str(a or "").strip() for a in args)
    return hashlib.md5(content.encode("utf-8")).hexdigest()

def upsert_vehicle(data: Dict[str, Any]) -> str:
    """寫入或更新車輛資料"""
    conn = get_connection()
    cursor = conn.cursor()
    
    vehicle_id = data.get("vehicle_id") or data.get("plate_number")
    
    cursor.execute("""
    INSERT INTO vehicles (
        vehicle_id, plate_number, nickname, brand, model, trim,
        car_type, horsepower, displacement, fuel_type, current_mileage,
        mileage_unit, license_date, vehicle_usage, insurance_expiry_date,
        reminder_setting, tank_capacity, fuel_efficiency_unit,
        reserve_fuel_volume, fuel_warning_percentage, updated_at
    ) VALUES (
        :vehicle_id, :plate_number, :nickname, :brand, :model, :trim,
        :car_type, :horsepower, :displacement, :fuel_type, :current_mileage,
        :mileage_unit, :license_date, :vehicle_usage, :insurance_expiry_date,
        :reminder_setting, :tank_capacity, :fuel_efficiency_unit,
        :reserve_fuel_volume, :fuel_warning_percentage, CURRENT_TIMESTAMP
    )
    ON CONFLICT(vehicle_id) DO UPDATE SET
        plate_number = excluded.plate_number,
        nickname = excluded.nickname,
        brand = excluded.brand,
        model = excluded.model,
        trim = excluded.trim,
        car_type = excluded.car_type,
        horsepower = excluded.horsepower,
        displacement = excluded.displacement,
        fuel_type = excluded.fuel_type,
        current_mileage = excluded.current_mileage,
        license_date = excluded.license_date,
        tank_capacity = excluded.tank_capacity,
        reserve_fuel_volume = excluded.reserve_fuel_volume,
        fuel_warning_percentage = excluded.fuel_warning_percentage,
        updated_at = CURRENT_TIMESTAMP;
    """, {
        "vehicle_id": vehicle_id,
        "plate_number": data.get("plate_number", ""),
        "nickname": data.get("nickname", ""),
        "brand": data.get("brand", ""),
        "model": data.get("model", ""),
        "trim": data.get("trim", ""),
        "car_type": data.get("car_type", ""),
        "horsepower": data.get("horsepower", ""),
        "displacement": data.get("displacement", ""),
        "fuel_type": data.get("fuel_type", ""),
        "current_mileage": data.get("current_mileage", 0),
        "mileage_unit": data.get("mileage_unit", "公里"),
        "license_date": data.get("license_date"),
        "vehicle_usage": data.get("vehicle_usage", "自用車"),
        "insurance_expiry_date": data.get("insurance_expiry_date"),
        "reminder_setting": data.get("reminder_setting", ""),
        "tank_capacity": data.get("tank_capacity", 0.0),
        "fuel_efficiency_unit": data.get("fuel_efficiency_unit", "公里/公升"),
        "reserve_fuel_volume": data.get("reserve_fuel_volume", 0.0),
        "fuel_warning_percentage": data.get("fuel_warning_percentage", 10)
    })
    
    conn.commit()
    conn.close()
    return vehicle_id

def upsert_maintenance_record(rec: Dict[str, Any], items: List[Dict[str, Any]] = None, attachments: List[str] = None) -> Dict[str, Any]:
    """寫入或更新保養維修紀錄與其工單零件細項"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 決定 record_id (若後台無 ID 則使用指紋)
    record_id = rec.get("record_id")
    if not record_id:
        record_id = generate_fingerprint(rec.get("vehicle_id"), "MAINT", rec.get("record_date"), rec.get("record_time"), rec.get("title"))
    
    # 檢查是否已存在
    cursor.execute("SELECT record_id FROM maintenance_records WHERE record_id = ?", (record_id,))
    existing = cursor.fetchone()
    status = "UPDATED" if existing else "INSERTED"

    cursor.execute("""
    INSERT INTO maintenance_records (
        record_id, vehicle_id, record_date, record_time, mileage,
        title, total_amount, payment_method, notes
    ) VALUES (
        :record_id, :vehicle_id, :record_date, :record_time, :mileage,
        :title, :total_amount, :payment_method, :notes
    )
    ON CONFLICT(record_id) DO UPDATE SET
        mileage = excluded.mileage,
        total_amount = excluded.total_amount,
        payment_method = excluded.payment_method,
        notes = excluded.notes;
    """, {
        "record_id": record_id,
        "vehicle_id": rec.get("vehicle_id"),
        "record_date": rec.get("record_date"),
        "record_time": rec.get("record_time", "00:00"),
        "mileage": rec.get("mileage", 0),
        "title": rec.get("title", ""),
        "total_amount": rec.get("total_amount", 0.0),
        "payment_method": rec.get("payment_method", "現金"),
        "notes": rec.get("notes", "")
    })

    # 若更新，先清除舊細項再寫入
    if items:
        cursor.execute("DELETE FROM maintenance_items WHERE record_id = ?", (record_id,))
        for it in items:
            cursor.execute("""
            INSERT INTO maintenance_items (
                record_id, item_name, spec_detail, lifespan_date,
                lifespan_mileage, unit_price, quantity, subtotal, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record_id,
                it.get("item_name", ""),
                it.get("spec_detail", ""),
                it.get("lifespan_date", ""),
                it.get("lifespan_mileage", 0),
                it.get("unit_price", 0.0),
                it.get("quantity", 1.0),
                it.get("subtotal", 0.0),
                it.get("remarks", "")
            ))

    if attachments:
        cursor.execute("DELETE FROM maintenance_attachments WHERE record_id = ?", (record_id,))
        for att in attachments:
            cursor.execute("INSERT INTO maintenance_attachments (record_id, file_url) VALUES (?, ?)", (record_id, att))

    conn.commit()
    conn.close()
    return {"record_id": record_id, "status": status, "items_count": len(items or [])}

def upsert_refueling_record(rec: Dict[str, Any], attachments: List[str] = None) -> Dict[str, Any]:
    """寫入或更新加油紀錄"""
    conn = get_connection()
    cursor = conn.cursor()
    
    record_id = rec.get("record_id")
    if not record_id:
        record_id = generate_fingerprint(rec.get("vehicle_id"), "REFUEL", rec.get("refuel_date"), rec.get("refuel_time"), rec.get("mileage"))
        
    cursor.execute("SELECT record_id FROM refueling_records WHERE record_id = ?", (record_id,))
    existing = cursor.fetchone()
    status = "UPDATED" if existing else "INSERTED"

    cursor.execute("""
    INSERT INTO refueling_records (
        record_id, vehicle_id, refuel_date, refuel_time, mileage,
        total_amount, payment_method, liters, unit_price, fuel_type,
        is_previous_missed, fuel_gauge_position, prev_mileage,
        trip_distance, tank_fuel_level, fuel_efficiency, cost_per_km,
        prev_fuel_used, notes
    ) VALUES (
        :record_id, :vehicle_id, :refuel_date, :refuel_time, :mileage,
        :total_amount, :payment_method, :liters, :unit_price, :fuel_type,
        :is_previous_missed, :fuel_gauge_position, :prev_mileage,
        :trip_distance, :tank_fuel_level, :fuel_efficiency, :cost_per_km,
        :prev_fuel_used, :notes
    )
    ON CONFLICT(record_id) DO UPDATE SET
        total_amount = excluded.total_amount,
        payment_method = excluded.payment_method,
        liters = excluded.liters,
        unit_price = excluded.unit_price,
        fuel_efficiency = excluded.fuel_efficiency,
        notes = excluded.notes;
    """, {
        "record_id": record_id,
        "vehicle_id": rec.get("vehicle_id"),
        "refuel_date": rec.get("refuel_date"),
        "refuel_time": rec.get("refuel_time", "00:00"),
        "mileage": rec.get("mileage", 0),
        "total_amount": rec.get("total_amount", 0.0),
        "payment_method": rec.get("payment_method", "現金"),
        "liters": rec.get("liters", 0.0),
        "unit_price": rec.get("unit_price", 0.0),
        "fuel_type": rec.get("fuel_type", "95無鉛"),
        "is_previous_missed": 1 if rec.get("is_previous_missed") else 0,
        "fuel_gauge_position": rec.get("fuel_gauge_position", 1.0),
        "prev_mileage": rec.get("prev_mileage", 0),
        "trip_distance": rec.get("trip_distance", 0.0),
        "tank_fuel_level": rec.get("tank_fuel_level", 0.0),
        "fuel_efficiency": rec.get("fuel_efficiency", 0.0),
        "cost_per_km": rec.get("cost_per_km", 0.0),
        "prev_fuel_used": rec.get("prev_fuel_used", 0.0),
        "notes": rec.get("notes", "")
    })

    if attachments:
        cursor.execute("DELETE FROM refueling_attachments WHERE record_id = ?", (record_id,))
        for att in attachments:
            cursor.execute("INSERT INTO refueling_attachments (record_id, file_url) VALUES (?, ?)", (record_id, att))

    conn.commit()
    conn.close()
    return {"record_id": record_id, "status": status}

def upsert_expense_record(rec: Dict[str, Any], attachments: List[str] = None) -> Dict[str, Any]:
    """寫入或更新其他費用紀錄"""
    conn = get_connection()
    cursor = conn.cursor()
    
    record_id = rec.get("record_id")
    if not record_id:
        record_id = generate_fingerprint(rec.get("vehicle_id"), "EXPENSE", rec.get("expense_date"), rec.get("expense_time"), rec.get("title"))
        
    cursor.execute("SELECT record_id FROM other_expense_records WHERE record_id = ?", (record_id,))
    existing = cursor.fetchone()
    status = "UPDATED" if existing else "INSERTED"

    cursor.execute("""
    INSERT INTO other_expense_records (
        record_id, vehicle_id, expense_date, expense_time, mileage,
        title, expense_category, total_amount, payment_method, notes
    ) VALUES (
        :record_id, :vehicle_id, :expense_date, :expense_time, :mileage,
        :title, :expense_category, :total_amount, :payment_method, :notes
    )
    ON CONFLICT(record_id) DO UPDATE SET
        mileage = excluded.mileage,
        expense_category = excluded.expense_category,
        total_amount = excluded.total_amount,
        payment_method = excluded.payment_method,
        notes = excluded.notes;
    """, {
        "record_id": record_id,
        "vehicle_id": rec.get("vehicle_id"),
        "expense_date": rec.get("expense_date"),
        "expense_time": rec.get("expense_time", "00:00"),
        "mileage": rec.get("mileage", 0),
        "title": rec.get("title", ""),
        "expense_category": rec.get("expense_category", "其他"),
        "total_amount": rec.get("total_amount", 0.0),
        "payment_method": rec.get("payment_method", "現金"),
        "notes": rec.get("notes", "")
    })

    if attachments:
        cursor.execute("DELETE FROM expense_attachments WHERE record_id = ?", (record_id,))
        for att in attachments:
            cursor.execute("INSERT INTO expense_attachments (record_id, file_url) VALUES (?, ?)", (record_id, att))

    conn.commit()
    conn.close()
    return {"record_id": record_id, "status": status}

def get_vehicle_counts(vehicle_id: str) -> Dict[str, int]:
    """取得特定車輛在資料庫中的各類別總數"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM maintenance_records WHERE vehicle_id = ?", (vehicle_id,))
    maint_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM refueling_records WHERE vehicle_id = ?", (vehicle_id,))
    refuel_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM other_expense_records WHERE vehicle_id = ?", (vehicle_id,))
    expense_count = cursor.fetchone()[0]
    
    conn.close()
    return {
        "maintenance": maint_count,
        "refueling": refuel_count,
        "expense": expense_count,
        "total": maint_count + refuel_count + expense_count
    }

def get_overall_summary() -> Dict[str, Any]:
    """取得資料庫全域統計摘要"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM vehicles")
    v_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM maintenance_records")
    m_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM maintenance_items")
    item_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM refueling_records")
    r_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM other_expense_records")
    e_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM v_all_expenses")
    total_cost = cursor.fetchone()[0]
    
    # 取得各車列表
    cursor.execute("SELECT vehicle_id, plate_number, nickname, brand, model FROM vehicles")
    vehicles = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return {
        "vehicle_count": v_count,
        "maintenance_count": m_count,
        "maintenance_items_count": item_count,
        "refueling_count": r_count,
        "expense_count": e_count,
        "total_records": m_count + r_count + e_count,
        "total_cost": total_cost,
        "vehicles": vehicles
    }

