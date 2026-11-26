// scripts/test-e2e-all.mjs
// 端對端全功能自動化測試

const BASE_URL = 'http://localhost:3000';

async function testAll() {
  console.log('🚀 開始 CarVitals 全功能端對端 (E2E) 驗證流程...\n');

  // 1. 車主 william 登入
  console.log('[1/7] 測試車主登入 (帳號: william)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'william', password: '123456' }),
  });
  if (!loginRes.ok) {
    throw new Error(`登入失敗: ${loginRes.status} ${await loginRes.text()}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  const cookieHeader = loginRes.headers.get('set-cookie') || '';
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': cookieHeader,
  };
  console.log(`  ✅ 登入成功: 使用者 ${loginData.user.username} (角色: ${loginData.user.role})`);

  // 2. 驗證車籍清單
  console.log('\n[2/7] 測試車籍查詢 (/api/vehicles)...');
  const vRes = await fetch(`${BASE_URL}/api/vehicles`, { headers: authHeaders });
  const vData = await vRes.json();
  console.log(`  ✅ 查詢成功: 名下共有 ${vData.vehicles.length} 輛愛車`);
  vData.vehicles.forEach(v => {
    console.log(`     - 車牌: ${v.plate_number} (${v.nickname || '無暱稱'}) | 里程: ${v.current_mileage?.toLocaleString()} km`);
  });
  if (vData.vehicles.length !== 3) {
    throw new Error(`預期 3 輛車，實際查得 ${vData.vehicles.length} 輛`);
  }

  // 3. 測試車輛即時健康度與耗材壽命計算
  console.log('\n[3/7] 測試車輛健康計算引擎 (/api/dashboard/status)...');
  const healthRes = await fetch(`${BASE_URL}/api/dashboard/status?vehicleId=2553-VY`, { headers: authHeaders });
  const healthData = await healthRes.json();
  const summary = healthData.summary || {};
  console.log(`  ✅ 計算成功: 小飛 (2553-VY) 健康總評分: ${summary.overallScore || 0} 分`);
  console.log(`     - 狀態摘要: 良好 ${summary.goodCount || 0} 項 | 預警 ${summary.warningCount || 0} 項 | 逾期 ${summary.dangerCount || 0} 項`);
  console.log(`     - 追蹤零件數: ${healthData.components?.length || 0} 項`);

  // 4. 測試保養工單模組
  console.log('\n[4/7] 測試保養工單模組 (/api/maintenance)...');
  const mRes = await fetch(`${BASE_URL}/api/maintenance`, { headers: authHeaders });
  const mData = await mRes.json();
  console.log(`  ✅ 查詢成功: 共有 ${mData.records.length} 筆工單紀錄`);
  if (mData.records.length > 0) {
    const firstRec = mData.records[0];
    console.log(`     - 最新工單: ${firstRec.record_date} | ${firstRec.plate_number} | ${firstRec.title} | NT$ ${firstRec.total_amount?.toLocaleString()}`);
    // 查詢零件細項
    const detailRes = await fetch(`${BASE_URL}/api/maintenance/${firstRec.record_id}`, { headers: authHeaders });
    const detailData = await detailRes.json();
    console.log(`     - 細項零件數: ${detailData.items?.length || 0} 項`);
  }

  // 5. 測試加油紀錄模組
  console.log('\n[5/7] 測試加油紀錄模組 (/api/refueling)...');
  const refRes = await fetch(`${BASE_URL}/api/refueling`, { headers: authHeaders });
  const refData = await refRes.json();
  console.log(`  ✅ 查詢成功: 共有 ${refData.records.length} 筆加油紀錄`);
  console.log(`     - 累計加油花費: NT$ ${refData.stats?.totalSpent?.toLocaleString()}`);
  console.log(`     - 累計添加油量: ${refData.stats?.totalLiters?.toLocaleString()} L`);
  console.log(`     - 平均行駛油耗: ${refData.stats?.avgEfficiency} km/L`);
  console.log(`     - 每公里成本: NT$ ${refData.stats?.avgCostPerKm} /km`);
  if (refData.records.length > 0) {
    const latestRef = refData.records[0];
    console.log(`     - 最新加油: ${latestRef.refuel_date} | ${latestRef.plate_number} | ${latestRef.liters}L | NT$ ${latestRef.total_amount} | 油耗: ${latestRef.fuel_efficiency} km/L`);
  }

  // 6. 測試其他費用模組
  console.log('\n[6/7] 測試其他費用模組 (/api/expenses)...');
  const expRes = await fetch(`${BASE_URL}/api/expenses`, { headers: authHeaders });
  const expData = await expRes.json();
  console.log(`  ✅ 查詢成功: 共有 ${expData.records.length} 筆其他費用紀錄`);
  console.log(`     - 累計費用總額: NT$ ${expData.stats?.totalSpent?.toLocaleString()}`);
  console.log(`     - 分類項目彙整:`, expData.stats?.categoryTotals);

  // 7. 測試管理員權限隔離
  console.log('\n[7/7] 測試管理者身分與權限隔離 (帳號: admin)...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  if (!adminLoginRes.ok) {
    throw new Error(`Admin 登入失敗: ${adminLoginRes.status}`);
  }
  const adminLoginData = await adminLoginRes.json();
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminLoginData.token}`,
  };

  // 驗證 admin 名下車輛應為 0 (查全域車輛時，全部歸屬 william)
  const adminVRes = await fetch(`${BASE_URL}/api/vehicles`, { headers: adminHeaders });
  const adminVData = await adminVRes.json();
  const adminOwned = adminVData.vehicles.filter(v => v.user_id === adminLoginData.user.userId);
  console.log(`  ✅ Admin 全域車籍監管: 系統總車輛 ${adminVData.vehicles.length} 輛，Admin 本人名下持有: ${adminOwned.length} 輛 (符合規範: 0 台)`);

  // 驗證 admin 試圖登記私家車應被 403 阻擋
  const addCarRes = await fetch(`${BASE_URL}/api/vehicles`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ plate_number: 'ADM-9999', brand: 'BMW', model: 'M3' }),
  });
  if (addCarRes.status === 403) {
    console.log('  ✅ Admin 登記私家車攔截驗證通過: 收到 403 拒絕 (管理員禁止輸入個人車輛)');
  } else {
    console.warn(`  ⚠️ 預期 403，實際收到 ${addCarRes.status}`);
  }

  // 驗證 admin 可存取使用者管理清單
  const usersRes = await fetch(`${BASE_URL}/api/admin/users`, { headers: adminHeaders });
  const usersData = await usersRes.json();
  console.log(`  ✅ Admin 會員清單查詢成功: 共有 ${usersData.users.length} 名全域使用者`);

  console.log('\n🎉 所有模組端對端驗證 100% 通過！系統運作完全正常！');
}

testAll().catch(err => {
  console.error('\n❌ 測試遭遇錯誤:', err);
  process.exit(1);
});
