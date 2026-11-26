import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const targetUserId = Number(params.userId);
    const { role, is_active } = await request.json();

    const db = getDb();

    const updates: string[] = [];
    const args: any[] = [];

    if (role !== undefined) {
      updates.push('role = ?');
      args.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      args.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '無更新欄位' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    args.push(targetUserId);

    await db.execute({
      sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ success: true, message: '使用者狀態已更新' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新失敗' }, { status: 500 });
  }
}

