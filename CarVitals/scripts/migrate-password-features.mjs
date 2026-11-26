// scripts/migrate-password-features.mjs
// 為 users 資料表擴充 must_change_password 欄位
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const client = createClient({ url, authToken });

async function migratePasswordFeatures() {
  console.log('[*] 正在檢查 users 資料表欄位結構...');
  const tableInfo = await client.execute("PRAGMA table_info(users)");
  const cols = tableInfo.rows.map(r => r.name);
  console.log('現有欄位:', cols.join(', '));

  if (!cols.includes('must_change_password')) {
    console.log('[*] 正在新增 must_change_password 欄位...');
    await client.execute("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0");
    console.log('✅ must_change_password 欄位新增成功！');
  } else {
    console.log('[-] must_change_password 欄位已存在');
  }

  // 驗證現有使用者的狀態
  const users = await client.execute("SELECT id, username, role, must_change_password FROM users");
  console.log('\n目前使用者狀態：');
  users.rows.forEach(u => {
    console.log(`  - [${u.username}] 角色: ${u.role}, 強制更換密碼旗標: ${u.must_change_password}`);
  });
}

migratePasswordFeatures().catch(console.error);

