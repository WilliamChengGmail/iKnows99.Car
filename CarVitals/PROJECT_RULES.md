# CarVitals 專案開發與檔案管理規範 (PROJECT_RULES)

> **制定者**：Office of William  
> **建立日期**：2026-11-25  
> **版本**：v1.0  
> **適用範圍**：`D:\iKnows99.Car\CarVitals` 及相關工作區

---

## 1. 文件生成與存放規範 (Documentation Rules)

### 1.1 一般任務與規劃文件 (Task & Planning Docs)
- **類型**：`implementation_plan`、`task`、`walkthrough`、進度報告、分析歷程等。
- **儲存目錄**：`D:\iKnows99.Car\DocumentsAndInformations\`
- **檔名命名原則**：必須加上日期與時間資訊。
  - 格式：`{{NAME}}_{{YYYYMMDD}}_{{HHmmss}}.md`
  - 範例：`implementation_plan_20261125_155333.md`、`task_20261125_160000.md`

### 1.2 專案使用者與系統說明文件 (Project & User Docs)
- **類型**：專案說明文件 (README)、API 規格 (api_spec.md)、資料庫結構說明 (db_schema.md)、使用者手冊 (user_manual.md) 等。
- **儲存目錄**：`D:\iKnows99.Car\CarVitals\docs\`

### 1.3 檔案備份與版本控制
- **自動備份觸發**：在修改、覆蓋或重新產生任何 `.md` 檔案之前，必須先執行備份動作。
- **備份命名規則**：
  - 格式：`{{FILE_NAME}}_{{TIMESTAMP}}.bak`
  - 存放位置：檔案所在目錄之 `.backups` 子目錄（若無則自動建立）。
- **元數據同步**：凡 `.md` 內容異動，必須同時更新 `{{FILE_NAME}}.metadata.json` 內的 `last_modified`、`version` 與 `author`。

---

## 2. 資料庫架構與連線原則 (Database Architecture)

- **核心資料庫**：**Turso 雲端資料庫 (LibSQL)**。
- **開發環境連線**：**本地端開發環境 (Q) 亦優先直接連線至 Turso 雲端資料庫**進行即時驗證。
- **本地端 SQLite (`iknow99_car.db`) 定位**：
  - 作為爬蟲系統歷史資料擷取存檔。
  - 作為本地備援與初始資料庫遷移 (Migration) 來源。
- **連線資訊安全性**：
  - `TURSO_DATABASE_URL` 與 `TURSO_AUTH_TOKEN` 僅存放於 `.env.local`。
  - 嚴禁將真實密鑰或憑證提交至 Git。

---

## 3. 介面與功能規範 (UI/UX & Features)

- **多語系支援**：
  - 初始版本支援繁體中文 (`zh-TW`) 與英文 (`en`)。
  - 系統預設語系為繁體中文 (`zh-TW`)。
- **UI 主題風格**：
  - 深色模式 (Dark Mode) 優先。
  - 每個使用者可自由切換深色 / 淺色主題，且設定需持久化儲存。
- **核心架構**：
  - 仿照 AegisSystem 成功架構。
  - 權限管理包含前台與管理後台 (Admin)。

---

## 4. 版本控制與簽入規範 (Git Commit Standards)

- **執行時機**：**必須等待使用者明確下達「git commit and push」指示時才可執行**。
- **Commit 訊息格式**：**必須使用繁體中文多行格式，嚴禁單行說明**。
- **格式規範**：
  ```
  <類型>: <簡短摘要 (72字內)>

  - 變更原因與背景
  - 主要異動細節清單
  - 相關模組或設計考量
  ```

---

## 5. 文件作者署名 (Authoring Attribution)

- 文件中若提及作者、分析者、撰寫者或製作者等資訊，一律署名為 **`Office of William`**。

---

