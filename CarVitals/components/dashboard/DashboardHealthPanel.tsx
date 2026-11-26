'use client';

import { useState, useEffect } from 'react';
import { Car, Wrench, AlertTriangle, CheckCircle, ShieldAlert, Clock, Gauge, ArrowRight } from 'lucide-react';
import type { ComponentHealth } from '@/lib/health';

export default function DashboardHealthPanel({
  locale,
}: {
  locale: string;
}) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [components, setComponents] = useState<ComponentHealth[]>([]);
  const [summary, setSummary] = useState({
    dangerCount: 0,
    warningCount: 0,
    goodCount: 0,
    overallScore: 100,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'alert' | 'good'>('all');

  const fetchHealthData = async (vId?: string) => {
    try {
      setLoading(true);
      const url = vId ? `/api/dashboard/status?vehicleId=${vId}` : '/api/dashboard/status';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
        if (data.selectedVehicle) {
          setSelectedVehicleId(data.selectedVehicle.vehicle_id);
        }
        setComponents(data.components || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleSelectVehicle = (vId: string) => {
    setSelectedVehicleId(vId);
    fetchHealthData(vId);
  };

  const selectedVehicle = vehicles.find(v => v.vehicle_id === selectedVehicleId) || vehicles[0];

  const filteredComponents = components.filter(c => {
    if (filter === 'alert') return c.status === 'danger' || c.status === 'warning';
    if (filter === 'good') return c.status === 'good';
    return true;
  });

  if (loading && vehicles.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">正在計算各車輛零件即時壽命與健康狀態...</div>;
  }

  if (vehicles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 1. 愛車切換分頁 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {vehicles.map((v) => {
          const isSelected = v.vehicle_id === selectedVehicleId;
          return (
            <button
              key={v.vehicle_id}
              onClick={() => handleSelectVehicle(v.vehicle_id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Car className="h-4 w-4" />
              <span>{v.nickname || v.plate_number}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {v.plate_number}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. 車輛即時健康狀態摘要看板 */}
      {selectedVehicle && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 健康總分 */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">零件綜合健康度</span>
            <div className="flex items-baseline gap-2 my-2">
              <span className={`text-4xl font-black ${
                summary.overallScore >= 80 ? 'text-emerald-500' : summary.overallScore >= 60 ? 'text-amber-500' : 'text-destructive'
              }`}>
                {summary.overallScore}
              </span>
              <span className="text-sm font-bold text-muted-foreground">/ 100 分</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {summary.overallScore >= 80 ? (
                <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> 運轉狀態良好</span>
              ) : summary.overallScore >= 60 ? (
                <span className="text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> 需留意預警保養</span>
              ) : (
                <span className="text-destructive flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> 存在已逾期項目</span>
              )}
            </div>
          </div>

          {/* 目前累積行駛里程 */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">目前累計里程</span>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-foreground">
                {Number(selectedVehicle.current_mileage || 0).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">{selectedVehicle.mileage_unit || 'km'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">作為零件消耗計算基準</p>
          </div>

          {/* 警示零件統計 */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">即將到期 / 已逾期</span>
            <div className="flex items-center gap-3 my-2">
              <div className="flex items-center gap-1">
                <span className="text-3xl font-black text-destructive">{summary.dangerCount}</span>
                <span className="text-xs text-muted-foreground">逾期</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-1">
                <span className="text-3xl font-black text-amber-500">{summary.warningCount}</span>
                <span className="text-xs text-muted-foreground">預警</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">建議安排進廠更換檢查</p>
          </div>

          {/* 正常零件統計 */}
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">狀況良好耗材</span>
            <div className="my-2">
              <span className="text-3xl font-black text-emerald-500">{summary.goodCount}</span>
              <span className="text-xs text-muted-foreground ml-1.5">項耗材</span>
            </div>
            <p className="text-[11px] text-muted-foreground">正常壽命額度內行駛</p>
          </div>
        </div>
      )}

      {/* 3. 各零件即時消耗進度條面板 */}
      <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              愛車關鍵零件壽命即時監控
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              依據您歷次維修工單之更換時間、更換里程與目前行駛里程雙維度即時計算
            </p>
          </div>

          {/* 快速篩選按鈕 */}
          <div className="flex rounded-xl bg-muted p-1 text-xs font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              全部 ({components.length})
            </button>
            <button
              onClick={() => setFilter('alert')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === 'alert' ? 'bg-card text-amber-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              需注意 ({summary.dangerCount + summary.warningCount})
            </button>
            <button
              onClick={() => setFilter('good')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === 'good' ? 'bg-card text-emerald-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              良好 ({summary.goodCount})
            </button>
          </div>
        </div>

        {filteredComponents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {components.length === 0
              ? '此車輛尚無零件維修細項紀錄，建立維修保養工單後將自動在此啟動即時壽命追蹤！'
              : '此篩選分類下查無耗材項目。'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredComponents.map((c, idx) => {
              const isDanger = c.status === 'danger';
              const isWarning = c.status === 'warning';

              return (
                <div key={idx} className="p-5 sm:p-6 hover:bg-muted/20 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        isDanger ? 'bg-destructive/10 text-destructive' : isWarning ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-base font-extrabold text-foreground">{c.itemName}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {c.lastReplacedDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> 上次更換: {c.lastReplacedDate.split(' ')[0]}
                            </span>
                          )}
                          {c.lastReplacedMileage > 0 && (
                            <span className="flex items-center gap-1 font-mono">
                              <Gauge className="h-3 w-3" /> @ {c.lastReplacedMileage.toLocaleString()} km
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          isDanger
                            ? 'bg-destructive/10 text-destructive border border-destructive/20'
                            : isWarning
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {c.statusText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 壽命消耗進度條 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-muted-foreground">
                      <span>已消耗: <strong className="text-foreground">{c.percentageUsed}%</strong></span>
                      <span className="font-mono">
                        {c.remainingKm !== null && (
                          c.remainingKm <= 0
                            ? <span className="text-destructive font-bold">已逾期 {Math.abs(c.remainingKm).toLocaleString()} km</span>
                            : <span>剩餘 {c.remainingKm.toLocaleString()} km</span>
                        )}
                        {c.remainingDays !== null && (
                          <span className="ml-2">
                            {c.remainingDays <= 0
                              ? <span className="text-destructive font-bold">已逾期 {Math.abs(c.remainingDays)} 天</span>
                              : <span>/ 剩餘 {c.remainingDays} 天</span>}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isDanger ? 'bg-destructive' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, c.percentageUsed))}%` }}
                      />
                    </div>
                  </div>

                  {/* 建議處置提示 */}
                  {(isDanger || isWarning) && (
                    <p className={`text-xs font-semibold flex items-center gap-1.5 ${
                      isDanger ? 'text-destructive' : 'text-amber-500'
                    }`}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {c.suggestedAction}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

