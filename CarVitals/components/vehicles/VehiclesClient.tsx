'use client';

import { useState, useEffect } from 'react';
import { Car, Plus, X, Gauge, Fuel, AlertCircle, ShieldAlert, UserCheck } from 'lucide-react';

export default function VehiclesClient({ locale }: { locale: string }) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 表單欄位
  const [plateNumber, setPlateNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [fuelType, setFuelType] = useState('95無鉛汽油');

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
        setIsAdmin(!!data.isAdmin);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate_number: plateNumber,
          nickname,
          brand,
          model,
          current_mileage: currentMileage ? Number(currentMileage) : 0,
          fuel_type: fuelType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '新增失敗');

      setPlateNumber('');
      setNickname('');
      setBrand('');
      setModel('');
      setCurrentMileage('');
      setShowModal(false);
      fetchVehicles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">車籍資料管理</h1>
            {isAdmin && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-xs font-bold border border-purple-500/20">
                管理者唯讀監控
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? '系統管理員模式：檢視全系統各車主名下之車輛檔案，管理員不可在此登記私人車輛'
              : '管理您所屬的所有車輛檔案與行駛里程'}
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer w-fit"
          >
            <Plus className="h-4 w-4" />
            登記新車輛
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 flex items-center gap-3 text-sm font-medium">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>
            管理者提示：系統管理員（admin）專門負責系統權限維運與數據監管，不持有私人車輛。如需登記車輛與保養維修，請登入車主帳號（例如: william）。
          </span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">載入車輛資料中...</div>
      ) : vehicles.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-3">
          <Car className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <h3 className="text-lg font-bold text-foreground">目前尚無車輛資料</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? '系統內尚無登記車輛' : '立即新增第一台車輛，開始記錄保養工單與油耗！'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehicles.map((v) => (
            <div
              key={v.vehicle_id}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                      <Car className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-foreground">{v.nickname || v.plate_number}</h3>
                      <p className="text-xs text-muted-foreground">{v.brand} {v.model}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-muted text-foreground font-bold">
                    {v.plate_number}
                  </span>
                </div>

                {isAdmin && v.owner_username && (
                  <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    車主帳號: <span className="font-bold">{v.owner_username}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Gauge className="h-3 w-3" /> 目前里程
                    </span>
                    <p className="text-base font-extrabold font-mono text-foreground">
                      {Number(v.current_mileage || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{v.mileage_unit || 'km'}</span>
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Fuel className="h-3 w-3" /> 燃油種類
                    </span>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {v.fuel_type || '無鉛汽油'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">
                  建檔日期: {v.created_at ? v.created_at.split(' ')[0] : '-'}
                </span>
                <span className="text-primary font-bold hover:underline cursor-pointer">
                  維護細節 ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && !isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-foreground">登記新車輛</h3>
                <p className="text-xs text-muted-foreground mt-0.5">建立專屬車籍，該車輛數據僅由您本人存取</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    車牌號碼 *
                  </label>
                  <input
                    type="text"
                    required
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="例如: ABC-1234"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono uppercase focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    車輛暱稱
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="例如: 小銀 / 上班代步車"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    廠牌品牌
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="例如: Toyota / Honda"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    車型型號
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="例如: RAV4 / Civic"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    目前里程 (公里)
                  </label>
                  <input
                    type="number"
                    value={currentMileage}
                    onChange={(e) => setCurrentMileage(e.target.value)}
                    placeholder="例如: 45000"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    燃油類別
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="95無鉛汽油">95無鉛汽油</option>
                    <option value="98無鉛汽油">98無鉛汽油</option>
                    <option value="92無鉛汽油">92無鉛汽油</option>
                    <option value="柴油">柴油</option>
                    <option value="油電混合">油電混合</option>
                    <option value="純電">純電</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? '儲存中...' : '確認登記車輛'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
