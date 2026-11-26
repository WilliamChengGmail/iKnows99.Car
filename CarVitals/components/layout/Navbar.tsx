'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Activity, Car, Wrench, Fuel, Receipt, Shield, LogOut, LogIn, UserCheck, KeyRound, Settings } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal';

export default function Navbar({ currentLocale }: { currentLocale: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string; mustChangePassword?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setMustChangePassword(!!data.user?.mustChangePassword);
      } else {
        setUser(null);
        setMustChangePassword(false);
      }
    } catch (e) {
      setUser(null);
      setMustChangePassword(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setMustChangePassword(false);
      router.push(`/${currentLocale}/login`);
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { href: `/${currentLocale}/dashboard`, label: t('dashboard'), icon: Activity },
    { href: `/${currentLocale}/vehicles`, label: t('vehicles'), icon: Car },
    { href: `/${currentLocale}/maintenance`, label: t('maintenance'), icon: Wrench },
    { href: `/${currentLocale}/refueling`, label: t('refueling'), icon: Fuel },
    { href: `/${currentLocale}/expenses`, label: t('expenses'), icon: Receipt },
  ];

  if (user?.role === 'admin') {
    navItems.push({ href: `/${currentLocale}/admin`, label: t('admin'), icon: Shield });
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href={`/${currentLocale}/dashboard`} className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-wider bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                  CarVitals
                </span>
                <span className="text-[10px] text-muted-foreground -mt-1 font-medium">Vehicle Manager</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href.includes('dashboard') && pathname === `/${currentLocale}`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <LanguageSwitcher currentLocale={currentLocale} />
            <ThemeToggle />

            {!loading && (
              user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-border">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs font-bold text-foreground leading-tight flex items-center justify-end gap-1">
                      <UserCheck className="h-3 w-3 text-emerald-500" />
                      {user.username}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {user.role === 'admin' ? '系統管理員' : '車主會員'}
                    </span>
                  </div>

                  {/* 個人偏好與環境設定按鈕 */}
                  <Link
                    href={`/${currentLocale}/settings`}
                    title="個人偏好與環境設定"
                    className="p-2 rounded-lg border border-border bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>

                  {/* 自主修改密碼按鈕 */}
                  <button
                    onClick={() => setShowChangePwd(true)}
                    title="修改我的密碼"
                    className="p-2 rounded-lg border border-border bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition-all flex items-center justify-center cursor-pointer"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>

                  {/* 登出按鈕 */}
                  <button
                    onClick={handleLogout}
                    title="登出系統"
                    className="p-2 rounded-lg border border-border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground transition-all flex items-center justify-center cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href={`/${currentLocale}/login`}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-sm transition-all"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  登入
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      {/* 自主修改密碼彈窗 */}
      <ChangePasswordModal
        isOpen={showChangePwd}
        onClose={() => setShowChangePwd(false)}
      />

      {/* 管理員重置後之強制修改密碼彈窗 (不可關閉) */}
      <ForceChangePasswordModal
        isOpen={mustChangePassword}
        onPasswordChanged={() => {
          setMustChangePassword(false);
          fetchMe();
          router.refresh();
        }}
      />
    </>
  );
}
