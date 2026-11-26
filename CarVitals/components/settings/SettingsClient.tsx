'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Settings,
  Palette,
  Globe,
  Gauge,
  Bell,
  Compass,
  Layers,
  Save,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Laptop,
  Sparkles,
} from 'lucide-react';

interface Preferences {
  theme: string;
  accentColor: string;
  locale: string;
  distanceUnit: string;
  volumeUnit: string;
  fuelEconomyUnit: string;
  currency: string;
  defaultLanding: string;
  alertMileageThreshold: number;
  alertDaysThreshold: number;
  modules: {
    notifications?: {
      maintenanceAlerts?: boolean;
      fuelLogsReminder?: boolean;
      monthlyDigest?: boolean;
    };
    [key: string]: any;
  };
}

const ACCENT_COLORS = [
  { id: 'blue', label: '經典科技藍', color: '#3b82f6', bgClass: 'bg-blue-500' },
  { id: 'emerald', label: '翡翠能源綠', color: '#10b981', bgClass: 'bg-emerald-500' },
  { id: 'violet', label: '尊爵極光紫', color: '#8b5cf6', bgClass: 'bg-purple-500' },
  { id: 'amber', label: '跑車琥珀金', color: '#f59e0b', bgClass: 'bg-amber-500' },
  { id: 'rose', label: '競技烈焰紅', color: '#f43f5e', bgClass: 'bg-rose-500' },
  { id: 'cyan', label: '未來蔚青藍', color: '#06b6d4', bgClass: 'bg-cyan-500' },
];

