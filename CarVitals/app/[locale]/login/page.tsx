import { setRequestLocale } from 'next-intl/server';
import LoginForm from '@/components/auth/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <LoginForm locale={locale} />;
}
