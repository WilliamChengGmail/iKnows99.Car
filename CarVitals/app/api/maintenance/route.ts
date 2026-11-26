import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const db = getDb();
    const isAdmin = user.role === 'admin';

    let sql = `
      SELECT 
        r.record_id, r.vehicle_id, r.record_date, r.record_time, r.mileage,
        r.title, r.total_amount, r.payment_method, r.notes, r.created_at,
        v.plate_number, v.nickname,
        COUNT(i.item_id) as item_count
      FROM maintenance_records r
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
      LEFT JOIN maintenance_items i ON r.record_id = i.record_id
    `;

    const whereClauses: string[] = [];
    const args: any[] = [];

    // 資料隔離：一般車主僅能查看自己名下車輛之工單
    if (!isAdmin) {
      whereClauses.push('v.user_id = ?');
      args.push(user.userId);
    }

    if (vehicleId) {
      whereClauses.push('r.vehicle_id = ?');
      args.push(vehicleId);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' GROUP BY r.record_id ORDER BY r.record_date DESC, r.mileage DESC LIMIT 100';

    const result = await db.execute({ sql, args });

    return NextResponse.json({ records: result.rows });
  } catch (error: any) {
    console.error('查詢維修工單失敗:', error);
    return NextResponse.json({ error: error.message || '查詢失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const body = await request.json();
    const {
      vehicle_id,
      record_date,
      record_time = '00:00',
      mileage,
      title,
      total_amount = 0,
      payment_method = '現金',
      notes,
      items = [], // 零件細項陣列
    } = body;

    if (!vehicle_id || !record_date || !title) {
      return NextResponse.json({ error: '車輛、日期與保養標題為必填項目' }, { status: 400 });
    }

    const db = getDb();

    // 驗證車輛擁有權
    const vCheck = await db.execute({
      sql: 'SELECT user_id, current_mileage FROM vehicles WHERE vehicle_id = ? LIMIT 1',
      args: [vehicle_id]
    });
    if (vCheck.rows.length === 0) {
      return NextResponse.json({ error: '車輛不存在' }, { status: 404 });
    }
    if (user.role !== 'admin' && Number(vCheck.rows[0].user_id) !== user.userId) {
      return NextResponse.json({ error: '無權限為此車輛登記保養' }, { status: 403 });
    }

    const record_id = `mr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 寫入工單主檔
    await db.execute({
      sql: `
        INSERT INTO maintenance_records (
          record_id, vehicle_id, record_date, record_time, mileage,
          title, total_amount, payment_method, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      args: [
        record_id,
        vehicle_id,
        record_date,
        record_time,
        mileage ? Number(mileage) : 0,
        title.trim(),
        total_amount ? Number(total_amount) : 0,
        payment_method,
        notes ? notes.trim() : null,
      ]
    });

    // 批次寫入零件細項
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.item_name) continue;
        await db.execute({
          sql: `
            INSERT INTO maintenance_items (
              record_id, item_name, spec_detail, lifespan_date, lifespan_mileage,
              unit_price, quantity, subtotal, remarks, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          args: [
            record_id,
            item.item_name.trim(),
            item.spec_detail || null,
            item.lifespan_date || null,
            item.lifespan_mileage ? Number(item.lifespan_mileage) : null,
            item.unit_price ? Number(item.unit_price) : 0,
            item.quantity ? Number(item.quantity) : 1,
            item.subtotal ? Number(item.subtotal) : 0,
            item.remarks || null,
          ]
        });
      }
    }

    // 若本次保養里程大於車輛目前里程，自動同步更新車輛里程
    const currentM = Number(vCheck.rows[0].current_mileage || 0);
    const newM = mileage ? Number(mileage) : 0;
    if (newM > currentM) {
      await db.execute({
        sql: 'UPDATE vehicles SET current_mileage = ?, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = ?',
        args: [newM, vehicle_id]
      });
    }

    return NextResponse.json({
      success: true,
      message: '維修工單新增成功',
      record_id,
    });
  } catch (error: any) {
    console.error('新增維修工單失敗:', error);
    return NextResponse.json({ error: error.message || '新增失敗' }, { status: 500 });
  }
}

