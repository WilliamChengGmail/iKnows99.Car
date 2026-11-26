# CarVitals 服務 Port 3001 調整與一鍵啟動腳本建立報告

**文件識別碼**：`port_change_and_launcher_20261126_132800`  
**建立時間**：2026-11-26 13:28:00 (台灣時間 UTC+8)  
**作者**：Office of William  
**專案路徑**：`D:\iKnows99.Car`  

---

## 1. 任務背景與目標

為避免與本機其他系統（如 AegisSystem 等預設佔用 Port 3000 之專案）發生連接埠衝突，並提供使用者最便捷的本機手動啟動體驗，本次調整：
1. **服務連接埠 (Port)**：由預設的 `3000` 正式調整為 **`3001`**。
2. **一鍵啟動腳本 (One-Click Launcher)**：參考 `D:\AegisSystem\start-local-server.bat` 之架構，在專案根目錄 `D:\iKnows99.Car\` 建立量身打造的 `start-local-server.bat` 與 `start-local-server.ps1`。

---

## 2. 異動與新增檔案清單

### 1. 本地一鍵啟動程序
- [start-local-server.bat](file:///D:/iKnows99.Car/start-local-server.bat)：Windows 批次檔進入點，可直接雙擊滑鼠執行，自動以 Bypass 權限喚起 PowerShell 腳本。
- [start-local-server.ps1](file:///D:/iKnows99.Car/start-local-server.ps1)：
  - 目錄與環境變數自動檢驗（`.env.local` 存在性確認）。
  - 相依套件庫檢驗（自動提示或執行 `npm install`）。
  - **Port 3001 佔用智慧偵測與清理**：若偵測到既有程序佔用 3001 Port，提供一鍵釋放並重啟選項。
  - **雙模式自由選擇**：
    - `[1]` 開發熱重載模式 (`npm run dev`)：修改程式碼即時熱更新（預設）。
    - `[2]` 生產效能模式 (`npm run build & start`)：最佳化編譯極速載入。
  - **自動開啟瀏覽器**：延遲 4 秒自動喚起系統預設瀏覽器開啟 `http://localhost:3001`。

### 2. 專案配置與測試腳本同步
- [package.json](file:///D:/iKnows99.Car/CarVitals/package.json)：將 `dev` 與 `start` 指令預設綁定 `-p 3001`。
- [test-e2e-all.mjs](file:///D:/iKnows99.Car/CarVitals/scripts/test-e2e-all.mjs)：更新目標 URL 為 `http://localhost:3001`。
- [test-preferences.mjs](file:///D:/iKnows99.Car/CarVitals/scripts/test-preferences.mjs)：更新目標 URL 為 `http://localhost:3001`。

---

## 3. 端對端 (E2E) 驗證成果

於 `http://localhost:3001` 執行自動化測試結果：
- **全功能 E2E 測試**：車主登入、名下 3 台愛車查詢、即時零件健康度試算、65 筆維修工單、477 筆加油紀錄、173 筆其他費用以及管理員權限隔離 **全部 100% 通過**。
- **個人偏好設定測試**：個人環境參數（色系、多語系、度量衡、預警閾值、自訂擴充模組參數）在 Port 3001 下讀寫與跨租戶隔離 **全部 100% 通過**。

---

## 4. 使用方式

使用者日常在本機使用時，僅需：
1. 開啟檔案總管至 `D:\iKnows99.Car\`
2. 滑鼠雙擊 **`start-local-server.bat`**
3. 視窗將自動完成環境檢測、啟動服務並自動在瀏覽器中開啟 `http://localhost:3001`！

