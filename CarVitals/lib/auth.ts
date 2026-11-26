// lib/auth.ts
// 使用者身份驗證與 JWT Session 工具模組
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';

const SECRET_KEY = process.env.JWT_SECRET || 'carvitals-default-jwt-secret-key-change-in-prod';
const key = new TextEncoder().encode(SECRET_KEY);

export const COOKIE_NAME = 'session_token';

export interface UserSession {
  userId: number;
  username: string;
  role: 'admin' | 'owner' | 'viewer';
  themePref?: string;
  localePref?: string;
}

/** 簽署 JWT Token */
export async function signToken(payload: UserSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

/** 驗證 JWT Token */
export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as UserSession;
  } catch (error) {
    return null;
  }
}

/** 從伺服器端 Cookies 或 Authorization Header 取得當前 Session 使用者 */
export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = cookies();
  let token = cookieStore.get(COOKIE_NAME)?.value;

  // 若 Cookie 無 Token，支援從 Authorization: Bearer <token> 讀取
  if (!token) {
    const headerList = headers();
    const authHeader = headerList.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;
  return await verifyToken(token);
}
