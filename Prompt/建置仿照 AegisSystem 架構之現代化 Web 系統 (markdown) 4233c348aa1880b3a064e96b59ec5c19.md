# 建置仿照 AegisSystem 架構之現代化 Web 系統 (markdown)

# **專案任務：建置仿照 AegisSystem 架構之現代化 Web 系統**

你好！請協助我以「AegisSystem」的成功架構為範本，建置一個全新的全端 Web 系統。
本系統的前後端將統一由 Next.js 驅動，資料庫採用 Turso (LibSQL) 邊緣雲端資料庫，雲端 Web Service 則部署於 Vercel。

請遵循以下技術架構、設計規範與實作步驟：

---

### **一、 核心技術堆疊 (Tech Stack)**

1. **全端框架**：Next.js 14+ (採用 App Router 架構，相容 Serverless/Edge 執行環境)
2. **前端 UI**：React 18+、Lucide React (圖標庫)、Framer Motion (轉場動畫)、Recharts (數據圖表，若有需要)
3. **雲端資料庫**：Turso (LibSQL) 邊緣資料庫，使用 `@libsql/client` 官方 SDK 進行連線
4. **驗證與安全性**：密碼加密採用 `bcryptjs`，並落實 API 端點權限與輸入檢查
5. **雲端託管與 CI/CD**：Vercel (透過 GitHub 自動建置發布)

---

### **二、 專案結構規範 (Directory Structure)**

建議維持簡潔清晰的目錄劃分：

```
my-project/
├── app/                  # Next.js App Router (頁面與 API)
│   ├── api/              # 後端 API 路由 (Route Handlers)
│   │   ├── auth/         # 登入、登出、權限檢查
│   │   └── [feature]/    # 核心業務功能 API
│   ├── dashboard/        # 登入後之主要功能儀表板
│   ├── login/            # 登入頁面
│   ├── layout.js         # 全域版面與樣式載入
│   └── page.js           # 首頁
├── lib/
│   └── db.js             # Turso LibSQL 資料庫單例 (Singleton) 連線模組
├── scripts/
│   └── init-db.mjs       # 資料庫結構初始化與 Migration 腳本
├── .env.local            # 本地環境變數 (禁止提交至 Git)
├── .env.example          # 環境變數範例檔
├── next.config.mjs       # Next.js 配置
└── package.json
```

---

### **三、 核心連線模組實作規範 (lib/db.js)**

請確保資料庫連線採用單例模式（Singleton），以防止在 Serverless 與本地開發熱重載時建立過多連線：

```jsx
// lib/db.js
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let clientInstance = null;

export function getDb() {
  if (!url || !authToken) {
    throw new Error('請在環境變數中設定 TURSO_DATABASE_URL 與 TURSO_AUTH_TOKEN');
  }

  if (!clientInstance) {
    clientInstance = createClient({
      url,
      authToken,
    });
  }

  return clientInstance;
}
```

---

### **四、 資料庫初始化規範 (scripts/init-db.mjs)**

請提供一個立即可執行的 ESM 腳本，透過 SQL 建立必要的基礎資料表（例如 `users`、`system_logs` 及業務資料表）：

```jsx
// scripts/init-db.mjs
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log('連線至 Turso 雲端資料庫並初始化 Schema...');
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'users',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ 資料庫初始化完成！');
}

main().catch(console.error);
```

---

### **五、 環境變數配置 (.env.local & Vercel)**

在本地測試與 Vercel 專案後台 (Project Settings ➔ Environment Variables) 均需設定以下變數：

```yaml
TURSO_DATABASE_URL="libsql://<your-db-name>-<user>.turso.io"
TURSO_AUTH_TOKEN="<your-turso-jwt-token>"
```

---

### **六、 部署至 Vercel 流程**

1. 將專案推送到 GitHub。
2. 前往 Vercel 控制台 ([https://vercel.com](https://vercel.com/))，點擊「Add New... ➔ Project」並匯入該 GitHub Repo。
3. 若專案不是放在 Repo 根目錄（例如放在子目錄），請在「Root Directory」指定該路徑。
4. 在「Environment Variables」區塊加入 `TURSO_DATABASE_URL` 與 `TURSO_AUTH_TOKEN`。
5. 點擊「Deploy」，等待 1~2 分鐘即可完成雲端上線！

---

請先向我確認本專案的具體業務功能需求，並引導我完成初始化設定與程式碼骨架建立！