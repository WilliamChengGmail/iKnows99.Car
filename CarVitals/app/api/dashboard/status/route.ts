import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { calculateComponentHealth, ComponentHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vehicleIdParam = searchParams.get('vehicleId');

    const db = getDb();
    const isAdmin = user.role === 'admin';

    // 取得使用者可存取的車輛
    let vehiclesQuery = '';
    let vehiclesArgs: any[] = [];

    if (isAdmin) {
      vehiclesQuery = 'SELECT vehicle_id, plate_number, nickname, brand, model, current_mileage, mileage_unit FROM vehicles ORDER BY created_at DESC';
    } else {
      vehiclesQuery = 'SELECT vehicle_id, plate_number, nickname, brand, model, current_mileage, mileage_unit FROM vehicles WHERE user_id = ? ORDER BY created_at DESC';
      vehiclesArgs = [user.userId];
    }

    const vRes = await db.execute({ sql: vehiclesQuery, args: vehiclesArgs });
    const vehicles = vRes.rows;

    if (vehicles.length === 0) {
      return NextResponse.json({
        vehicles: [],
        currentVehicle: null,
        components: [],
        summary: { goodCount: 0, warningCount: 0, dangerCount: 0, overallScore: 100 },
      });
    }

    // 決定目標車輛 (若無指定則預設第一台)
    let selectedVehicle = vehicles[0];
    if (vehicleIdParam) {
      const found = vehicles.find(v => v.vehicle_id === vehicleIdParam);
      if (found) selectedVehicle = found;
    }

    const vId = selectedVehicle.vehicle_id as string;
    const currentMileage = Number(selectedVehicle.current_mileage || 0);

    // 查詢該車輛歷次保養更換的關鍵零件（取每個品項最後一次更換的工單日期與里程）
    const itemsRes = await db.execute({
      sql: `
        SELECT 
          i.item_name,
          i.lifespan_date,
          i.lifespan_mileage,
          r.record_date,
          r.mileage as record_mileage
        FROM maintenance_items i
        JOIN maintenance_records r ON i.record_id = r.record_id
        WHERE r.vehicle_id = ?
        ORDER BY r.record_date DESC, r.mileage DESC
      `,
      args: [vId]
    });

    // 依 item_name 分組，取最新一筆
    const latestItemsMap = new Map<string, any>();
    for (const row of itemsRes.rows) {
      const name = String(row.item_name).trim();
      if (!latestItemsMap.has(name)) {
        latestItemsMap.set(name, row);
      }
    }

    const componentHealthList: ComponentHealth[] = [];

    latestItemsMap.forEach((item, name) => {
      const health = calculateComponentHealth({
        itemName: name,
        lastDateStr: String(item.record_date || ''),
        lastMileage: Number(item.record_mileage || 0),
        currentMileage,
        lifespanDaysInput: item.lifespan_date as string,
        lifespanMileageInput: item.lifespan_mileage as number,
      });

      componentHealthList.push(health);
    });

    // 排序：危險 (danger) 優先 ➔ 警告 (warning) ➔ 正常 (good)
    const priority = { danger: 0, warning: 1, good: 2 };
    componentHealthList.sort((a, b) => {
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      return b.percentageUsed - a.percentageUsed;
    });

    const dangerCount = componentHealthList.filter(c => c.status === 'danger').length;
    const warningCount = componentHealthList.filter(c => c.status === 'warning').length;
    const goodCount = componentHealthList.filter(c => c.status === 'good').length;

    // 計算健康度評分 (100 為滿分)
    let score = 100;
    score -= dangerCount * 25;
    score -= warningCount * 10;
    const overallScore = Math.max(0, Math.min(100, score));

    return NextResponse.json({
      vehicles,
      selectedVehicle,
      components: componentHealthList,
      summary: {
        dangerCount,
        warningCount,
        goodCount,
        overallScore,
      }
    });
  } catch (error: any) {
    console.error('取得車輛健康狀態失敗:', error);
    return NextResponse.json({ error: error.message || '取得健康狀態失敗' }, { status: 500 });
  }
}

