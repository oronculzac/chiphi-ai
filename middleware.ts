// Temporarily disabled i18n middleware for UI testing
// import createMiddleware from 'next-intl/middleware';
// import { locales, defaultLocale } from './lib/i18n/config';

// export default createMiddleware({
//   // A list of all locales that are supported
//   locales,
  
//   // Used when no locale matches
//   defaultLocale,
  
//   // Don't use locale prefix for default locale
//   localePrefix: 'as-needed',
  
//   // Redirect to default locale if no locale is detected
//   localeDetection: true,
// });

export const config = {
  // Temporarily disable middleware
  matcher: []
};