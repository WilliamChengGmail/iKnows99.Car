# iKnows99.Car - 個人車輛歷程資料擷取系統

本專案旨在自 [iknow99.com](https://iknow99.com/car.manager) 擷取並結構化儲存個人所有車輛之歷史保養維修、加油歷程與相關規費資料，並完整持久化於本地端 SQLite 資料庫中。

* **規劃與維護單位**：Office of William
* **專案版本**：v1.0.0
* **目標網站**：`https://iknow99.com/car.manager`
* **資料庫路徑**：`Database/iknow99_car.db`

---

## 核心功能特色

1. **半自動輔助 Google 登入**：自動啟動可見視窗 Chrome 瀏覽器，引導使用者完成 Google 登入與 2FA 驗證，成功後程式全自動接管擷取作業。
2. **多車輛自動巡迴管理**：自動偵測並走訪帳號下所有車輛（如小青、迷你綠、白玉苦瓜等），收錄車籍規格與各車專屬歷程。
3. **三大業務核心分類收錄**：
   - 🔧 **保養/維修**：收錄日期、時間、里程、總額、支付方式、標題、備註，以及完整工單零件細項（零件名稱、規格、期限、里程、單價、數量、小計、備註）。
   - ⛽ **加油紀錄**：收錄油量(L)、單價、燃料種類、油表指針位置，並備份系統 6 大即時油耗指標。
   - 💰 **一般費用**：自訂標題與 8 大費用子分類（其他/洗車/停車/稅費/規費/保險/交通/旅程）。
4. **即時動態彩色看板**：透過 Python `rich` 提供終端動態進度條、即時處理日誌與分頁進度。
5. **雙層去重與增量同步**：依據原生 ID 與業務指紋進行 Upsert，支援未來重複執行快速增量備份。
6. **雙重成果驗收與稽核**：
   - 終端即時印出對照各車徽章之驗收統計表。
   - 自動於 `PersonalDataCatch/Logs/` 儲存帶時間戳記的詳細 Markdown 稽核日誌。

---

## 目錄結構

```text
iKnows99.Car/
├── .gemini/
│   └── rules/
│       └── documentation_rules.md      # 文檔輸出與命名規範
├── Database/
│   ├── .gitkeep
│   └── iknow99_car.db                 # SQLite 本地資料庫
├── DocumentsAndInformations/          # 專案規範與規格手冊
│   ├── Implementation_plan_*.md       # 實作計劃書
│   └── Walkthrough_*.md               # 操作手冊
├── PersonalDataCatch/                 # 核心爬蟲與處理程式
│   ├── Logs/                          # 執行稽核日誌目錄
│   ├── requirements.txt               # 模組相依性
│   ├── config.py                      # 系統組態
│   ├── db_manager.py                  # SQLite 資料庫操作與 Upsert 邏輯
│   ├── collector.py                   # 瀏覽器自動化與資料擷取核心
│   ├── reporter.py                    # 終端進度看板與報告生成
│   ├── main.py                        # 主程式入口
│   └── run.bat                        # Windows 一鍵啟動檔
└── README.md
```

---

## 快速開始

### 方式 A：滑鼠一鍵執行 (Windows)
進入 `PersonalDataCatch/` 資料夾，直接點擊執行 **`run.bat`**。

### 方式 B：命令列執行
```bash
cd PersonalDataCatch
pip install -r requirements.txt
python -m playwright install chromium
python main.py
```
啟動後請在彈出的瀏覽器中點擊 Google 登入，登入完成後程式即會自動完成所有資料之擷取與入庫。
