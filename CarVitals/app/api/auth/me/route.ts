import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT id, username, email, role, theme_pref, locale_pref, created_at FROM users WHERE id = ? LIMIT 1',
    args: [user.userId]
  });

  if (res.rows.length === 0) {
    return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
  }

  return NextResponse.json({ user: res.rows[0] });
}

