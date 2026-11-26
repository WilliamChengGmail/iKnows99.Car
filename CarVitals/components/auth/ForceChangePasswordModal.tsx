'use client';

import { useState } from 'react';
import { ShieldAlert, Lock, ArrowRight, AlertCircle, Check } from 'lucide-react';

export default function ForceChangePasswordModal({
  isOpen,
  onPasswordChanged,
}: {
  isOpen: boolean;
  onPasswordChanged: () => void;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('新密碼長度至少需 6 碼');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('兩次輸入的新密碼不一致');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '密碼更新失敗');

      setSuccess(true);
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl border border-destructive/40 bg-card p-7 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-1 shadow-sm">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-black text-foreground">必須強制更新登入密碼</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            您的密碼已被系統管理員重置。為確保您的帳戶與車籍資料安全，首次登入必須設定一組全新的自訂密碼方可進入系統。
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 text-center space-y-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-foreground">密碼更新成功！</h3>
            <p className="text-xs text-muted-foreground">系統正在為您解鎖並進入儀表板...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                目前臨時密碼 *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="請輸入管理員提供的臨時密碼"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                設定您的新密碼 *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 碼新密碼"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                再次確認新密碼 *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次輸入新密碼"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-sm shadow-md shadow-destructive/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                '更新中...'
              ) : (
                <>
                  設定新密碼並解鎖進入系統 <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

