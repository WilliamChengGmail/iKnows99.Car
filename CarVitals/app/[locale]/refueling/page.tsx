import { setRequestLocale } from 'next-intl/server';
import RefuelingClient from '@/components/refueling/RefuelingClient';

export const dynamic = 'force-dynamic';

export default function RefuelingPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <RefuelingClient locale={locale} />;
}

