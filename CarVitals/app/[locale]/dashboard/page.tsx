import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Car, Wrench, Fuel, AlertTriangle, CheckCircle, PlusCircle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const user = await getCurrentUser();

  // 若未登入，重定向至登入頁面
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const db = getDb();
  const isAdmin = user.role === 'admin';

  let vehicleCount = 0;
  let maintenanceCount = 0;
  let refuelingCount = 0;
  let vehicles: any[] = [];
  let errorMsg = '';

  try {
    if (isAdmin) {
      // 管理者視角：可檢視系統全域數據
      const vRes = await db.execute('SELECT COUNT(*) as count FROM vehicles');
      vehicleCount = Number(vRes.rows[0].count);

      const mRes = await db.execute('SELECT COUNT(*) as count FROM maintenance_records');
      maintenanceCount = Number(mRes.rows[0].count);

      const rRes = await db.execute('SELECT COUNT(*) as count FROM refueling_records');
      refuelingCount = Number(rRes.rows[0].count);

      const vehiclesRes = await db.execute(`
        SELECT v.vehicle_id, v.plate_number, v.nickname, v.brand, v.model, v.current_mileage, v.mileage_unit, u.username as owner_name
        FROM vehicles v
        LEFT JOIN users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
      `);
      vehicles = vehiclesRes.rows;
    } else {
      // 一般會員視角：嚴格隔離，僅能存取該用戶名下車輛及費用
      const vRes = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM vehicles WHERE user_id = ?',
        args: [user.userId]
      });
      vehicleCount = Number(vRes.rows[0].count);

      const mRes = await db.execute({
        sql: `
          SELECT COUNT(*) as count FROM maintenance_records
          WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)
        `,
        args: [user.userId]
      });
      maintenanceCount = Number(mRes.rows[0].count);

      const rRes = await db.execute({
        sql: `
          SELECT COUNT(*) as count FROM refueling_records
          WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)
        `,
        args: [user.userId]
      });
      refuelingCount = Number(rRes.rows[0].count);

      const vehiclesRes = await db.execute({
        sql: `
          SELECT vehicle_id, plate_number, nickname, brand, model, current_mileage, mileage_unit
          FROM vehicles
          WHERE user_id = ?
          ORDER BY created_at DESC
        `,
        args: [user.userId]
      });
      vehicles = vehiclesRes.rows;
    }
  } catch (err: any) {
    console.error('Turso DB 查詢錯誤:', err);
    errorMsg = err.message;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* 頁面標題與使用者歡迎 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('title')}</h1>
            {isAdmin && (
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                系統管理者總覽
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            你好，<span className="font-semibold text-foreground">{user.username}</span>！歡迎使用 CarVitals 個人車輛管理中心。
          </p>
        </div>

        <Link
          href={`/${locale}/vehicles`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer w-fit"
        >
          <PlusCircle className="h-4 w-4" />
          新增管理車輛
        </Link>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>資料庫連線警告：{errorMsg}</span>
        </div>
      )}

      {/* 統計指標卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isAdmin ? '系統車輛總數' : '名下車輛總數'}
            </p>
            <p className="text-3xl font-black text-foreground">{vehicleCount}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? '全系統已建檔管理的車輛' : '您目前登記管理的愛車數量'}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Car className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">維修保養工單</p>
            <p className="text-3xl font-black text-foreground">{maintenanceCount}</p>
            <p className="text-xs text-muted-foreground">累計歷史保養工單筆數</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Wrench className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">加油紀錄筆數</p>
            <p className="text-3xl font-black text-foreground">{refuelingCount}</p>
            <p className="text-xs text-muted-foreground">油耗與花費追蹤歷程</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Fuel className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 車輛概覽清單 */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {isAdmin ? '全系統車輛即時監控列表' : '我的車輛健康狀態'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? '顯示所有車主之車輛' : '僅顯示您名下的車籍資料與行駛里程'}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> 雲端即時同步
          </span>
        </div>

        {vehicles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Car className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-base font-semibold text-foreground">目前尚無車輛資料</p>
            <p className="text-sm text-muted-foreground">點擊上方按鈕建立您的第一台愛車，開始記錄保養與油耗！</p>
            <Link
              href={`/${locale}/vehicles`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md cursor-pointer mt-2"
            >
              <PlusCircle className="h-4 w-4" />
              立即新增車輛
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {vehicles.map((v) => (
              <div key={v.vehicle_id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    <Car className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">{v.nickname || v.plate_number}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{v.plate_number}</span>
                      {isAdmin && v.owner_name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          車主: {v.owner_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.brand} {v.model}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">目前行駛里程</p>
                    <p className="text-base font-black font-mono text-foreground">
                      {Number(v.current_mileage || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{v.mileage_unit || 'km'}</span>
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/vehicles/${v.vehicle_id}`}
                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-bold text-foreground transition-all"
                  >
                    車籍細節
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
