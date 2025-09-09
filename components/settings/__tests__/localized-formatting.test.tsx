import React from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useLocalizedDate, useLocalizedNumber, useLocalizedFileSize } from '@/lib/i18n/utils';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';

// Test component for date formatting
function DateFormattingTest() {
  const { formatDate, formatRelativeDate } = useLocalizedDate();
  const testDate = new Date('2024-01-15T10:30:00Z');
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return (
    <div>
      <div data-testid="formatted-date">{formatDate(testDate)}</div>
      <div data-testid="relative-date">{formatRelativeDate(yesterdayDate)}</div>
    </div>
  );
}

// Test component for number formatting
function NumberFormattingTest() {
  const { formatNumber, formatCurrency, formatPercentage } = useLocalizedNumber();
  
  return (
    <div>
      <div data-testid="formatted-number">{formatNumber(1234.56)}</div>
      <div data-testid="formatted-currency">{formatCurrency(1234.56, 'USD')}</div>
      <div data-testid="formatted-percentage">{formatPercentage(75.5)}</div>
    </div>
  );
}

// Test component for file size formatting
function FileSizeFormattingTest() {
  const { formatFileSize } = useLocalizedFileSize();
  
  return (
    <div>
      <div data-testid="bytes">{formatFileSize(512)}</div>
      <div data-testid="kilobytes">{formatFileSize(1024)}</div>
      <div data-testid="megabytes">{formatFileSize(1048576)}</div>
      <div data-testid="gigabytes">{formatFileSize(1073741824)}</div>
    </div>
  );
}

// Helper function to render with locale
function renderWithLocale(Component: React.ComponentType, locale: string, messages: any) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Component />
    </NextIntlClientProvider>
  );
}

describe('Localized Date Formatting', () => {
  it('should format dates in English locale', () => {
    const { getByTestId } = renderWithLocale(DateFormattingTest, 'en', enMessages);
    
    const formattedDate = getByTestId('formatted-date');
    expect(formattedDate.textContent).toMatch(/01\/15\/2024/);
  });
  
  it('should format dates in Spanish locale', () => {
    const { getByTestId } = renderWithLocale(DateFormattingTest, 'es', esMessages);
    
    const formattedDate = getByTestId('formatted-date');
    expect(formattedDate.textContent).toMatch(/15\/01\/2024/);
  });
  
  it('should format dates in French locale', () => {
    const { getByTestId } = renderWithLocale(DateFormattingTest, 'fr', frMessages);
    
    const formattedDate = getByTestId('formatted-date');
    expect(formattedDate.textContent).toMatch(/15\/01\/2024/);
  });
  
  it('should format relative dates correctly', () => {
    const { getByTestId } = renderWithLocale(DateFormattingTest, 'en', enMessages);
    
    const relativeDate = getByTestId('relative-date');
    expect(relativeDate.textContent).toBe('Yesterday');
  });
});

describe('Localized Number Formatting', () => {
  it('should format numbers in English locale', () => {
    const { getByTestId } = renderWithLocale(NumberFormattingTest, 'en', enMessages);
    
    expect(getByTestId('formatted-number').textContent).toBe('1,234.56');
    expect(getByTestId('formatted-currency').textContent).toMatch(/\$1,234\.56/);
    expect(getByTestId('formatted-percentage').textContent).toBe('75.5%');
  });
  
  it('should format numbers in Spanish locale', () => {
    const { getByTestId } = renderWithLocale(NumberFormattingTest, 'es', esMessages);
    
    // Spanish locale might not use thousands separator for this number
    expect(getByTestId('formatted-number').textContent).toMatch(/1[.,\s]*234[.,]56/);
    expect(getByTestId('formatted-currency').textContent).toMatch(/1[.,\s]*234[.,]56/);
    expect(getByTestId('formatted-percentage').textContent).toMatch(/75[.,]5\s*%/);
  });
  
  it('should format numbers in French locale', () => {
    const { getByTestId } = renderWithLocale(NumberFormattingTest, 'fr', frMessages);
    
    expect(getByTestId('formatted-number').textContent).toMatch(/1[.,\s]234[.,]56/);
    expect(getByTestId('formatted-currency').textContent).toMatch(/1[.,\s]234[.,]56/);
    expect(getByTestId('formatted-percentage').textContent).toMatch(/75[.,]5\s*%/);
  });
});

