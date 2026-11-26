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
  const q = `
    SELECT vehicle_id, MAX(mileage) as max_m FROM (
      SELECT vehicle_id, mileage FROM maintenance_records
      UNION ALL
      SELECT vehicle_id, mileage FROM refueling_records
      UNION ALL
      SELECT vehicle_id, mileage FROM other_expense_records
    ) GROUP BY vehicle_id
  `;
  const res = await db.execute(q);
  console.log('Max mileages found in records:', res.rows);

  for (const row of res.rows) {
    if (row.vehicle_id && row.max_m > 0) {
      await db.execute({
        sql: "UPDATE vehicles SET current_mileage = ? WHERE vehicle_id = ? AND (current_mileage IS NULL OR current_mileage < ?)",
        args: [row.max_m, row.vehicle_id, row.max_m]
      });
      console.log(`✅ 已校準車輛 [${row.vehicle_id}] 當前里程為: ${row.max_m} km`);
    }
  }

  const v = await db.execute("SELECT vehicle_id, plate_number, nickname, current_mileage FROM vehicles");
  console.log('\nUpdated vehicles:\n', v.rows);
}

run().catch(console.error);

