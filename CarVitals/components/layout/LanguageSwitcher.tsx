'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath || `/${newLocale}`);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card text-foreground text-sm">
      <Languages className="w-4 h-4 text-muted-foreground" />
      <select
        value={currentLocale}
        onChange={(e) => handleLocaleChange(e.target.value)}
        className="bg-transparent focus:outline-none cursor-pointer text-sm font-medium"
      >
        <option value="zh-TW" className="bg-card text-foreground">繁體中文</option>
        <option value="en" className="bg-card text-foreground">English</option>
      </select>
    </div>
  );
}