describe('Localized File Size Formatting', () => {
  it('should format file sizes in English locale', () => {
    const { getByTestId } = renderWithLocale(FileSizeFormattingTest, 'en', enMessages);
    
    expect(getByTestId('bytes').textContent).toBe('512.0 B');
    expect(getByTestId('kilobytes').textContent).toBe('1.0 KB');
    expect(getByTestId('megabytes').textContent).toBe('1.0 MB');
    expect(getByTestId('gigabytes').textContent).toBe('1.0 GB');
  });
  
  it('should format file sizes in French locale', () => {
    const { getByTestId } = renderWithLocale(FileSizeFormattingTest, 'fr', frMessages);
    
    expect(getByTestId('bytes').textContent).toBe('512,0 o');
    expect(getByTestId('kilobytes').textContent).toBe('1,0 Ko');
    expect(getByTestId('megabytes').textContent).toBe('1,0 Mo');
    expect(getByTestId('gigabytes').textContent).toBe('1,0 Go');
  });
  
  it('should format file sizes in Arabic locale', () => {
    const { getByTestId } = renderWithLocale(FileSizeFormattingTest, 'ar', arMessages);
    
    expect(getByTestId('bytes').textContent).toBe('512.0 بايت');
    expect(getByTestId('kilobytes').textContent).toBe('1.0 كيلوبايت');
    expect(getByTestId('megabytes').textContent).toBe('1.0 ميجابايت');
    expect(getByTestId('gigabytes').textContent).toBe('1.0 جيجابايت');
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle zero file size', () => {
    function ZeroFileSizeTest() {
      const { formatFileSize } = useLocalizedFileSize();
      return <div data-testid="zero-size">{formatFileSize(0)}</div>;
    }
    
    const { getByTestId } = renderWithLocale(ZeroFileSizeTest, 'en', enMessages);
    expect(getByTestId('zero-size').textContent).toBe('0 B');
  });
  
  it('should handle very large file sizes', () => {
    function LargeFileSizeTest() {
      const { formatFileSize } = useLocalizedFileSize();
      const terabyte = 1024 * 1024 * 1024 * 1024;
      return <div data-testid="large-size">{formatFileSize(terabyte)}</div>;
    }
    
    const { getByTestId } = renderWithLocale(LargeFileSizeTest, 'en', enMessages);
    expect(getByTestId('large-size').textContent).toBe('1024.0 GB'); // 1TB = 1024 GB
  });
  
  it('should handle invalid dates gracefully', () => {
    function InvalidDateTest() {
      const { formatDate } = useLocalizedDate();
      const invalidDate = new Date('invalid');
      return <div data-testid="invalid-date">{formatDate(invalidDate)}</div>;
    }
    
    const { getByTestId } = renderWithLocale(InvalidDateTest, 'en', enMessages);
    // Should not throw an error, might show "Invalid Date" or similar
    expect(getByTestId('invalid-date')).toBeInTheDocument();
  });
  
  it('should handle negative numbers', () => {
    function NegativeNumberTest() {
      const { formatNumber, formatCurrency } = useLocalizedNumber();
      return (
        <div>
          <div data-testid="negative-number">{formatNumber(-1234.56)}</div>
          <div data-testid="negative-currency">{formatCurrency(-1234.56, 'USD')}</div>
        </div>
      );
    }
    
    const { getByTestId } = renderWithLocale(NegativeNumberTest, 'en', enMessages);
    expect(getByTestId('negative-number').textContent).toMatch(/-1,234\.56/);
    expect(getByTestId('negative-currency').textContent).toMatch(/-\$1,234\.56/);
  });
});