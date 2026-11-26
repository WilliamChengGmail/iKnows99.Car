# CarVitals 使用者環境參數與模組擴充架構報告

**文件識別碼**：`user_preferences_architecture_20261126_112500`  
**建立時間**：2026-11-26 11:25:00 (台灣時間 UTC+8)  
**作者**：Office of William  
**專案路徑**：`D:\iKnows99.Car\CarVitals`  

---

## 1. 任務背景與架構目標

依據使用者需求：「**每個使用者要能自行決定並調整環境參數 (ex: 色系, 語言, 後續還有其他陸續建置的功能模組)**」，本階段為系統建置現代化、跨租戶隔離且具備高度擴充彈性之**個人偏好設定體系 (User Preferences System)**。

### 核心設計原則：
1. **自主決定與完全隔離**：每位使用者（包含車主 `william` 與系統管理員 `admin`）登入後，擁有獨立的偏好配置空間，互不干擾。
2. **多維度環境參數**：包含外觀主題、風格強調色系、語言環境、度量衡單位、保養預警閥值、預設登入首頁。
3. **模組化未來擴充性 (Modular Extensibility)**：在底層採用 JSON 動態擴充架構，後續陸續建置任何新功能模組（如 OBD-II 遙測、二手殘值試算、保養廠評論、行車花費月報）時，無需調整資料表結構即可即時掛載模組專屬開關與偏好。

---

## 2. 資料庫架構擴充

在雲端資料庫 `users` 資料表擴充動態 JSON 欄位：
```sql
ALTER TABLE users ADD COLUMN preferences_json TEXT DEFAULT '{}';
```

### JSON 結構範例與擴充槽位：
```json
{
  "theme": "dark",
  "accentColor": "emerald",
  "locale": "zh-TW",
  "distanceUnit": "km",
  "volumeUnit": "L",
  "fuelEconomyUnit": "km/L",
  "currency": "TWD",
  "defaultLanding": "/dashboard",
  "alertMileageThreshold": 1500,
  "alertDaysThreshold": 30,
  "modules": {
    "notifications": {
      "maintenanceAlerts": true,
      "fuelLogsReminder": true,
      "monthlyDigest": false
    },
    "futureFeatureModule": {
      "enabled": true,
      "customParams": {}
    }
  }
}
```
> **向後相容機制**：當使用者更新 `preferences_json` 時，系統同時自動同步至實體欄位 `users.theme_pref` 與 `users.locale_pref`，維持既有查詢的高效索引。

---

## 3. 模組與檔案清單

### 前端客戶端與進入點
- [page.tsx](file:///D:/iKnows99.Car/CarVitals/app/[locale]/settings/page.tsx)：個人偏好設定 Server Component。
- [SettingsClient.tsx](file:///D:/iKnows99.Car/CarVitals/components/settings/SettingsClient.tsx)：現代化個人設定中心客戶端元件，提供六大設定分區。
- [Navbar.tsx](file:///D:/iKnows99.Car/CarVitals/components/layout/Navbar.tsx)：頂部導覽列整合齒輪圖標快捷按鈕。
- [zh-TW.json](file:///D:/iKnows99.Car/CarVitals/messages/zh-TW.json) / [en.json](file:///D:/iKnows99.Car/CarVitals/messages/en.json)：同步擴充繁體中文與英文字典。

### 後端 API 服務
- [route.ts](file:///D:/iKnows99.Car/CarVitals/app/api/user/preferences/route.ts)：
  - `GET`：取得當前登入者之完整環境偏好。
  - `PUT`：更新偏好設定，內建**深層合併 (Deep Merge)** 邏輯，確保後續擴充之模組參數在部分更新時完整保留。

### 維運與驗證腳本
- [migrate-user-preferences.mjs](file:///D:/iKnows99.Car/CarVitals/scripts/migrate-user-preferences.mjs)：資料庫欄位遷移與現有會員預設偏好初始化腳本。
- [test-preferences.mjs](file:///D:/iKnows99.Car/CarVitals/scripts/test-preferences.mjs)：全自動化偏好讀取、更新、持久化與跨租戶隔離驗證腳本。

---

## 4. 六大環境設定分區功能

1. **外觀與色彩主題 (Appearance & Theme)**：
   - 顯示模式：深色模式 (`dark`)、淺色模式 (`light`)、跟隨系統 (`system`)。
   - 風格強調色系：經典科技藍 (`blue`)、翡翠能源綠 (`emerald`)、尊爵極光紫 (`violet`)、跑車琥珀金 (`amber`)、競技烈焰紅 (`rose`)、未來蔚青藍 (`cyan`)。
2. **語言與國際化 (Language & Locale)**：
   - 繁體中文 (`zh-TW`) 與 English (`en`)，切換後自動平滑轉換多語系環境。
3. **度量衡與計量單位 (Units & Measurement)**：
   - 里程單位：公里 (km) / 英里 (mi)。
   - 燃油容量：公升 (L) / 加侖 (gal)。
   - 油耗格式：km/L / L/100km / MPG。
   - 貨幣符號：新台幣 (NT$) / 美元 ($) / 歐元 (€) / 日圓 (¥)。
4. **零件保養預警閥值 (Maintenance Alerts)**：
   - 里程提前預警量：500 km / 1,000 km / 1,500 km / 2,000 km。
   - 天數提前預警量：14 天 / 30 天 / 45 天 / 60 天。
5. **預設首頁導向 (Landing Preference)**：
   - 支援將儀表板、車輛管理、維修保養、加油紀錄或費用管理自訂為每次登入後的預設著陸頁。
6. **功能模組動態擴充 (Extensible Modular Settings)**：
   - 零件健康即時預警通知開關。
   - 定期加油與油耗異常追蹤開關。
   - 預留後續新功能模組之即時掛載介面。

---

## 5. 自動化整合測試成果

執行 `node scripts/test-preferences.mjs` 驗證記錄：
```text
🚀 開始使用者環境偏好 (User Preferences) 自動化驗證...

[1/4] 登入車主 william (帳號: william)...
  ✅ william 登入成功

[2/4] 查詢目前環境偏好 (GET /api/user/preferences)...
  ✅ 成功取得偏好設定:
     - 主題模式: dark
     - 風格強調色: blue
     - 語言環境: zh-TW
     - 度量衡單位: km / L / km/L
     - 保養預警閾值: 前 1000 km / 前 30 天
     - 模組通知開關: { maintenanceAlerts: true, fuelLogsReminder: true }

[3/4] 調整環境參數與自訂模組設定 (PUT /api/user/preferences)...
  ✅ 更新成功，伺服器回應: 使用者環境偏好已成功更新
  ✅ 驗證資料庫持久化:
     - 強調色是否變更為 emerald: true
     - 里程閾值是否變更為 1500: true
     - 自訂擴充模組 (obdTelemetry) 是否成功保存: true

[4/4] 驗證跨使用者偏好隔離 (登入 admin)...
  ✅ admin 偏好設定:
     - admin 強調色: blue (應維持 blue 預設)
     - admin 是否包含 william 的 obdTelemetry: false
  ✅ 跨使用者偏好嚴格隔離驗證通過！

🎉 使用者自訂環境參數與模組擴充機制 100% 驗證通過！
```

---

## 6. 現況與待命狀態

- 專案已通過完整生產環境編譯（`npm run build`），包含 21 個 Next.js App Router 靜態/動態頁面與 15 支 API 服務。
- 本地開發伺服器於 `http://localhost:3000` 穩定提供服務中。
- 本次所有變更已在工作目錄中就緒，待命等待使用者下達 `git commit and push`。

