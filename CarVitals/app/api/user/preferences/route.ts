import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_PREFERENCES = {
  theme: 'dark',
  accentColor: 'blue',
  locale: 'zh-TW',
  distanceUnit: 'km',
  volumeUnit: 'L',
  fuelEconomyUnit: 'km/L',
  currency: 'TWD',
  defaultLanding: '/dashboard',
  alertMileageThreshold: 1000,
  alertDaysThreshold: 30,
  modules: {
    notifications: {
      maintenanceAlerts: true,
      fuelLogsReminder: true,
    },
  },
};

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT theme_pref, locale_pref, preferences_json FROM users WHERE id = ? LIMIT 1',
      args: [user.userId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    const row = result.rows[0];
    let customPrefs: any = {};
    if (row.preferences_json) {
      try {
        customPrefs = JSON.parse(String(row.preferences_json));
      } catch (e) {
        customPrefs = {};
      }
    }

    const merged = {
      ...DEFAULT_PREFERENCES,
      ...customPrefs,
      theme: customPrefs.theme || row.theme_pref || DEFAULT_PREFERENCES.theme,
      locale: customPrefs.locale || row.locale_pref || DEFAULT_PREFERENCES.locale,
      modules: {
        ...DEFAULT_PREFERENCES.modules,
        ...(customPrefs.modules || {}),
      },
    };

    return NextResponse.json({ preferences: merged });
  } catch (error: any) {
    console.error('取得使用者偏好失敗:', error);
    return NextResponse.json({ error: error.message || '取得偏好失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const body = await request.json();
    const incomingPrefs = body.preferences || body;

    const db = getDb();

    // 先讀取既有設定以進行深度合併
    const existingRes = await db.execute({
      sql: 'SELECT preferences_json, theme_pref, locale_pref FROM users WHERE id = ? LIMIT 1',
      args: [user.userId],
    });

    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    let currentPrefs: any = {};
    try {
      currentPrefs = JSON.parse(String(existingRes.rows[0].preferences_json || '{}'));
    } catch (e) {
      currentPrefs = {};
    }

    const updatedPreferences = {
      ...DEFAULT_PREFERENCES,
      ...currentPrefs,
      ...incomingPrefs,
      modules: {
        ...DEFAULT_PREFERENCES.modules,
        ...(currentPrefs.modules || {}),
        ...(incomingPrefs.modules || {}),
      },
    };

    const themePref = updatedPreferences.theme || 'dark';
    const localePref = updatedPreferences.locale || 'zh-TW';
    const jsonStr = JSON.stringify(updatedPreferences);

    await db.execute({
      sql: "UPDATE users SET preferences_json = ?, theme_pref = ?, locale_pref = ?, updated_at = datetime('now') WHERE id = ?",
      args: [jsonStr, themePref, localePref, user.userId],
    });

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
      message: '使用者環境偏好已成功更新',
    });
  } catch (error: any) {
    console.error('更新使用者偏好失敗:', error);
    return NextResponse.json({ error: error.message || '更新偏好失敗' }, { status: 500 });
  }
}

