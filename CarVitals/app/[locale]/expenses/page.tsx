import { setRequestLocale } from 'next-intl/server';
import ExpenseClient from '@/components/expenses/ExpenseClient';

export const dynamic = 'force-dynamic';

export default function ExpensesPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ExpenseClient locale={locale} />;
}

