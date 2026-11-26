// scripts/migrate-user-isolation.mjs
// 為 vehicles 資料表增加 user_id 欄位，並將既有車輛歸屬於 admin (user_id = 1)
import { createClient } from '@libsql/client';
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

const client = createClient({ url, authToken });

async function migrate() {
  console.log('[*] 正在檢查 vehicles 資料表結構...');
  
  const tableInfo = await client.execute("PRAGMA table_info(vehicles)");
  const cols = tableInfo.rows.map(r => r.name);
  console.log('現有欄位:', cols.join(', '));

  if (!cols.includes('user_id')) {
    console.log('[*] 正在新增 user_id 欄位至 vehicles...');
    await client.execute("ALTER TABLE vehicles ADD COLUMN user_id INTEGER REFERENCES users(id)");
    console.log('✅ user_id 欄位新增成功！');
  } else {
    console.log('[-] user_id 欄位已存在，略過新增');
  }

  // 取得 admin 的 user id
  const userRes = await client.execute("SELECT id, username FROM users WHERE username = 'admin' LIMIT 1");
  if (userRes.rows.length === 0) {
    console.error('❌ 找不到 admin 帳號，請先執行 create-admin.mjs');
    return;
  }
  const adminId = userRes.rows[0].id;
  console.log(`[*] 管理者帳號 ID: ${adminId}`);

  // 將 user_id 為空或 0 的車輛預設指派給 admin
  const updateRes = await client.execute({
    sql: "UPDATE vehicles SET user_id = ? WHERE user_id IS NULL OR user_id = 0",
    args: [adminId]
  });
  console.log(`✅ 已將既有車輛指派給管理者 (受影響筆數: ${updateRes.rowsAffected})`);

  // 檢查目前車輛歸屬
  const checkRes = await client.execute("SELECT vehicle_id, plate_number, nickname, user_id FROM vehicles");
  console.log('\n目前車輛歸屬狀態：');
  checkRes.rows.forEach(r => {
    console.log(`  - [${r.plate_number}] ${r.nickname || ''} ➔ 擁有者 User ID: ${r.user_id}`);
  });
}

migrate().catch(console.error);

