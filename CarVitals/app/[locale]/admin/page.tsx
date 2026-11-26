import { setRequestLocale } from 'next-intl/server';
import AdminClient from '@/components/admin/AdminClient';

export const dynamic = 'force-dynamic';

export default function AdminPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <AdminClient locale={locale} />;
}
