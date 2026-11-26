import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '權限不足，僅系統管理者可存取' }, { status: 403 });
    }

    const db = getDb();
    // 查詢全部使用者並統計名下車輛數
    const result = await db.execute(`
      SELECT 
        u.id, u.username, u.email, u.role, u.is_active, u.last_login_at, u.created_at,
        COUNT(v.vehicle_id) as vehicle_count
      FROM users u
      LEFT JOIN vehicles v ON u.id = v.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error: any) {
    console.error('查詢使用者列表失敗:', error);
    return NextResponse.json({ error: error.message || '查詢失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { username, password, email, role = 'owner' } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '帳號與密碼為必填項目' }, { status: 400 });
    }

    const db = getDb();

    // 檢查重名
    const exist = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ? LIMIT 1',
      args: [username.trim()]
    });
    if (exist.rows.length > 0) {
      return NextResponse.json({ error: '帳號名稱已存在' }, { status: 409 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await db.execute({
      sql: `
        INSERT INTO users (username, email, password_hash, role, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      args: [username.trim(), email ? email.trim() : null, passwordHash, role]
    });

    return NextResponse.json({ success: true, message: '使用者建立成功' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '建立使用者失敗' }, { status: 500 });
  }
}

