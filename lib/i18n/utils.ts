import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { enUS, es, fr, de, ja, zhCN, ar } from 'date-fns/locale';
import { dateFormats, numberFormats, fileSizeFormats, type Locale } from './config';

// Date-fns locale mapping
const dateFnsLocales = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  ja: ja,
  zh: zhCN,
  ar: ar,
};

/**
 * Format a date according to the current locale
 */
export function useLocalizedDate() {
  const locale = useLocale() as Locale;
  
  return {
    formatDate: (date: Date | string, formatStr?: string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Handle invalid dates
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      const formatPattern = formatStr || dateFormats[locale];
      const dateFnsLocale = dateFnsLocales[locale];
      
      return format(dateObj, formatPattern, { locale: dateFnsLocale });
    },
    formatRelativeDate: (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      const t = useTranslations('common.dates');
      
      if (diffInDays === 0) return t('today');
      if (diffInDays === 1) return t('yesterday');
      if (diffInDays < 7) return t('daysAgo', { count: diffInDays });
      if (diffInDays < 30) return t('weeksAgo', { count: Math.floor(diffInDays / 7) });
      if (diffInDays < 365) return t('monthsAgo', { count: Math.floor(diffInDays / 30) });
      return t('yearsAgo', { count: Math.floor(diffInDays / 365) });
    }
  };
}

/**
 * Format numbers according to the current locale
 */
export function useLocalizedNumber() {
  const locale = useLocale() as Locale;
  
  return {
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
      const formatOptions = { ...numberFormats[locale], ...options };
      return new Intl.NumberFormat(locale, formatOptions).format(value);
    },
    formatCurrency: (value: number, currency: string = 'USD') => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
      }).format(value);
    },
    formatPercentage: (value: number) => {
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100);
    }
  };
}

/**
 * Format file sizes according to the current locale
 */
export function useLocalizedFileSize() {
  const locale = useLocale() as Locale;
  
  return {
    formatFileSize: (bytes: number) => {
      const { units, decimal } = fileSizeFormats[locale];
      
      if (bytes === 0) return `0 ${units[0]}`;
      
      const k = 1024;
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
      const size = bytes / Math.pow(k, i);
      
      return `${size.toFixed(1).replace('.', decimal)} ${units[i]}`;
    }
  };
}

/**
 * Get text direction for the current locale
 */
export function useTextDirection() {
  const locale = useLocale() as Locale;
  const rtlLocales = ['ar'];
  
  return {
    dir: rtlLocales.includes(locale) ? 'rtl' : 'ltr',
    isRTL: rtlLocales.includes(locale),
  };
}

/**
 * Pluralization helper
 */
export function usePluralization() {
  const t = useTranslations();
  
  return {
    plural: (key: string, count: number, options?: Record<string, any>) => {
      return t(key, { count, ...options });
    }
  };
}