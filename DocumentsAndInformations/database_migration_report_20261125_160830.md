# Turso 雲端資料庫初始遷移驗證報告

> **作者**：Office of William  
> **建立日期**：2026-11-25  
> **關聯腳本**：sync_to_turso.py  
> **狀態**：✅ 遷移完成且筆數 100% 一致

---

## 一、遷移摘要

- **目標資料庫**：Turso 雲端 LibSQL (`carvitals-williamchenggmail.aws-ap-northeast-1.turso.io`)
- **本地來源**：`D:\iKnows99.Car\Database\iknow99_car.db`
- **架構擴充**：已同時建立 CarVitals 所需之擴充資料表 (`users`, `component_alerts`, `system_logs`)。

---

## 二、資料一致性稽核結果

| 資料表名稱 | 本地筆數 | 雲端筆數 | 狀態 |
|------------|---------|---------|------|
| `vehicles` | 3 | 3 | 一致 ✅ |
| `maintenance_records` | 65 | 65 | 一致 ✅ |
| `maintenance_items` | 239 | 239 | 一致 ✅ |
| `refueling_records` | 477 | 477 | 一致 ✅ |
| `other_expense_records` | 173 | 173 | 一致 ✅ |

- **總遷移筆數**：**957 筆**
- **資料完整率**：**100.0%**

---

## 三、環境變數配置確認

- 本地環境變數檔已寫入：`D:\iKnows99.Car\CarVitals\.env.local`
- 範例檔已建立：`D:\iKnows99.Car\CarVitals\.env.example`

