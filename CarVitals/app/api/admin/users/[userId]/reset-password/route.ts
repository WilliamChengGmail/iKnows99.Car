import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** 生成 8~10 碼包含英數混合的隨機臨時密碼 */
function generateRandomPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '權限不足，僅系統管理員可重置密碼' }, { status: 403 });
    }

    const targetUserId = Number(params.userId);
    const db = getDb();

    // 查詢目標使用者
    const userRes = await db.execute({
      sql: 'SELECT id, username, role FROM users WHERE id = ? LIMIT 1',
      args: [targetUserId]
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: '找不到該使用者' }, { status: 404 });
    }

    const targetUser = userRes.rows[0];

    // 生成隨機密碼 (8 碼英數字)
    const temporaryPassword = generateRandomPassword(8);

    // 雜湊臨時密碼
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(temporaryPassword, salt);

    // 更新資料庫並標記 must_change_password = 1
    await db.execute({
      sql: `
        UPDATE users 
        SET password_hash = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [passwordHash, targetUserId]
    });

    return NextResponse.json({
      success: true,
      username: targetUser.username,
      temporaryPassword,
      message: `使用者 [${targetUser.username}] 的密碼已成功重置！下次登入將強制更新密碼。`,
    });
  } catch (error: any) {
    console.error('重置密碼失敗:', error);
    return NextResponse.json({ error: error.message || '重置密碼失敗' }, { status: 500 });
  }
}

