import { setRequestLocale } from 'next-intl/server';
import SettingsClient from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default function SettingsPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <SettingsClient currentLocale={locale} />;
}

