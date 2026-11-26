'use client';

import { useState, useEffect } from 'react';
import { Fuel, Calendar, Gauge, DollarSign, Plus, X, Search, TrendingUp, Zap, ChevronRight, AlertCircle } from 'lucide-react';

interface Vehicle {
  vehicle_id: string;
  plate_number: string;
  nickname: string;
  current_mileage: number;
}

interface RefuelRecord {
  record_id: string;
  vehicle_id: string;
  plate_number: string;
  nickname: string;
  refuel_date: string;
  refuel_time: string;
  mileage: number;
  liters: number;
  unit_price: number;
  total_amount: number;
  fuel_type: string;
  payment_method: string;
  trip_distance: number;
  fuel_efficiency: number;
  cost_per_km: number;
  notes: string;
}

interface Stats {
  totalRecords: number;
  totalLiters: number;
  totalSpent: number;
  totalDistance: number;
  avgEfficiency: number;
  avgCostPerKm: number;
}

export default function RefuelingClient({ locale }: { locale: string }) {
  const [records, setRecords] = useState<RefuelRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 新增 Modal 狀態
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('12:00');
  const [newMileage, setNewMileage] = useState('');
  const [newLiters, setNewLiters] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newTotalAmount, setNewTotalAmount] = useState('');
  const [newFuelType, setNewFuelType] = useState('95無鉛');
  const [newPaymentMethod, setNewPaymentMethod] = useState('信用卡');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchRecords = async (vId = selectedVehicleId) => {
    try {
      setLoading(true);
      const url = vId ? `/api/refueling?vehicleId=${vId}` : '/api/refueling';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        const vList = data.vehicles || [];
        setVehicles(vList);
        if (vList.length > 0 && !newVehicleId) {
          setNewVehicleId(vList[0].vehicle_id);
          setNewMileage(String(vList[0].current_mileage || ''));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchRecords();
  }, []);

  const handleFilterVehicle = (vId: string) => {
    setSelectedVehicleId(vId);
    fetchRecords(vId);
  };

  // 自動計算總金額
  const handleLitersChange = (val: string) => {
    setNewLiters(val);
    if (val && newUnitPrice) {
      const tot = Math.round(Number(val) * Number(newUnitPrice));
      setNewTotalAmount(String(tot));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setNewUnitPrice(val);
    if (val && newLiters) {
      const tot = Math.round(Number(newLiters) * Number(val));
      setNewTotalAmount(String(tot));
    }
  };

  const handleVehicleSelectInModal = (vId: string) => {
    setNewVehicleId(vId);
    const v = vehicles.find((item) => item.vehicle_id === vId);
    if (v) {
      setNewMileage(String(v.current_mileage || ''));
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/refueling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: newVehicleId,
          refuel_date: newDate,
          refuel_time: newTime,
          mileage: Number(newMileage),
          liters: Number(newLiters),
          unit_price: Number(newUnitPrice) || 0,
          total_amount: Number(newTotalAmount) || 0,
          fuel_type: newFuelType,
          payment_method: newPaymentMethod,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '新增失敗');
      }

      setShowAddModal(false);
      setNewLiters('');
      setNewUnitPrice('');
      setNewTotalAmount('');
      setNewNotes('');
      fetchRecords(selectedVehicleId);
      fetchVehicles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      (r.plate_number && r.plate_number.toLowerCase().includes(term)) ||
      (r.nickname && r.nickname.toLowerCase().includes(term)) ||
      (r.fuel_type && r.fuel_type.toLowerCase().includes(term)) ||
      (r.notes && r.notes.toLowerCase().includes(term)) ||
      (r.payment_method && r.payment_method.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* 標題與操作區 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Fuel className="h-7 w-7 text-primary" />
            加油紀錄與油耗分析
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            追蹤每次加油油量、單價與行駛里程，精準掌握愛車平均油耗與每公里花費
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          新增加油紀錄
        </button>
      </div>

      {/* 車輛篩選按鈕列 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => handleFilterVehicle('')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            selectedVehicleId === ''
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          全部愛車 ({records.length})
        </button>
        {vehicles.map((v) => (
          <button
            key={v.vehicle_id}
            onClick={() => handleFilterVehicle(v.vehicle_id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 flex items-center gap-2 ${
              selectedVehicleId === v.vehicle_id
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <span>{v.plate_number}</span>
            {v.nickname && <span className="text-xs opacity-80">({v.nickname})</span>}
          </button>
        ))}
      </div>

      {/* 關鍵統計指標看板 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>累計加油花費</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-foreground">
              NT$ {stats.totalSpent.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">共 {stats.totalRecords} 筆紀錄</div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>總添加油量</span>
              <Fuel className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-foreground">
              {stats.totalLiters.toLocaleString()} <span className="text-sm font-normal">L</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">累計燃油消耗</div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>平均油耗表現</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-black text-foreground flex items-baseline gap-1">
              <span>{stats.avgEfficiency > 0 ? stats.avgEfficiency : '--'}</span>
              <span className="text-sm font-normal text-muted-foreground">km/L</span>
            </div>
            <div className="mt-1 text-xs text-emerald-500 font-medium">
              {stats.avgEfficiency >= 12 ? '🍃 極佳省油' : stats.avgEfficiency >= 9 ? '⚡ 表現良好' : '正常市區水準'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>每公里油錢成本</span>
              <Zap className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-foreground flex items-baseline gap-1">
              <span>NT$ {stats.avgCostPerKm > 0 ? stats.avgCostPerKm : '--'}</span>
              <span className="text-sm font-normal text-muted-foreground">/km</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              統計行駛 {stats.totalDistance.toLocaleString()} km
            </div>
          </div>
        </div>
      )}

      {/* 搜尋與清單 */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜尋車牌、油品、備註..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="text-xs text-muted-foreground w-full sm:w-auto text-right">
            顯示 {filteredRecords.length} 筆紀錄
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>正在載入加油紀錄...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Fuel className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="font-medium text-foreground">尚無加油紀錄</p>
            <p className="text-xs">點擊右上角「新增加油紀錄」開始登記</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="py-3 px-4">加油日期 / 時間</th>
                  <th className="py-3 px-4">車輛</th>
                  <th className="py-3 px-4">目前里程</th>
                  <th className="py-3 px-4">油品 / 單價</th>
                  <th className="py-3 px-4">加油量</th>
                  <th className="py-3 px-4">實付金額</th>
                  <th className="py-3 px-4">區間油耗</th>
                  <th className="py-3 px-4">每公里成本</th>
                  <th className="py-3 px-4">付款 / 備註</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((r) => (
                  <tr key={r.record_id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.refuel_date}</span>
                      </div>
                      {r.refuel_time && (
                        <div className="text-xs text-muted-foreground pl-5">{r.refuel_time}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-foreground">{r.plate_number}</span>
                      {r.nickname && (
                        <span className="ml-1 text-xs text-muted-foreground">({r.nickname})</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.mileage?.toLocaleString()} km</span>
                      </div>
                      {r.trip_distance > 0 && (
                        <div className="text-xs text-primary font-medium pl-5">
                          +{r.trip_distance.toLocaleString()} km
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                        {r.fuel_type || '95無鉛'}
                      </span>
                      {r.unit_price > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                          ${r.unit_price} /L
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-foreground">
                      {r.liters} L
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-black text-foreground">
                        ${r.total_amount?.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.fuel_efficiency > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {r.fuel_efficiency} km/L
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.cost_per_km > 0 ? (
                        <span className="text-xs font-semibold text-foreground">
                          ${r.cost_per_km} /km
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.payment_method || '信用卡'}</span>
                      {r.notes && <span className="ml-1.5 opacity-80">· {r.notes}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新增加油紀錄 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Fuel className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">登記新加油紀錄</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 選擇車輛 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  選擇愛車 *
                </label>
                <select
                  value={newVehicleId}
                  onChange={(e) => handleVehicleSelectInModal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary/30"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.plate_number} {v.nickname ? `(${v.nickname})` : ''} - 目前里程:{' '}
                      {v.current_mileage?.toLocaleString()} km
                    </option>
                  ))}
                </select>
              </div>

              {/* 日期與時間 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    加油日期 *
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    加油時間
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              </div>

              {/* 里程與油品 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    當前總里程 (km) *
                  </label>
                  <input
                    type="number"
                    placeholder="例: 18500"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    油品種類
                  </label>
                  <select
                    value={newFuelType}
                    onChange={(e) => setNewFuelType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium"
                  >
                    <option value="95無鉛">95無鉛汽油</option>
                    <option value="98無鉛">98無鉛汽油</option>
                    <option value="92無鉛">92無鉛汽油</option>
                    <option value="超級柴油">超級柴油</option>
                  </select>
                </div>
              </div>

              {/* 公升數、單價、總額 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    公升數 (L) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="例: 42.5"
                    value={newLiters}
                    onChange={(e) => handleLitersChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    每公升單價 (元)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="例: 31.2"
                    value={newUnitPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    實付金額 (元) *
                  </label>
                  <input
                    type="number"
                    placeholder="自動試算"
                    value={newTotalAmount}
                    onChange={(e) => setNewTotalAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold text-primary"
                    required
                  />
                </div>
              </div>

              {/* 付款方式與備註 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    付款方式
                  </label>
                  <select
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium"
                  >
                    <option value="信用卡">信用卡</option>
                    <option value="現金">現金</option>
                    <option value="LINE Pay">LINE Pay</option>
                    <option value="加油卡">加油卡 / 儲值卡</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    備註 / 加油站
                  </label>
                  <input
                    type="text"
                    placeholder="例: 中油直營 / 週三折價"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  {submitting ? '儲存中...' : '確認登記'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

