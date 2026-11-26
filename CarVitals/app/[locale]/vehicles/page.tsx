import { setRequestLocale } from 'next-intl/server';
import VehiclesClient from '@/components/vehicles/VehiclesClient';

export const dynamic = 'force-dynamic';

export default function VehiclesPage({
  params: { locale }
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <VehiclesClient locale={locale} />;
}
