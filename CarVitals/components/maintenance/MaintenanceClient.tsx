'use client';

import { useState, useEffect } from 'react';
import { Wrench, Calendar, Gauge, DollarSign, Plus, X, Search, ChevronRight, AlertCircle, Package } from 'lucide-react';

export default function MaintenanceClient({ locale }: { locale: string }) {
  const [records, setRecords] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 工單詳細 Modal
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [activeItems, setActiveItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 新增工單 Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMileage, setNewMileage] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchRecords = async (vId = selectedVehicleId) => {
    try {
      setLoading(true);
      const url = vId ? `/api/maintenance?vehicleId=${vId}` : '/api/maintenance';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
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
        setVehicles(data.vehicles || []);
        if (data.vehicles?.length > 0 && !newVehicleId) {
          setNewVehicleId(data.vehicles[0].vehicle_id);
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

  const handleOpenDetail = async (recordId: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/maintenance/${recordId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRecord(data.record);
        setActiveItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: newVehicleId,
          record_date: newDate,
          mileage: newMileage ? Number(newMileage) : 0,
          title: newTitle,
          total_amount: newAmount ? Number(newAmount) : 0,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '新增失敗');

      setNewTitle('');
      setNewMileage('');
      setNewAmount('');
      setNewNotes('');
      setShowAddModal(false);
      fetchRecords(selectedVehicleId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.title?.toLowerCase().includes(term) ||
      r.plate_number?.toLowerCase().includes(term) ||
      r.nickname?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 標題與操作區 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            維修保養履歷
          </h1>
          <p className="text-sm text-muted-foreground mt-1">完整追蹤保養工單主檔與所有更換之零件工單細項</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer w-fit"
        >
          <Plus className="h-4 w-4" />
          登記新保養工單
        </button>
      </div>

      {/* 車輛切換與搜尋列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 車輛快速篩選 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleFilterVehicle('')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedVehicleId === '' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            全部車輛 ({records.length})
          </button>
          {vehicles.map(v => (
            <button
              key={v.vehicle_id}
              onClick={() => handleFilterVehicle(v.vehicle_id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedVehicleId === v.vehicle_id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {v.nickname || v.plate_number}
            </button>
          ))}
        </div>

        {/* 搜尋框 */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋工單標題或車牌..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-border bg-card text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 工單列表表格 */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">載入保養工單中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Wrench className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-base font-bold text-foreground">尚無維修保養紀錄</p>
            <p className="text-xs text-muted-foreground">點擊上方按鈕建立第一筆保養工單，追蹤零件消耗壽命！</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRecords.map((r) => (
              <div
                key={r.record_id}
                onClick={() => handleOpenDetail(r.record_id)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-foreground group-hover:text-primary transition-colors">
                        {r.title}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-foreground font-bold">
                        {r.plate_number}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {r.record_date}
                      </span>
                      {r.mileage > 0 && (
                        <span className="flex items-center gap-1 font-mono">
                          <Gauge className="h-3.5 w-3.5" /> {Number(r.mileage).toLocaleString()} km
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" /> {r.item_count || 0} 項零件細項
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">工單總金額</p>
                    <p className="text-lg font-black font-mono text-emerald-500">
                      ${Number(r.total_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 工單詳細與零件細項 Modal */}
      {activeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-muted-foreground">{activeRecord.plate_number} · {activeRecord.nickname}</span>
                <h3 className="text-xl font-black text-foreground mt-0.5">{activeRecord.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>日期: {activeRecord.record_date}</span>
                  <span>里程: {Number(activeRecord.mileage || 0).toLocaleString()} km</span>
                  <span>付款方式: {activeRecord.payment_method || '現金'}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveRecord(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 零件工單細項表格 (8 欄詳細資訊) */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                零件與保養細項清單 ({activeItems.length} 項)
              </h4>

              {activeItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">此工單無獨立細項零件記錄</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 border-b border-border uppercase font-bold text-muted-foreground">
                      <tr>
                        <th className="px-3.5 py-3">品項名稱</th>
                        <th className="px-3 py-3">規格說明</th>
                        <th className="px-3 py-3">壽命 (天/月/年)</th>
                        <th className="px-3 py-3">壽命里程</th>
                        <th className="px-3 py-3 text-right">單價</th>
                        <th className="px-3 py-3 text-center">數量</th>
                        <th className="px-3 py-3 text-right">小計</th>
                        <th className="px-3 py-3">備註</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      {activeItems.map((item) => (
                        <tr key={item.item_id} className="hover:bg-muted/20">
                          <td className="px-3.5 py-3 font-bold text-foreground">{item.item_name}</td>
                          <td className="px-3 py-3 text-muted-foreground">{item.spec_detail || '-'}</td>
                          <td className="px-3 py-3 text-muted-foreground">{item.lifespan_date || '-'}</td>
                          <td className="px-3 py-3 font-mono">{item.lifespan_mileage ? `${item.lifespan_mileage.toLocaleString()} km` : '-'}</td>
                          <td className="px-3 py-3 text-right font-mono">${Number(item.unit_price || 0).toLocaleString()}</td>
                          <td className="px-3 py-3 text-center font-mono">{item.quantity || 1}</td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-500">${Number(item.subtotal || 0).toLocaleString()}</td>
                          <td className="px-3 py-3 text-muted-foreground">{item.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {activeRecord.notes && (
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground">
                <span className="font-bold text-foreground">工單備註：</span> {activeRecord.notes}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-bold text-foreground">工單合計金額</span>
              <span className="text-xl font-black font-mono text-emerald-500">${Number(activeRecord.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* 新增工單 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">登記保養工單</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:bg-muted p-1 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateRecord} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">選擇車輛 *</label>
                <select
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {vehicles.map(v => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.nickname || v.plate_number} ({v.plate_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">工單日期 *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">保養時里程 (km)</label>
                  <input
                    type="number"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    placeholder="例如: 50000"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">工單標題/主要項目 *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如: 定期小保養 (機油+機油芯更換)"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">總金額 ($)</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="例如: 2800"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">備註</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="保養廠名稱或注意事項"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? '儲存中...' : '確認建立工單'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

