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
    const category = searchParams.get('category');
    const db = getDb();
    const isAdmin = user.role === 'admin';

    let sql = `
      SELECT 
        e.record_id, e.vehicle_id, e.expense_date, e.expense_time, e.mileage,
        e.title, e.expense_category, e.total_amount, e.payment_method, e.notes, e.created_at,
        v.plate_number, v.nickname
      FROM other_expense_records e
      JOIN vehicles v ON e.vehicle_id = v.vehicle_id
    `;

    const whereClauses: string[] = [];
    const args: any[] = [];

    // 資料隔離：一般車主僅能查看名下車輛之費用
    if (!isAdmin) {
      whereClauses.push('v.user_id = ?');
      args.push(user.userId);
    }

    if (vehicleId) {
      whereClauses.push('e.vehicle_id = ?');
      args.push(vehicleId);
    }

    if (category) {
      whereClauses.push('e.expense_category = ?');
      args.push(category);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY e.expense_date DESC, e.expense_time DESC, e.created_at DESC';

    const result = await db.execute({ sql, args });
    const records = result.rows as any[];

    // 統計計算
    let totalSpent = 0;
    const categoryTotals: { [key: string]: number } = {};

    records.forEach((r) => {
      const amount = Number(r.total_amount) || 0;
      totalSpent += amount;
      const cat = r.expense_category || '其他';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    });

    return NextResponse.json({
      records,
      stats: {
        totalRecords: records.length,
        totalSpent: Math.round(totalSpent),
        categoryTotals,
      },
    });
  } catch (error: any) {
    console.error('查詢其他費用失敗:', error);
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
      expense_date,
      expense_time = '12:00',
      mileage,
      title,
      expense_category = '其他',
      total_amount,
      payment_method = '現金',
      notes = '',
    } = body;

    if (!vehicle_id || !expense_date || !title || total_amount === undefined) {
      return NextResponse.json({ error: '車輛、日期、項目名稱與金額為必填項目' }, { status: 400 });
    }

    const numAmount = Number(total_amount);
    const numMileage = mileage !== undefined && mileage !== '' ? Number(mileage) : 0;

    const db = getDb();

    // 驗證車輛擁有權
    const vCheck = await db.execute({
      sql: 'SELECT user_id, current_mileage FROM vehicles WHERE vehicle_id = ? LIMIT 1',
      args: [vehicle_id],
    });
    if (vCheck.rows.length === 0) {
      return NextResponse.json({ error: '車輛不存在' }, { status: 404 });
    }
    if (user.role !== 'admin' && Number(vCheck.rows[0].user_id) !== user.userId) {
      return NextResponse.json({ error: '無權限為此車輛登記費用' }, { status: 403 });
    }

    const record_id = `oe-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await db.execute({
      sql: `
        INSERT INTO other_expense_records (
          record_id, vehicle_id, expense_date, expense_time, mileage,
          title, expense_category, total_amount, payment_method, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        record_id,
        vehicle_id,
        expense_date,
        expense_time,
        numMileage,
        title,
        expense_category,
        numAmount,
        payment_method,
        notes,
      ],
    });

    // 若填寫了里程且大於車輛當前里程，自動同步更新 vehicles
    const currVehicleMileage = Number(vCheck.rows[0].current_mileage) || 0;
    if (numMileage > currVehicleMileage) {
      await db.execute({
        sql: "UPDATE vehicles SET current_mileage = ?, updated_at = datetime('now') WHERE vehicle_id = ?",
        args: [numMileage, vehicle_id],
      });
    }

    return NextResponse.json({
      success: true,
      record_id,
    });
  } catch (error: any) {
    console.error('新增其他費用失敗:', error);
    return NextResponse.json({ error: error.message || '新增失敗' }, { status: 500 });
  }
}

