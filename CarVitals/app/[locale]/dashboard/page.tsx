import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Car, Wrench, Fuel, AlertTriangle, CheckCircle, PlusCircle, Shield, ArrowRight } from 'lucide-react';
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
      // 系統管理者視角：全域維運監控
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
      // 一般車主視角 (例如: william)：個人車籍與健康管理
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
      {/* 頁面標題與角色身份 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isAdmin ? '系統維運與全域監控儀表板' : t('title')}
            </h1>
            {isAdmin ? (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-xs font-bold border border-purple-500/20">
                系統管理者專屬視角
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold border border-blue-500/20">
                車主個人中心
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            你好，<span className="font-semibold text-foreground">{user.username}</span>！
            {isAdmin
              ? ' 系統管理員僅負責全域維運、權限指派與數據審核，不登記個人車輛。'
              : ' 歡迎管理您的愛車資訊、保養歷程與油耗追蹤。'}
          </p>
        </div>

        {isAdmin ? (
          <Link
            href={`/${locale}/admin`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer w-fit"
          >
            <Shield className="h-4 w-4" />
            進入使用者與後台管理
          </Link>
        ) : (
          <Link
            href={`/${locale}/vehicles`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer w-fit"
          >
            <PlusCircle className="h-4 w-4" />
            新增管理車輛
          </Link>
        )}
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
              {isAdmin ? '全系統已建檔管理的活躍車輛' : '您目前登記管理的愛車數量'}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Car className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isAdmin ? '全系統維修工單' : '保養維修工單'}
            </p>
            <p className="text-3xl font-black text-foreground">{maintenanceCount}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? '全系統車主累計保養紀錄' : '您的車輛歷史保養工單總數'}
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Wrench className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isAdmin ? '全系統加油筆數' : '加油歷程筆數'}
            </p>
            <p className="text-3xl font-black text-foreground">{refuelingCount}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? '全系統車主累計加油追蹤' : '您的愛車完整油耗追蹤歷程'}
            </p>
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
              {isAdmin ? '全系統跨車主車輛清單' : '我的車輛健康即時狀態'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? '管理者唯讀監控檢視模式' : '僅顯示您所屬的車籍與最新里程'}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Turso 雲端即時同步
          </span>
        </div>

        {vehicles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Car className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-base font-semibold text-foreground">目前尚無車輛資料</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? '全系統尚無任何車主登記車輛' : '立即登記您的第一台愛車，開始記錄保養與油耗！'}
            </p>
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-bold border border-purple-500/20">
                          所屬車主: {v.owner_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.brand} {v.model}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">目前累積里程</p>
                    <p className="text-base font-black font-mono text-foreground">
                      {Number(v.current_mileage || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{v.mileage_unit || 'km'}</span>
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/vehicles`}
                    className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center gap-1"
                  >
                    查看車籍 <ArrowRight className="h-3.5 w-3.5" />
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
