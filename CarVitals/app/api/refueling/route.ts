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
        r.record_id, r.vehicle_id, r.refuel_date, r.refuel_time, r.mileage,
        r.total_amount, r.payment_method, r.liters, r.unit_price, r.fuel_type,
        r.is_previous_missed, r.fuel_gauge_position, r.prev_mileage, r.trip_distance,
        r.fuel_efficiency, r.cost_per_km, r.notes, r.created_at,
        v.plate_number, v.nickname
      FROM refueling_records r
      JOIN vehicles v ON r.vehicle_id = v.vehicle_id
    `;

    const whereClauses: string[] = [];
    const args: any[] = [];

    // 資料隔離：一般車主僅能查看名下車輛之加油紀錄
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

    // 依時間正序讀取以計算前後兩筆之間的里程差與真實油耗
    sql += ' ORDER BY r.refuel_date ASC, r.refuel_time ASC, r.mileage ASC';

    const result = await db.execute({ sql, args });
    const rawRows = result.rows as any[];

    // 依車輛分組計算油耗
    const vehicleLastRecord: { [vId: string]: { mileage: number } } = {};
    const processedRows = rawRows.map((row) => {
      let tripDistance = Number(row.trip_distance) || 0;
      let fuelEfficiency = Number(row.fuel_efficiency) || 0;
      let costPerKm = Number(row.cost_per_km) || 0;
      const mileage = Number(row.mileage) || 0;
      const liters = Number(row.liters) || 0;
      const totalAmount = Number(row.total_amount) || 0;

      const prev = vehicleLastRecord[row.vehicle_id];
      if (prev && prev.mileage > 0 && mileage > prev.mileage) {
        if (tripDistance === 0) {
          tripDistance = mileage - prev.mileage;
        }
      }

      if (tripDistance > 0 && liters > 0) {
        if (fuelEfficiency === 0) {
          fuelEfficiency = Math.round((tripDistance / liters) * 100) / 100;
        }
        if (costPerKm === 0) {
          costPerKm = Math.round((totalAmount / tripDistance) * 100) / 100;
        }
      }

      vehicleLastRecord[row.vehicle_id] = { mileage };

      return {
        ...row,
        trip_distance: tripDistance,
        fuel_efficiency: fuelEfficiency,
        cost_per_km: costPerKm,
      };
    });

    // 統計計算
    let totalLiters = 0;
    let totalSpent = 0;
    let totalDistance = 0;
    let efficiencyCount = 0;
    let efficiencySum = 0;

    processedRows.forEach((r) => {
      totalLiters += Number(r.liters) || 0;
      totalSpent += Number(r.total_amount) || 0;
      if (r.trip_distance > 0) {
        totalDistance += r.trip_distance;
      }
      if (r.fuel_efficiency > 0 && r.fuel_efficiency < 40) {
        // 排除極端異常值
        efficiencySum += r.fuel_efficiency;
        efficiencyCount++;
      }
    });

    const avgEfficiency = efficiencyCount > 0 ? Math.round((efficiencySum / efficiencyCount) * 100) / 100 : 0;
    const avgCostPerKm = totalDistance > 0 ? Math.round((totalSpent / totalDistance) * 100) / 100 : 0;

    // 回傳時反轉為最新記錄排在最前面
    const reversedRecords = processedRows.reverse();

    return NextResponse.json({
      records: reversedRecords,
      stats: {
        totalRecords: processedRows.length,
        totalLiters: Math.round(totalLiters * 100) / 100,
        totalSpent: Math.round(totalSpent),
        totalDistance: Math.round(totalDistance),
        avgEfficiency,
        avgCostPerKm,
      },
    });
  } catch (error: any) {
    console.error('查詢加油紀錄失敗:', error);
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
      refuel_date,
      refuel_time = '12:00',
      mileage,
      liters,
      unit_price,
      total_amount,
      fuel_type = '95無鉛',
      payment_method = '信用卡',
      notes = '',
    } = body;

    if (!vehicle_id || !refuel_date || mileage === undefined || !liters) {
      return NextResponse.json({ error: '車輛、日期、當前里程與公升數為必填項目' }, { status: 400 });
    }

    const numMileage = Number(mileage);
    const numLiters = Number(liters);
    const numPrice = Number(unit_price) || (Number(total_amount) / numLiters);
    const numTotal = Number(total_amount) || Math.round(numLiters * numPrice);

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
      return NextResponse.json({ error: '無權限為此車輛登記加油' }, { status: 403 });
    }

    // 取得該車前一筆最新加油記錄以計算間隔行駛距離與油耗
    const prevRec = await db.execute({
      sql: 'SELECT mileage FROM refueling_records WHERE vehicle_id = ? ORDER BY refuel_date DESC, refuel_time DESC LIMIT 1',
      args: [vehicle_id],
    });

    let prevMileage = 0;
    let tripDistance = 0;
    let fuelEfficiency = 0;
    let costPerKm = 0;

    if (prevRec.rows.length > 0) {
      prevMileage = Number(prevRec.rows[0].mileage) || 0;
      if (numMileage > prevMileage) {
        tripDistance = numMileage - prevMileage;
        if (numLiters > 0) {
          fuelEfficiency = Math.round((tripDistance / numLiters) * 100) / 100;
          costPerKm = Math.round((numTotal / tripDistance) * 100) / 100;
        }
      }
    }

    const record_id = `rf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 寫入加油紀錄
    await db.execute({
      sql: `
        INSERT INTO refueling_records (
          record_id, vehicle_id, refuel_date, refuel_time, mileage,
          total_amount, payment_method, liters, unit_price, fuel_type,
          prev_mileage, trip_distance, fuel_efficiency, cost_per_km, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        record_id,
        vehicle_id,
        refuel_date,
        refuel_time,
        numMileage,
        numTotal,
        payment_method,
        numLiters,
        numPrice,
        fuel_type,
        prevMileage,
        tripDistance,
        fuelEfficiency,
        costPerKm,
        notes,
      ],
    });

    // 若新里程大於車輛當前里程，自動同步更新 vehicles
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
      trip_distance: tripDistance,
      fuel_efficiency: fuelEfficiency,
      cost_per_km: costPerKm,
    });
  } catch (error: any) {
    console.error('新增加油紀錄失敗:', error);
    return NextResponse.json({ error: error.message || '新增失敗' }, { status: 500 });
  }
}

