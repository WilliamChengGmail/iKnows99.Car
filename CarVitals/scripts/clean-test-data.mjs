// scripts/clean-test-data.mjs
// 清理 E2E 測試時產生的測試用戶與測試車輛，恢復乾淨的正式環境狀態
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

async function cleanTestData() {
  console.log('[*] 正在連線 Turso 雲端資料庫進行測試資料清理...');

  // 1. 刪除測試車輛 (例如車牌 AMY-8888 或非歷史 3 台的車輛)
  const validPlates = ['2553-VY', '2G-4730', 'BGH-2750'];
  const placeholders = validPlates.map(() => '?').join(',');

  const delCarsRes = await client.execute({
    sql: `DELETE FROM vehicles WHERE plate_number NOT IN (${placeholders})`,
    args: validPlates
  });
  console.log(`✅ 已清理測試車輛 (刪除筆數: ${delCarsRes.rowsAffected})`);

  // 2. 刪除測試用戶 (僅保留 admin 與 william)
  const validUsers = ['admin', 'william'];
  const userPlaceholders = validUsers.map(() => '?').join(',');

  const delUsersRes = await client.execute({
    sql: `DELETE FROM users WHERE username NOT IN (${userPlaceholders})`,
    args: validUsers
  });
  console.log(`✅ 已清理測試用戶 (刪除筆數: ${delUsersRes.rowsAffected})`);

  // 3. 確保歷史 3 台車輛全部歸屬於 william
  const williamRes = await client.execute("SELECT id FROM users WHERE username = 'william'");
  if (williamRes.rows.length > 0) {
    const williamId = Number(williamRes.rows[0].id);
    await client.execute({
      sql: 'UPDATE vehicles SET user_id = ?',
      args: [williamId]
    });
    console.log(`✅ 歷史 3 台車輛已確認全部綁定至 william (User ID: ${williamId})`);
  }

  // 4. 稽核目前資料庫狀態
  const usersCheck = await client.execute("SELECT id, username, role FROM users");
  const carsCheck = await client.execute("SELECT vehicle_id, plate_number, nickname, user_id FROM vehicles");

  console.log('\n================== 目前系統正式使用者 ==================');
  usersCheck.rows.forEach(u => {
    console.log(`  - [ID: ${u.id}] ${u.username} (${u.role})`);
  });

  console.log('\n================== 目前系統正式車輛清單 ==================');
  carsCheck.rows.forEach(c => {
    console.log(`  - [${c.plate_number}] ${c.nickname} ➔ 車主 ID: ${c.user_id}`);
  });
  console.log(`總車輛數: ${carsCheck.rows.length} 輛`);
  console.log('========================================================');
}

cleanTestData().catch(console.error);

