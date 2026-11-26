// scripts/migrate-user-preferences.mjs
// 為 users 表新增 preferences_json 欄位，以支援使用者自主決定與調整環境參數，並保持後續新模組的無限擴充性
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

let url = '', authToken = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    if (line.startsWith('TURSO_DATABASE_URL=')) url = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('TURSO_AUTH_TOKEN=')) authToken = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  });
}

const db = createClient({ url, authToken });

async function run() {
  console.log('[*] 正在檢查 users 表之欄位結構...');
  const tableInfo = await db.execute("PRAGMA table_info(users)");
  const colNames = tableInfo.rows.map(r => r.name);
  console.log('現有欄位:', colNames);

  if (!colNames.includes('preferences_json')) {
    console.log('[*] 正在新增 preferences_json 欄位至 users 表...');
    await db.execute("ALTER TABLE users ADD COLUMN preferences_json TEXT DEFAULT '{}'");
    console.log('✅ preferences_json 欄位新增成功！');
  } else {
    console.log('ℹ️ preferences_json 欄位已存在，無需重複新增。');
  }

  // 為現有使用者設定初始偏好設定
  const defaultPrefs = JSON.stringify({
    theme: 'dark',
    accentColor: 'blue',
    locale: 'zh-TW',
    distanceUnit: 'km',
    volumeUnit: 'L',
    fuelEconomyUnit: 'km/L',
    currency: 'TWD',
    defaultLanding: '/dashboard',
    alertMileageThreshold: 1000,
    alertDaysThreshold: 30,
    modules: {
      notifications: {
        maintenanceAlerts: true,
        fuelLogsReminder: true
      }
    }
  });

  await db.execute({
    sql: "UPDATE users SET preferences_json = ? WHERE preferences_json IS NULL OR preferences_json = '' OR preferences_json = '{}'",
    args: [defaultPrefs]
  });
  console.log('✅ 已為現有使用者初始化預設環境參數！');

  const checkUsers = await db.execute("SELECT id, username, theme_pref, locale_pref, preferences_json FROM users");
  console.log('使用者偏好設定資料摘要:');
  checkUsers.rows.forEach(u => {
    console.log(`- 使用者: ${u.username} | 偏好資料長度: ${String(u.preferences_json).length} 字元`);
  });
}

run().catch(console.error);

