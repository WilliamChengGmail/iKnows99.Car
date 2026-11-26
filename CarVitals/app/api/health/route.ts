import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute("SELECT datetime('now') as now, COUNT(*) as count FROM vehicles");
    return NextResponse.json({
      status: 'ok',
      timestamp: result.rows[0].now,
      vehicleCount: Number(result.rows[0].count),
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }
}
