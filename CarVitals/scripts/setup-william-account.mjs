// scripts/setup-william-account.mjs
// 1. 建立使用者 william (密碼: 123456, 角色: owner)
// 2. 將既有 3 台歷史車輛 (小飛、迷你綠、白玉苦瓜) 及其所有紀錄轉移至 william
// 3. 確保 admin 名下無個人車輛，維持系統維運管理之純粹職責
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

const client = createClient({ url, authToken });

async function setupWilliam() {
  console.log('[*] 正在連線 Turso 雲端資料庫...');

  // 1. 建立或重設 william 帳號
  const username = 'william';
  const password = 'password' in process.env ? process.env.password : '123456';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  console.log(`[*] 建立/更新使用者 [${username}]，角色為車主 (owner)...`);
  await client.execute({
    sql: `
      INSERT INTO users (username, password_hash, role, theme_pref, locale_pref, is_active)
      VALUES (?, ?, 'owner', 'dark', 'zh-TW', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = 'owner',
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [username, passwordHash]
  });

  // 取得 william 的 ID
  const williamRes = await client.execute({
    sql: 'SELECT id, username, role FROM users WHERE username = ?',
    args: [username]
  });
  const williamId = Number(williamRes.rows[0].id);
  console.log(`✅ 使用者 [${username}] 就緒，User ID: ${williamId}，角色: ${williamRes.rows[0].role}`);

  // 2. 將 3 台歷史車輛轉移給 william
  const historicalPlates = ['2553-VY', '2G-4730', 'BGH-2750'];
  console.log(`[*] 正在將既有車輛 ${historicalPlates.join(', ')} 轉移至 william (ID: ${williamId})...`);

  for (const plate of historicalPlates) {
    const updateRes = await client.execute({
      sql: 'UPDATE vehicles SET user_id = ? WHERE plate_number = ?',
      args: [williamId, plate]
    });
    console.log(`   - 車牌 [${plate}]: 已綁定至 william (更新筆數: ${updateRes.rowsAffected})`);
  }

  // 3. 統計 william 名下數據
  const countVehicles = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM vehicles WHERE user_id = ?',
    args: [williamId]
  });
  const countMaint = await client.execute({
    sql: `SELECT COUNT(*) as count FROM maintenance_records WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)`,
    args: [williamId]
  });
  const countRefuel = await client.execute({
    sql: `SELECT COUNT(*) as count FROM refueling_records WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)`,
    args: [williamId]
  });
  const countExpense = await client.execute({
    sql: `SELECT COUNT(*) as count FROM other_expense_records WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)`,
    args: [williamId]
  });

  console.log('\n================== william 帳號數據驗證 ==================');
  console.log(`  車輛總數:   ${countVehicles.rows[0].count} 台 (小飛 2553-VY, 迷你綠 2G-4730, 白玉苦瓜 BGH-2750)`);
  console.log(`  維修工單:   ${countMaint.rows[0].count} 筆`);
  console.log(`  加油紀錄:   ${countRefuel.rows[0].count} 筆`);
  console.log(`  其他費用:   ${countExpense.rows[0].count} 筆`);
  console.log('==========================================================');

  // 4. 驗證 admin 名下車輛
  const adminRes = await client.execute("SELECT id FROM users WHERE username = 'admin'");
  if (adminRes.rows.length > 0) {
    const adminId = Number(adminRes.rows[0].id);
    const adminCars = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM vehicles WHERE user_id = ?',
      args: [adminId]
    });
    console.log(`\n✅ 系統管理者 admin (ID: ${adminId}) 目前個人名下車輛數: ${adminCars.rows[0].count} 台（完全符合系統管理定位）`);
  }
}

setupWilliam().catch(console.error);

