# CarVitals 多用戶車籍與費用管理實作驗證報告

> **作者**：Office of William  
> **建立日期**：2026-11-26 08:53  
> **驗證環境**：localhost:3000 (Q 環境) + Turso 雲端資料庫  
> **狀態**：✅ 100% 驗證通過

---

## 一、實作概述

為實現「每位使用者可獨立管理自己的車籍資料及所屬費用」之核心架構，本次實作完成了多用戶資料隔離與權限體系：

1. **資料庫 Schema 升級 (Turso 雲端)**：
   - `vehicles` 資料表成功新增 `user_id` 關聯欄位（外鍵參照 `users.id`）。
   - 既有 3 台歷史車輛（小飛、迷你綠、白玉苦瓜）及其 957 筆關聯工單、加油與費用紀錄，已自動完整繼承歸屬至管理者 `admin`（`user_id = 1`），無任何歷史數據遺失。

2. **身份驗證與授權機制**：
   - 實作 JWT Token 簽署與驗證 (`lib/auth.ts`)。
   - 實作安全 HttpOnly Session Cookie 傳遞。
   - 實作登入 API (`/api/auth/login`)、註冊 API (`/api/auth/register`)、登出 API (`/api/auth/logout`) 與個人資訊查詢 (`/api/auth/me`)。

3. **使用者介面與交互**：
   - 登入與註冊頁面：[app/[locale]/login/page.tsx](file:///D:/iKnows99.Car/CarVitals/app/[locale]/login/page.tsx)（支援深色/淺色主題與多語系）。
   - 頂部導覽列：[components/layout/Navbar.tsx](file:///D:/iKnows99.Car/CarVitals/components/layout/Navbar.tsx)（動態呈現登入者帳號、角色徽章、登出按鈕）。
   - 車籍管理前台：[app/[locale]/vehicles/page.tsx](file:///D:/iKnows99.Car/CarVitals/app/[locale]/vehicles/page.tsx)（車輛清單、登記新車輛 Modal 彈窗）。
   - 管理者後台：[app/[locale]/admin/page.tsx](file:///D:/iKnows99.Car/CarVitals/app/[locale]/admin/page.tsx)（使用者帳號總覽、各會員車輛配額統計、帳號啟用/停用開關）。

---

## 二、端對端 (E2E) 測試成果

| 測試案例 | 驗證操作 | 預期結果 | 實測結果 | 判定 |
|---------|---------|---------|---------|:---:|
| 1. 未登入存取保護 | 訪客直接存取 `/zh-TW/dashboard` | 自動重新導向至 `/zh-TW/login` | HTTP 307 重定向至 `/zh-TW/login` | ✅ 通過 |
| 2. 管理者登入 | 以 `admin` / `admin123456` 登入 | 取得 JWT Session，角色為 `admin` | 登入成功，角色驗證正確 | ✅ 通過 |
| 3. 車主會員註冊 | 註冊新會員 `member_amy` | 建立用戶並指派角色為 `owner` | 成功建立 ID: 3 之新會員 | ✅ 通過 |
| 4. 資料隔離驗證 | `member_amy` 登入後查詢名下車輛 | 預期為 0 筆（不應看到其他車主的車輛） | 回傳 0 筆車輛，嚴格資料隔離生效 | ✅ 通過 |
| 5. 車主新增愛車 | `member_amy` 新增車牌 `AMY-8888` | 該車輛自動綁定 `user_id = 3` | 新增成功，產生專屬 `vehicle_id` | ✅ 通過 |
| 6. 車主專屬車籍查詢 | `member_amy` 再次查詢名下車輛 | 僅顯示自己的 1 筆愛車 `AMY-8888` | 回傳 1 筆專屬車輛，無跨戶數據外洩 | ✅ 通過 |
| 7. 管理者全域視角 | 管理者登入檢視全系統車輛與用戶 | 顯示全系統 4 台車輛與 3 位會員 | 正確統計全域數據，且標註各車輛車主 | ✅ 通過 |

