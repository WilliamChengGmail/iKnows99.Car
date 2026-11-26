import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '請輸入帳號與密碼' }, { status: 400 });
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, username, password_hash, role, theme_pref, locale_pref, is_active, must_change_password FROM users WHERE username = ? LIMIT 1',
      args: [username.trim()]
    });

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    const user = userRes.rows[0];

    if (user.is_active === 0) {
      return NextResponse.json({ error: '此帳號已被停用，請聯絡系統管理員' }, { status: 403 });
    }

    const isMatch = await bcrypt.compare(password, String(user.password_hash));
    if (!isMatch) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    // 更新最後登入時間
    await db.execute({
      sql: 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [user.id]
    });

    // 簽發 JWT Token
    const sessionData = {
      userId: Number(user.id),
      username: String(user.username),
      role: user.role as any,
      themePref: String(user.theme_pref || 'dark'),
      localePref: String(user.locale_pref || 'zh-TW'),
      mustChangePassword: Number(user.must_change_password) === 1,
    };

    const token = await signToken(sessionData);

    const response = NextResponse.json({
      success: true,
      token,
      user: sessionData,
      mustChangePassword: sessionData.mustChangePassword,
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
    console.error('登入錯誤:', error);
    return NextResponse.json({ error: error.message || '系統發生錯誤' }, { status: 500 });
  }
}
