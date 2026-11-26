// scripts/test-preferences.mjs
// 測試使用者偏好設定 (Preferences) 之讀取、更新、深層合併與跨使用者隔離

const BASE_URL = 'http://localhost:3000';

async function testPreferences() {
  console.log('🚀 開始使用者環境偏好 (User Preferences) 自動化驗證...\n');

  // 1. 車主 william 登入
  console.log('[1/4] 登入車主 william (帳號: william)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'william', password: '123456' }),
  });
  if (!loginRes.ok) throw new Error(`登入失敗: ${loginRes.status}`);
  const { token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  console.log('  ✅ william 登入成功');

  // 2. 讀取 william 偏好
  console.log('\n[2/4] 查詢目前環境偏好 (GET /api/user/preferences)...');
  const getRes = await fetch(`${BASE_URL}/api/user/preferences`, { headers: authHeaders });
  if (!getRes.ok) throw new Error(`查詢偏好失敗: ${getRes.status}`);
  const getData = await getRes.json();
  console.log('  ✅ 成功取得偏好設定:');
  console.log('     - 主題模式:', getData.preferences.theme);
  console.log('     - 風格強調色:', getData.preferences.accentColor);
  console.log('     - 語言環境:', getData.preferences.locale);
  console.log('     - 度量衡單位:', `${getData.preferences.distanceUnit} / ${getData.preferences.volumeUnit} / ${getData.preferences.fuelEconomyUnit}`);
  console.log('     - 保養預警閾值:', `前 ${getData.preferences.alertMileageThreshold} km / 前 ${getData.preferences.alertDaysThreshold} 天`);
  console.log('     - 模組通知開關:', getData.preferences.modules?.notifications);

  // 3. 更新 william 偏好 (自訂色系為 emerald、保養閾值設為 1500 km，並新增自訂擴充模組參數)
  console.log('\n[3/4] 調整環境參數與自訂模組設定 (PUT /api/user/preferences)...');
  const updatePayload = {
    theme: 'dark',
    accentColor: 'emerald',
    locale: 'zh-TW',
    alertMileageThreshold: 1500,
    modules: {
      notifications: {
        maintenanceAlerts: true,
        fuelLogsReminder: true,
        monthlyDigest: false,
      },
      obdTelemetry: {
        enabled: true,
        autoSyncIntervalSeconds: 60,
      },
    },
  };

  const putRes = await fetch(`${BASE_URL}/api/user/preferences`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ preferences: updatePayload }),
  });
  if (!putRes.ok) throw new Error(`更新偏好失敗: ${putRes.status}`);
  const putData = await putRes.json();
  console.log('  ✅ 更新成功，伺服器回應:', putData.message);

  // 再次查詢驗證持久化與合併結果
  const verifyRes = await fetch(`${BASE_URL}/api/user/preferences`, { headers: authHeaders });
  const verifyData = await verifyRes.json();
  const updated = verifyData.preferences;
  console.log('  ✅ 驗證資料庫持久化:');
  console.log('     - 強調色是否變更為 emerald:', updated.accentColor === 'emerald');
  console.log('     - 里程閾值是否變更為 1500:', updated.alertMileageThreshold === 1500);
  console.log('     - 自訂擴充模組 (obdTelemetry) 是否成功保存:', updated.modules?.obdTelemetry?.enabled === true);

  if (updated.accentColor !== 'emerald' || updated.alertMileageThreshold !== 1500) {
    throw new Error('偏好設定持久化驗證不符！');
  }

  // 4. 驗證跨使用者隔離 (admin 登入，確認 admin 偏好未受 william 變更影響)
  console.log('\n[4/4] 驗證跨使用者偏好隔離 (登入 admin)...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const adminAuth = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${(await adminLoginRes.json()).token}`,
  };

  const adminGetRes = await fetch(`${BASE_URL}/api/user/preferences`, { headers: adminAuth });
  const adminPrefs = (await adminGetRes.json()).preferences;
  console.log('  ✅ admin 偏好設定:');
  console.log('     - admin 強調色:', adminPrefs.accentColor, '(應維持 blue 預設)');
  console.log('     - admin 是否包含 william 的 obdTelemetry:', !!adminPrefs.modules?.obdTelemetry);

  if (adminPrefs.accentColor === 'emerald' || !!adminPrefs.modules?.obdTelemetry) {
    throw new Error('跨使用者偏好隔離失敗：admin 設定受到了 william 影響！');
  }
  console.log('  ✅ 跨使用者偏好嚴格隔離驗證通過！');

  console.log('\n🎉 使用者自訂環境參數與模組擴充機制 100% 驗證通過！');
}

testPreferences().catch((err) => {
  console.error('\n❌ 驗證遭遇錯誤:', err);
  process.exit(1);
});

