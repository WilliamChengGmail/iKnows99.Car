import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Car, Wrench, Fuel, Receipt, AlertTriangle, Shield, PlusCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import DashboardHealthPanel from '@/components/dashboard/DashboardHealthPanel';

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
  let expenseCount = 0;
  let errorMsg = '';

  try {
    if (isAdmin) {
      const vRes = await db.execute('SELECT COUNT(*) as count FROM vehicles');
      vehicleCount = Number(vRes.rows[0].count);

      const mRes = await db.execute('SELECT COUNT(*) as count FROM maintenance_records');
      maintenanceCount = Number(mRes.rows[0].count);

      const rRes = await db.execute('SELECT COUNT(*) as count FROM refueling_records');
      refuelingCount = Number(rRes.rows[0].count);

      const eRes = await db.execute('SELECT COUNT(*) as count FROM other_expense_records');
      expenseCount = Number(eRes.rows[0].count);
    } else {
      const vRes = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM vehicles WHERE user_id = ?',
        args: [user.userId]
      });
      vehicleCount = Number(vRes.rows[0].count);

      const mRes = await db.execute({
        sql: `SELECT COUNT(*) as count FROM maintenance_records WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)`,
        args: [user.userId]
      });
      maintenanceCount = Number(mRes.rows[0].count);

      const rRes = await db.execute({
        sql: `SELECT COUNT(*) as count FROM refueling_records WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)`,
        args: [user.userId]
      });
      refuelingCount = Number(rRes.rows[0].count);

      const eRes = await db.execute({
        sql: `SELECT COUNT(*) as count FROM other_expense_records WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE user_id = ?)`,
        args: [user.userId]
      });
      expenseCount = Number(eRes.rows[0].count);
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
              : ' 歡迎管理您的愛車資訊、零件即時壽命與保養履歷。'}
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
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/${locale}/refueling`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all"
            >
              <Fuel className="h-4 w-4 text-amber-500" />
              加油油耗
            </Link>
            <Link
              href={`/${locale}/expenses`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all"
            >
              <Receipt className="h-4 w-4 text-emerald-500" />
              其他費用
            </Link>
            <Link
              href={`/${locale}/maintenance`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all"
            >
              <Wrench className="h-4 w-4 text-blue-500" />
              保養工單
            </Link>
            <Link
              href={`/${locale}/vehicles`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              管理車籍
            </Link>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>資料庫連線警告：{errorMsg}</span>
        </div>
      )}

      {/* 4 大統計指標卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/${locale}/vehicles`}
          className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between hover:border-primary/50 transition-all group"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isAdmin ? '系統車輛' : '名下愛車'}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
              {vehicleCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isAdmin ? '全域活躍車輛' : '登記管理愛車'}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Car className="h-5 w-5" />
          </div>
        </Link>

        <Link
          href={`/${locale}/maintenance`}
          className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between hover:border-primary/50 transition-all group"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              保養工單
            </p>
            <p className="text-2xl sm:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
              {maintenanceCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isAdmin ? '全域保養紀錄' : '完整保養歷程'}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
        </Link>

        <Link
          href={`/${locale}/refueling`}
          className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between hover:border-primary/50 transition-all group"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              加油歷程
            </p>
            <p className="text-2xl sm:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
              {refuelingCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isAdmin ? '全域加油追蹤' : '油耗與花費分析'}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Fuel className="h-5 w-5" />
          </div>
        </Link>

        <Link
          href={`/${locale}/expenses`}
          className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between hover:border-primary/50 transition-all group"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              其他費用
            </p>
            <p className="text-2xl sm:text-3xl font-black text-foreground group-hover:text-primary transition-colors">
              {expenseCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isAdmin ? '全域費用雜項' : '稅金/保險/停車等'}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
        </Link>
      </div>

      {/* 車輛零件即時壽命面板 (核心即時健康監控) */}
      <DashboardHealthPanel locale={locale} />
    </div>
  );
}
