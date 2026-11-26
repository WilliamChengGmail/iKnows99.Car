'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Lock, User, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { username, password, email } : { username, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '操作失敗');
      }

      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {isRegister ? '建立 CarVitals 帳號' : '登入 CarVitals 車輛管理'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRegister ? '註冊專屬帳號以管理您的愛車與完整維修履歷' : '輸入帳號密碼以檢視並維護您的車籍資訊'}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7 shadow-xl shadow-black/5 dark:shadow-black/20">
          <div className="flex rounded-xl bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                !isRegister ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              登入帳號
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                isRegister ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              新用戶註冊
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                使用者帳號
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="請輸入帳號 (例如: admin)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  電子信箱 (選填)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? '請設定至少 6 碼密碼' : '請輸入密碼'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                '處理中...'
              ) : isRegister ? (
                <>
                  建立帳號並登入 <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  安全登入 <ShieldCheck className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {!isRegister && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              預設管理者帳號: <span className="font-mono text-foreground font-semibold">admin</span> / 密碼: <span className="font-mono text-foreground font-semibold">admin123456</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

