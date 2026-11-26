import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default function LocaleIndexPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  redirect(`/${locale}/dashboard`);
}