export default function SettingsClient({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [prefs, setPrefs] = useState<Preferences>({
    theme: 'dark',
    accentColor: 'blue',
    locale: currentLocale || 'zh-TW',
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
        monthlyDigest: true,
      },
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 讀取當前使用者偏好
  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPrefs((prev) => ({
            ...prev,
            ...data.preferences,
            modules: {
              ...prev.modules,
              ...(data.preferences.modules || {}),
            },
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  // 切換主題 (連動 next-themes)
  const handleThemeChange = (newTheme: string) => {
    setPrefs((prev) => ({ ...prev, theme: newTheme }));
    setTheme(newTheme);
  };

  // 儲存偏好
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '儲存失敗');
      }

      setSuccessMsg('個人環境偏好設定已成功更新並永久生效！');

      // 若語言變更，跳轉至對應 locale 路由
      if (prefs.locale !== currentLocale) {
        setTimeout(() => {
          router.push(`/${prefs.locale}/settings`);
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>正在載入個人偏好設定...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* 頁面標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="h-7 w-7 text-primary" />
            個人環境偏好與模組參數設定
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            自由自訂您的色彩主題、多語系、度量衡計量單位及後續陸續擴充之功能模組參數
          </p>
        </div>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* 1. 外觀與視覺色系 */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">外觀與色彩主題 (Appearance & Theme)</h2>
          </div>

          {/* 主題模式 */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              顯示模式
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark', label: '深色模式 (暗黑)', icon: Moon },
                { id: 'light', label: '淺色模式 (明亮)', icon: Sun },
                { id: 'system', label: '跟隨系統偏好', icon: Laptop },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = prefs.theme === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleThemeChange(m.id)}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all font-medium text-xs sm:text-sm ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 系統強調色系 */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              風格強調色 (Accent Palette)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {ACCENT_COLORS.map((c) => {
                const isSelected = prefs.accentColor === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPrefs((prev) => ({ ...prev, accentColor: c.id }))}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-xs font-semibold ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full ${c.bgClass} shadow-sm shrink-0`} />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. 語言環境與地區 */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">語言與國際化 (Language & Locale)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'zh-TW', name: '繁體中文 (台灣)', note: '預設推薦語言，專為繁體中文車主打造' },
              { id: 'en', name: 'English (US)', note: 'International English Interface' },
            ].map((lang) => {
              const isSelected = prefs.locale === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setPrefs((prev) => ({ ...prev, locale: lang.id }))}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">{lang.name}</span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{lang.note}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. 度量衡與單位自訂 */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Gauge className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">度量衡與計量單位 (Units & Measurement)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                行駛里程單位
              </label>
              <select
                value={prefs.distanceUnit}
                onChange={(e) => setPrefs((prev) => ({ ...prev, distanceUnit: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
              >
                <option value="km">公里 (km - 公制)</option>
                <option value="mi">英里 (mi - 英制)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                燃油容積單位
              </label>
              <select
                value={prefs.volumeUnit}
                onChange={(e) => setPrefs((prev) => ({ ...prev, volumeUnit: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
              >
                <option value="L">公升 (L)</option>
                <option value="gal">加侖 (Gallon)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                油耗計算格式
              </label>
              <select
                value={prefs.fuelEconomyUnit}
                onChange={(e) => setPrefs((prev) => ({ ...prev, fuelEconomyUnit: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
              >
                <option value="km/L">km/L (每公升公里數)</option>
                <option value="L/100km">L/100km (百公里耗油量)</option>
                <option value="mpg">MPG (每加侖英里數)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                幣別顯示符號
              </label>
              <select
                value={prefs.currency}
                onChange={(e) => setPrefs((prev) => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
              >
                <option value="TWD">新台幣 (NT$)</option>
                <option value="USD">美元 ($)</option>
                <option value="EUR">歐元 (€)</option>
                <option value="JPY">日圓 (¥)</option>
              </select>
            </div>
          </div>
        </section>

        {/* 4. 保養預警閥值設定 */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">零件保養預警閥值 (Maintenance Alerts)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                里程提前預警量 (即將到期提醒)
              </label>
              <select
                value={prefs.alertMileageThreshold}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, alertMileageThreshold: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
              >
                <option value={500}>距離到期前 500 km 發出預警</option>
                <option value={1000}>距離到期前 1,000 km 發出預警 (推薦)</option>
                <option value={1500}>距離到期前 1,500 km 發出預警</option>
                <option value={2000}>距離到期前 2,000 km 發出預警</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                當零件剩餘行駛壽命低於此數值時，儀表板將標示為黃色「即將到期」提醒。
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                天數提前預警量 (時間週期提醒)
              </label>
              <select
                value={prefs.alertDaysThreshold}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, alertDaysThreshold: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
              >
                <option value={14}>距離保養期 14 天前預警</option>
                <option value={30}>距離保養期 30 天前預警 (推薦)</option>
                <option value={45}>距離保養期 45 天前預警</option>
                <option value={60}>距離保養期 60 天前預警</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                當零件更換間隔天數逼近有效週期時發出時間預警。
              </p>
            </div>
          </div>
        </section>

        {/* 5. 系統導航與首頁自訂 */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <Compass className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">預設首頁導向 (Landing Preference)</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              每次登入後預設進入之功能首頁
            </label>
            <select
              value={prefs.defaultLanding}
              onChange={(e) => setPrefs((prev) => ({ ...prev, defaultLanding: e.target.value }))}
              className="w-full sm:w-80 px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
            >
              <option value="/dashboard">儀表板 (健康監控與統計總覽)</option>
              <option value="/vehicles">車輛管理 (名下愛車清單)</option>
              <option value="/maintenance">維修保養 (保養工單與零件細項)</option>
              <option value="/refueling">加油紀錄 (油耗與花費分析)</option>
              <option value="/expenses">其他費用 (稅金、保險與雜項)</option>
            </select>
          </div>
        </section>

        {/* 6. 後續陸續擴充功能模組之動態配置 (Modular Architecture) */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">功能模組擴充參數 (Extensible Modules)</h2>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3 w-3" />
              動態擴充架構就緒
            </span>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
              <div>
                <div className="text-sm font-bold text-foreground">零件更換與保養即時預警通知</div>
                <div className="text-xs text-muted-foreground">在儀表板與狀態條即時標註需關注之耗材</div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.modules?.notifications?.maintenanceAlerts}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    modules: {
                      ...prev.modules,
                      notifications: {
                        ...prev.modules?.notifications,
                        maintenanceAlerts: e.target.checked,
                      },
                    },
                  }))
                }
                className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
              <div>
                <div className="text-sm font-bold text-foreground">定期加油與油耗異常監控提醒</div>
                <div className="text-xs text-muted-foreground">
                  當油耗大幅偏離平均水準時提供經濟駕駛建議
                </div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.modules?.notifications?.fuelLogsReminder}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    modules: {
                      ...prev.modules,
                      notifications: {
                        ...prev.modules?.notifications,
                        fuelLogsReminder: e.target.checked,
                      },
                    },
                  }))
                }
                className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
              <div>
                <div className="text-sm font-bold text-foreground">月度車輛養護總支出分析報表</div>
                <div className="text-xs text-muted-foreground">自動彙整當月保養、加油與稅險花費總額</div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.modules?.notifications?.monthlyDigest}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    modules: {
                      ...prev.modules,
                      notifications: {
                        ...prev.modules?.notifications,
                        monthlyDigest: e.target.checked,
                      },
                    },
                  }))
                }
                className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
              />
            </label>
          </div>
        </section>
      </div>

      {/* 底部儲存列 */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl border border-border font-semibold text-sm hover:bg-muted"
        >
          取消返回
        </button>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? '儲存中...' : '儲存所有偏好設定'}
        </button>
      </div>
    </div>
  );
}

