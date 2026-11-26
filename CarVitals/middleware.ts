import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export const config = {
  // 匹配所有路由，排除 api、_next、靜態資源
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};

