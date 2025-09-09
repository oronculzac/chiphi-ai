import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
export const locales = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ar', 'vi'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) notFound();

  return {
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});

// RTL languages
export const rtlLocales: Locale[] = ['ar'];

// Date format configurations per locale
export const dateFormats: Record<Locale, string> = {
  en: 'MM/dd/yyyy',
  es: 'dd/MM/yyyy',
  fr: 'dd/MM/yyyy',
  de: 'dd.MM.yyyy',
  ja: 'yyyy/MM/dd',
  zh: 'yyyy/MM/dd',
  ar: 'dd/MM/yyyy',
  vi: 'dd/MM/yyyy',
};

// Number format configurations per locale
export const numberFormats: Record<Locale, Intl.NumberFormatOptions> = {
  en: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  es: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  fr: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  de: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  ja: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  zh: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  ar: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  vi: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 },
};

// File size format configurations per locale
export const fileSizeFormats: Record<Locale, { units: string[]; decimal: string }> = {
  en: { units: ['B', 'KB', 'MB', 'GB'], decimal: '.' },
  es: { units: ['B', 'KB', 'MB', 'GB'], decimal: ',' },
  fr: { units: ['o', 'Ko', 'Mo', 'Go'], decimal: ',' },
  de: { units: ['B', 'KB', 'MB', 'GB'], decimal: ',' },
  ja: { units: ['B', 'KB', 'MB', 'GB'], decimal: '.' },
  zh: { units: ['B', 'KB', 'MB', 'GB'], decimal: '.' },
  ar: { units: ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'], decimal: '.' },
  vi: { units: ['B', 'KB', 'MB', 'GB'], decimal: ',' },
};