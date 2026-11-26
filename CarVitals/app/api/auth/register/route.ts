import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { username, password, email } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '帳號與密碼為必填項目' }, { status: 400 });
    }

    if (username.length < 3 || password.length < 6) {
      return NextResponse.json({ error: '帳號至少需 3 個字元，密碼至少需 6 個字元' }, { status: 400 });
    }

    const db = getDb();

    // 檢查帳號是否已存在
    const checkRes = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ? LIMIT 1',
      args: [username.trim()]
    });

    if (checkRes.rows.length > 0) {
      return NextResponse.json({ error: '此帳號名稱已被註冊，請更換帳號名稱' }, { status: 409 });
    }

    // 密碼雜湊
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 寫入使用者，預設角色為車主 (owner)
    const insertRes = await db.execute({
      sql: `
        INSERT INTO users (username, email, password_hash, role, theme_pref, locale_pref, is_active)
        VALUES (?, ?, ?, 'owner', 'dark', 'zh-TW', 1)
      `,
      args: [username.trim(), email ? email.trim() : null, passwordHash]
    });

    const newUserId = Number(insertRes.lastInsertRowid);

    // 簽發 JWT Token，註冊完成自動登入
    const sessionData = {
      userId: newUserId,
      username: username.trim(),
      role: 'owner' as const,
      themePref: 'dark',
      localePref: 'zh-TW',
    };

    const token = await signToken(sessionData);

    const response = NextResponse.json({
      success: true,
      message: '註冊成功',
      token,
      user: sessionData,
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
    console.error('註冊錯誤:', error);
    return NextResponse.json({ error: error.message || '註冊失敗' }, { status: 500 });
  }
}
