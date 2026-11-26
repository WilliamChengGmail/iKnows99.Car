'use client';

import { useState, useEffect } from 'react';
import { Receipt, Calendar, Gauge, DollarSign, Plus, X, Search, Tag, PieChart, ShieldAlert, Sparkles } from 'lucide-react';

interface Vehicle {
  vehicle_id: string;
  plate_number: string;
  nickname: string;
  current_mileage: number;
}

interface ExpenseRecord {
  record_id: string;
  vehicle_id: string;
  plate_number: string;
  nickname: string;
  expense_date: string;
  expense_time: string;
  mileage: number;
  title: string;
  expense_category: string;
  total_amount: number;
  payment_method: string;
  notes: string;
}

const CATEGORIES = [
  { id: 'all', label: '全部分類' },
  { id: '其他', label: '其他費用' },
  { id: '美容洗車', label: '美容洗車' },
  { id: '停車費', label: '停車費用' },
  { id: '過路通行費', label: '過路通行費' },
  { id: '保險規費', label: '保險規費' },
  { id: '稅金規費', label: '稅金規費' },
  { id: '改裝配件', label: '改裝配件' },
  { id: '違規罰單', label: '違規罰單' },
];

export default function ExpenseClient({ locale }: { locale: string }) {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stats, setStats] = useState<{ totalSpent: number; totalRecords: number; categoryTotals: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 新增 Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('其他');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('12:00');
  const [newAmount, setNewAmount] = useState('');
  const [newMileage, setNewMileage] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('現金');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchRecords = async (vId = selectedVehicleId, cat = selectedCategory) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (vId) params.append('vehicleId', vId);
      if (cat && cat !== 'all') params.append('category', cat);
      const url = `/api/expenses?${params.toString()}`;

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
    fetchRecords(vId, selectedCategory);
  };

  const handleFilterCategory = (cat: string) => {
    setSelectedCategory(cat);
    fetchRecords(selectedVehicleId, cat);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: newVehicleId,
          title: newTitle,
          expense_category: newCategory,
          expense_date: newDate,
          expense_time: newTime,
          total_amount: Number(newAmount),
          mileage: newMileage ? Number(newMileage) : 0,
          payment_method: newPaymentMethod,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '新增失敗');
      }

      setShowAddModal(false);
      setNewTitle('');
      setNewAmount('');
      setNewNotes('');
      fetchRecords(selectedVehicleId, selectedCategory);
      fetchVehicles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case '保險規費':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case '稅金規費':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case '美容洗車':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case '停車費':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case '過路通行費':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case '改裝配件':
        return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
      case '違規罰單':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      (r.title && r.title.toLowerCase().includes(term)) ||
      (r.plate_number && r.plate_number.toLowerCase().includes(term)) ||
      (r.nickname && r.nickname.toLowerCase().includes(term)) ||
      (r.expense_category && r.expense_category.toLowerCase().includes(term)) ||
      (r.notes && r.notes.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* 標題與操作區 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-7 w-7 text-primary" />
            其他費用管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            分類管理車輛相關之稅金、保險、通行費、美容洗車、停車費與改裝雜項
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
          新增費用項目
        </button>
      </div>

      {/* 車輛篩選按鈕列 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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

      {/* 費用概覽看板 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>累計費用總額</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-3xl font-black text-foreground">
                NT$ {stats.totalSpent.toLocaleString()}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              共計收錄 {stats.totalRecords} 筆各類花費
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm md:col-span-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-3">
              <span>主要費用分類占比</span>
              <PieChart className="h-4 w-4 text-primary" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(stats.categoryTotals).map(([cat, amount]) => (
                <div key={cat} className="p-2.5 rounded-xl bg-muted/30 border border-border/50">
                  <div className="text-xs text-muted-foreground font-medium">{cat}</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    ${amount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {stats.totalSpent > 0 ? Math.round((amount / stats.totalSpent) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 分類快速標籤 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleFilterCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 border ${
              selectedCategory === cat.id
                ? 'bg-foreground text-background border-foreground shadow-sm'
                : 'bg-card border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 搜尋與清單 */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜尋項目名稱、車牌、備註..."
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
            <span>正在載入費用清單...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="font-medium text-foreground">尚無費用紀錄</p>
            <p className="text-xs">點擊右上角「新增費用項目」開始登記</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="py-3 px-4">費用日期</th>
                  <th className="py-3 px-4">車輛</th>
                  <th className="py-3 px-4">類別</th>
                  <th className="py-3 px-4">費用項目</th>
                  <th className="py-3 px-4">相關里程</th>
                  <th className="py-3 px-4">金額</th>
                  <th className="py-3 px-4">付款方式</th>
                  <th className="py-3 px-4">備註</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((r) => (
                  <tr key={r.record_id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.expense_date}</span>
                      </div>
                      {r.expense_time && (
                        <div className="text-xs text-muted-foreground pl-5">{r.expense_time}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-foreground">{r.plate_number}</span>
                      {r.nickname && (
                        <span className="ml-1 text-xs text-muted-foreground">({r.nickname})</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getCategoryBadgeClass(
                          r.expense_category
                        )}`}
                      >
                        {r.expense_category || '其他'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-foreground max-w-xs truncate">
                      {r.title}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                      {r.mileage > 0 ? (
                        <div className="flex items-center gap-1">
                          <Gauge className="h-3.5 w-3.5" />
                          <span>{r.mileage.toLocaleString()} km</span>
                        </div>
                      ) : (
                        <span>--</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-black text-foreground">
                      NT$ {r.total_amount?.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-muted-foreground">
                      {r.payment_method || '現金'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground max-w-xs truncate">
                      {r.notes || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新增費用 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">新增費用項目</h3>
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
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* 選擇車輛 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  選擇愛車 *
                </label>
                <select
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary/30"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.plate_number} {v.nickname ? `(${v.nickname})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 項目名稱與分類 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    項目名稱 *
                  </label>
                  <input
                    type="text"
                    placeholder="例: 年度汽車牌照稅"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    費用類別 *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium"
                  >
                    <option value="其他">其他</option>
                    <option value="美容洗車">美容洗車</option>
                    <option value="停車費">停車費</option>
                    <option value="過路通行費">過路通行費</option>
                    <option value="保險規費">保險規費</option>
                    <option value="稅金規費">稅金規費</option>
                    <option value="改裝配件">改裝配件</option>
                    <option value="違規罰單">違規罰單</option>
                  </select>
                </div>
              </div>

              {/* 日期、時間、金額 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    費用日期 *
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
                    時間
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    金額 (元) *
                  </label>
                  <input
                    type="number"
                    placeholder="例: 7120"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold text-primary"
                    required
                  />
                </div>
              </div>

              {/* 里程與付款方式 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    相關里程 (選填)
                  </label>
                  <input
                    type="number"
                    placeholder="當時里程 km"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    付款方式
                  </label>
                  <select
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-medium"
                  >
                    <option value="現金">現金</option>
                    <option value="信用卡">信用卡</option>
                    <option value="銀行轉帳">銀行轉帳</option>
                    <option value="行動支付">行動支付</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>

              {/* 備忘筆記 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  備註說明
                </label>
                <input
                  type="text"
                  placeholder="備註資訊..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                />
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

