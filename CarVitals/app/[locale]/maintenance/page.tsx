import { setRequestLocale } from 'next-intl/server';
import MaintenanceClient from '@/components/maintenance/MaintenanceClient';

export const dynamic = 'force-dynamic';

export default function MaintenancePage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <MaintenanceClient locale={locale} />;
}

