import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { recordId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const db = getDb();
    const isAdmin = user.role === 'admin';

    // 查詢工單主檔與車輛資訊
    const recordRes = await db.execute({
      sql: `
        SELECT 
          r.*,
          v.plate_number, v.nickname, v.brand, v.model, v.user_id as vehicle_owner_id
        FROM maintenance_records r
        JOIN vehicles v ON r.vehicle_id = v.vehicle_id
        WHERE r.record_id = ?
        LIMIT 1
      `,
      args: [params.recordId]
    });

    if (recordRes.rows.length === 0) {
      return NextResponse.json({ error: '找不到此工單' }, { status: 404 });
    }

    const record = recordRes.rows[0];

    // 資料權限防護：非本人車輛且非 Admin 拒絕存取
    if (!isAdmin && Number(record.vehicle_owner_id) !== user.userId) {
      return NextResponse.json({ error: '無權限檢視此工單' }, { status: 403 });
    }

    // 查詢工單下所有零件細項
    const itemsRes = await db.execute({
      sql: `
        SELECT *
        FROM maintenance_items
        WHERE record_id = ?
        ORDER BY item_id ASC
      `,
      args: [params.recordId]
    });

    return NextResponse.json({
      record,
      items: itemsRes.rows,
    });
  } catch (error: any) {
    console.error('查詢工單詳細失敗:', error);
    return NextResponse.json({ error: error.message || '查詢失敗' }, { status: 500 });
  }
}

