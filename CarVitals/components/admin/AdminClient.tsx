'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, Car, UserPlus, Check, X, ShieldAlert, RefreshCw, KeyRound, Copy } from 'lucide-react';

export default function AdminClient({ locale }: { locale: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 新增使用者表單
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('owner');
  const [submitting, setSubmitting] = useState(false);

  // 重置密碼結果彈窗
  const [resetResult, setResetResult] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        throw new Error('存取被拒：僅系統管理者 (admin) 具備此頁面權限');
      }
      if (!res.ok) throw new Error('讀取使用者列表失敗');

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (userId: number, currentStatus: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentStatus === 1 ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('更新狀態失敗');
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleResetPassword = async (userId: number, username: string) => {
    if (!confirm(`確定要重置使用者 [${username}] 的密碼嗎？\n系統將自動產生一組 6~12 碼的隨機臨時密碼，且該使用者下次登入時必須強制更新密碼。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重置密碼失敗');

      setResetResult({
        username: data.username,
        temporaryPassword: data.temporaryPassword,
      });
      setCopied(false);
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const copyToClipboard = () => {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          email: newEmail,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '新增失敗');

      setNewUsername('');
      setNewPassword('');
      setNewEmail('');
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && error.includes('存取被拒')) {
    return (
      <div className="container mx-auto p-12 text-center space-y-4">
        <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
        <h2 className="text-2xl font-black text-foreground">存取被拒 (403 Forbidden)</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md cursor-pointer"
        >
          返回首頁儀表板
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">使用者與權限後台管理</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            檢視系統所有使用者帳號、指派權限角色，並管理各使用者名下車輛數據
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            title="重新整理"
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            建立新使用者
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">系統總使用者數</p>
            <p className="text-3xl font-black text-foreground">{users.length}</p>
            <p className="text-xs text-muted-foreground">已註冊或建立之會員帳號</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">全域車輛總數</p>
            <p className="text-3xl font-black text-foreground">
              {users.reduce((acc, u) => acc + Number(u.vehicle_count || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">所有會員名下累積之總車輛</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Car className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold">使用者帳號清單與車輛配額</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">載入使用者列表中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-bold">使用者帳號</th>
                  <th className="px-5 py-3.5 font-bold">權限角色</th>
                  <th className="px-5 py-3.5 font-bold">所屬車輛數</th>
                  <th className="px-5 py-3.5 font-bold">帳號狀態</th>
                  <th className="px-5 py-3.5 font-bold">密碼狀態</th>
                  <th className="px-5 py-3.5 font-bold">最後登入時間</th>
                  <th className="px-5 py-3.5 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      <div className="flex flex-col">
                        <span>{u.username}</span>
                        {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                          : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {u.role === 'admin' ? '系統管理者' : '車主會員'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-foreground">
                      {u.vehicle_count} 台
                    </td>
                    <td className="px-5 py-4">
                      {u.is_active === 1 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-bold">
                          <Check className="h-3.5 w-3.5" /> 正常啟用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive font-bold">
                          <X className="h-3.5 w-3.5" /> 已停用
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {Number(u.must_change_password) === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          待更新密碼
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">正常</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {u.last_login_at || '尚未登入'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* 重置密碼按鈕 */}
                        <button
                          onClick={() => handleResetPassword(u.id, u.username)}
                          title="重置密碼並產生隨機臨時密碼"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-foreground transition-all cursor-pointer font-medium"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                          重置密碼
                        </button>

                        {/* 啟用/停用按鈕 (admin 不能停用自己) */}
                        {u.username !== 'admin' && (
                          <button
                            onClick={() => handleToggleStatus(u.id, u.is_active)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              u.is_active === 1
                                ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                                : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                            }`}
                          >
                            {u.is_active === 1 ? '停用' : '啟用'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 臨時密碼生成結果彈窗 */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-card p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">密碼重置成功</h3>
                  <p className="text-xs text-muted-foreground">已為使用者 [{resetResult.username}] 產生隨機密碼</p>
                </div>
              </div>
              <button
                onClick={() => setResetResult(null)}
                className="text-muted-foreground hover:bg-muted p-1.5 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                生成的隨機臨時密碼 (請立即提供給使用者)
              </label>
              <div className="flex items-center gap-2 p-3.5 rounded-2xl border border-border bg-muted/60 font-mono text-lg font-black text-foreground tracking-widest justify-between">
                <span>{resetResult.temporaryPassword}</span>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? '已複製' : '複製'}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-300 leading-relaxed">
              ⚠️ <strong>安全提示</strong>：該使用者使用此臨時密碼首次登入時，系統將**強制鎖定並要求設定全新的個人密碼**，方可解鎖進入系統。
            </div>

            <button
              onClick={() => setResetResult(null)}
              className="w-full py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs transition-colors cursor-pointer"
            >
              完成並關閉
            </button>
          </div>
        </div>
      )}

      {/* 新增使用者 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">建立新使用者帳號</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:bg-muted p-1 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">帳號名稱 *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="例如: john_doe"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">初始密碼 *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 碼"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">電子郵件 (選填)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">角色權限</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="owner">車主會員 (Owner)</option>
                  <option value="admin">系統管理員 (Admin)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? '建立中...' : '確認建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
