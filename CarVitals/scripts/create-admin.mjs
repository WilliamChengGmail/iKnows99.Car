// scripts/create-admin.mjs
// 初始化建立 CarVitals 管理者帳號 (Admin)
// 遵循 AegisSystem 架構與密碼雜湊規範
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 讀取 .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  });
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('❌ 請確認 .env.local 已設定 TURSO_DATABASE_URL');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function createAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123456';

  console.log(`[*] 正在為使用者 [${username}] 建立/重設管理者帳號...`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  await client.execute({
    sql: `
      INSERT INTO users (username, password_hash, role, theme_pref, locale_pref, is_active)
      VALUES (?, ?, 'admin', 'dark', 'zh-TW', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = 'admin',
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [username, passwordHash]
  });

  console.log(`✅ 管理者帳號 [${username}] 已建立完成！角色: admin, 預設密碼: ${password}`);
}

createAdmin().catch(console.error);

