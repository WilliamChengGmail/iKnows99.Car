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
    const viewAll = searchParams.get('all') === 'true' && user.role === 'admin';

    const db = getDb();
    let query = '';
    let args: any[] = [];

    if (viewAll) {
      query = `
        SELECT v.*, u.username as owner_username, u.email as owner_email
        FROM vehicles v
        LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
      `;
    } else {
      query = `
        SELECT v.*
        FROM vehicles v
        WHERE v.user_id = ?
        ORDER BY v.created_at DESC
      `;
      args = [user.userId];
    }

    const result = await db.execute({ sql: query, args });
    return NextResponse.json({ vehicles: result.rows });
  } catch (error: any) {
    console.error('查詢車輛列表失敗:', error);
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
      plate_number,
      nickname,
      brand,
      model,
      current_mileage,
      mileage_unit = 'km',
      fuel_type = '95無鉛汽油',
      displacement,
    } = body;

    if (!plate_number) {
      return NextResponse.json({ error: '車牌號碼為必填項目' }, { status: 400 });
    }

    const db = getDb();
    // 生成專屬 vehicle_id (例如: v-1700000000)
    const vehicle_id = `v-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await db.execute({
      sql: `
        INSERT INTO vehicles (
          vehicle_id, user_id, plate_number, nickname, brand, model,
          current_mileage, mileage_unit, fuel_type, displacement, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      args: [
        vehicle_id,
        user.userId,
        plate_number.trim().toUpperCase(),
        nickname ? nickname.trim() : null,
        brand ? brand.trim() : null,
        model ? model.trim() : null,
        current_mileage ? Number(current_mileage) : 0,
        mileage_unit,
        fuel_type,
        displacement ? String(displacement) : null,
      ]
    });

    return NextResponse.json({
      success: true,
      message: '車輛新增成功',
      vehicle_id,
    });
  } catch (error: any) {
    console.error('新增車輛失敗:', error);
    return NextResponse.json({ error: error.message || '新增失敗' }, { status: 500 });
  }
}

