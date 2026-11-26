// lib/health.ts
// 車輛零件健康狀態與壽命演算法計算引擎
// 支援雙維度：日期壽命（天/月/年）與里程壽命（公里）

export interface ComponentHealth {
  itemName: string;
  category?: string;
  lastReplacedDate: string;
  lastReplacedMileage: number;
  currentMileage: number;
  lifespanDays: number | null;
  lifespanMileage: number | null;
  remainingKm: number | null;
  remainingDays: number | null;
  percentageUsed: number; // 0 ~ 100+
  status: 'good' | 'warning' | 'danger';
  statusText: string;
  suggestedAction: string;
}

export interface VehicleHealthSummary {
  vehicleId: string;
  plateNumber: string;
  nickname: string;
  currentMileage: number;
  overallHealthScore: number; // 0 ~ 100
  overallStatus: 'good' | 'warning' | 'danger';
  dangerCount: number;
  warningCount: number;
  goodCount: number;
  components: ComponentHealth[];
}

/** 將「6個月」、「1年」等壽命文字轉為天數 */
export function parseLifespanDays(lifespanDateStr: string | null | undefined): number | null {
  if (!lifespanDateStr) return null;
  const str = String(lifespanDateStr).trim();
  if (!str || str === '0') return null;

  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  if (isNaN(num) || num <= 0) return null;

  if (str.includes('年')) {
    return num * 365;
  } else if (str.includes('月')) {
    return num * 30;
  } else if (str.includes('天') || str.includes('日')) {
    return num;
  } else {
    // 若純數字，大於 60 視為天數，小於等於 24 視為月數
    return num > 60 ? num : num * 30;
  }
}

/** 計算各零件健康狀態 */
export function calculateComponentHealth(params: {
  itemName: string;
  lastDateStr: string;
  lastMileage: number;
  currentMileage: number;
  lifespanDaysInput?: string | number | null;
  lifespanMileageInput?: number | null;
}): ComponentHealth {
  const { itemName, lastDateStr, lastMileage, currentMileage } = params;

  // 1. 里程壽命
  let lifespanKm = params.lifespanMileageInput && params.lifespanMileageInput > 0
    ? params.lifespanMileageInput
    : null;

  // 2. 日期天數壽命
  let lifespanDays = typeof params.lifespanDaysInput === 'number'
    ? params.lifespanDaysInput
    : parseLifespanDays(params.lifespanDaysInput);

  // 若資料庫內無設定，針對常見常規零件提供推薦基準壽命
  if (!lifespanKm && !lifespanDays) {
    const lower = itemName.toLowerCase();
    if (lower.includes('機油芯') || lower.includes('機油濾')) {
      lifespanKm = 5000;
      lifespanDays = 365;
    } else if (lower.includes('機油')) {
      lifespanKm = 5000;
      lifespanDays = 180;
    } else if (lower.includes('變速箱') || lower.includes('齒輪油')) {
      lifespanKm = 20000;
      lifespanDays = 730;
    } else if (lower.includes('煞車') || lower.includes('來令片')) {
      lifespanKm = 40000;
      lifespanDays = 730;
    } else if (lower.includes('火星塞')) {
      lifespanKm = 60000;
    } else if (lower.includes('輪胎')) {
      lifespanKm = 40000;
      lifespanDays = 1095;
    } else if (lower.includes('電瓶') || lower.includes('電池')) {
      lifespanDays = 730;
    } else if (lower.includes('冷卻液') || lower.includes('水箱精')) {
      lifespanKm = 20000;
      lifespanDays = 365;
    }
  }

  // 計算已使用里程
  const kmUsed = Math.max(0, currentMileage - (lastMileage || 0));
  let remainingKm: number | null = null;
  let kmWearRatio = 0;

  if (lifespanKm && lifespanKm > 0) {
    remainingKm = lifespanKm - kmUsed;
    kmWearRatio = Math.min(2, kmUsed / lifespanKm);
  }

  // 計算已使用天數
  let remainingDays: number | null = null;
  let daysWearRatio = 0;

  if (lastDateStr) {
    const lastDate = new Date(lastDateStr.split(' ')[0]);
    const now = new Date();
    const diffTime = now.getTime() - lastDate.getTime();
    const daysPassed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    if (lifespanDays && lifespanDays > 0) {
      remainingDays = lifespanDays - daysPassed;
      daysWearRatio = Math.min(2, daysPassed / lifespanDays);
    }
  }

  // 決定主導的磨損比例（取里程或時間中磨損較高者）
  const maxRatio = Math.max(kmWearRatio, daysWearRatio);
  const percentageUsed = Math.min(100, Math.round(maxRatio * 100));

  let status: 'good' | 'warning' | 'danger' = 'good';
  let statusText = '狀態良好';
  let suggestedAction = '正常行駛，定期檢查';

  const isKmExpired = remainingKm !== null && remainingKm <= 0;
  const isDaysExpired = remainingDays !== null && remainingDays <= 0;
  const isKmWarning = remainingKm !== null && remainingKm <= 800;
  const isDaysWarning = remainingDays !== null && remainingDays <= 30;

  if (isKmExpired || isDaysExpired || percentageUsed >= 100) {
    status = 'danger';
    statusText = '已逾期';
    suggestedAction = isKmExpired && isDaysExpired
      ? '里程與時間皆已超標，建議儘速進廠更換！'
      : isKmExpired
      ? `行駛里程已逾期 ${Math.abs(remainingKm || 0).toLocaleString()} km，建議立即保養！`
      : `更換時間已逾期 ${Math.abs(remainingDays || 0)} 天，建議立即更換！`;
  } else if (isKmWarning || isDaysWarning || percentageUsed >= 80) {
    status = 'warning';
    statusText = '即將到期';
    suggestedAction = isKmWarning
      ? `剩餘行駛里程不足 ${remainingKm?.toLocaleString()} km，請預約保養`
      : `剩餘有效天數僅剩 ${remainingDays} 天，請留意更換時機`;
  }

  return {
    itemName,
    lastReplacedDate: lastDateStr,
    lastReplacedMileage: lastMileage,
    currentMileage,
    lifespanDays,
    lifespanMileage: lifespanKm,
    remainingKm,
    remainingDays,
    percentageUsed,
    status,
    statusText,
    suggestedAction,
  };
}

