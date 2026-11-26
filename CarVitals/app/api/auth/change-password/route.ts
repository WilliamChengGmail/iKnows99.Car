import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser, signToken, COOKIE_NAME } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '請提供舊密碼與新密碼' }, { status: 400 });
    }

    if (newPassword.length < 6 || newPassword.length > 32) {
      return NextResponse.json({ error: '新密碼長度須在 6 至 32 個字元之間' }, { status: 400 });
    }

    if (oldPassword === newPassword) {
      return NextResponse.json({ error: '新密碼不能與目前密碼相同' }, { status: 400 });
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, username, password_hash, role, theme_pref, locale_pref FROM users WHERE id = ? LIMIT 1',
      args: [user.userId]
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    const dbUser = userRes.rows[0];

    // 驗證舊密碼
    const isMatch = await bcrypt.compare(oldPassword, String(dbUser.password_hash));
    if (!isMatch) {
      return NextResponse.json({ error: '目前舊密碼輸入不正確' }, { status: 400 });
    }

    // 雜湊新密碼
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // 更新密碼，並重設 must_change_password 為 0
    await db.execute({
      sql: `
        UPDATE users 
        SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [newHash, user.userId]
    });

    // 重新簽發 JWT Cookie，解除強制修改密碼狀態
    const updatedSession = {
      userId: Number(dbUser.id),
      username: String(dbUser.username),
      role: dbUser.role as any,
      themePref: String(dbUser.theme_pref || 'dark'),
      localePref: String(dbUser.locale_pref || 'zh-TW'),
      mustChangePassword: false,
    };

    const token = await signToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      message: '密碼已成功更新！',
      user: updatedSession,
    });

    const isHttps = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://');

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('修改密碼失敗:', error);
    return NextResponse.json({ error: error.message || '修改密碼失敗' }, { status: 500 });
  }
}

