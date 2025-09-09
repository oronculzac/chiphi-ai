'use client';

import React, { ReactNode } from 'react';
import { NextIntlClientProvider, useLocale } from 'next-intl';
import { rtlLocales, type Locale } from '@/lib/i18n/config';

interface LocaleProviderProps {
  children: ReactNode;
  messages: any;
  locale?: string;
}

export function LocaleProvider({ children, messages, locale }: LocaleProviderProps) {
  const currentLocale = (locale || useLocale()) as Locale;
  const isRTL = rtlLocales.includes(currentLocale);

  return (
    <NextIntlClientProvider 
      locale={currentLocale} 
      messages={messages}
      timeZone="UTC"
    >
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}

// Hook to get current locale information
export function useLocaleInfo() {
  const locale = useLocale() as Locale;
  const isRTL = rtlLocales.includes(locale);
  
  return {
    locale,
    isRTL,
    dir: isRTL ? 'rtl' : 'ltr',
  };
}