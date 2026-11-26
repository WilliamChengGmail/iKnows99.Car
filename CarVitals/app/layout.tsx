import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CarVitals - 現代化車輛健康與保養管理系統',
  description: '即時掌握車輛健康狀況、行駛里程與零件壽命預警',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
        {children}
      </body>
    </html>
  );
}

