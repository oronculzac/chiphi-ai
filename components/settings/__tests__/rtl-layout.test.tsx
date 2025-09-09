import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider, useLocaleInfo } from '@/components/providers/locale-provider';
import arMessages from '@/messages/ar.json';
import enMessages from '@/messages/en.json';

// Test component that uses locale info
function RTLTestComponent() {
  const { isRTL, dir } = useLocaleInfo();
  
  return (
    <div data-testid="container" dir={dir} className={isRTL ? 'rtl' : 'ltr'}>
      <div data-testid="direction-indicator">
        Direction: {dir}
      </div>
      <div data-testid="rtl-indicator">
        Is RTL: {isRTL ? 'true' : 'false'}
      </div>
      <button 
        data-testid="button-with-icon" 
        className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <span className={isRTL ? 'ml-2' : 'mr-2'}>Icon</span>
        <span>Button Text</span>
      </button>
    </div>
  );
}

// Helper function to render with locale provider
function renderWithLocaleProvider(locale: string, messages: any) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleProvider messages={messages} locale={locale}>
        <RTLTestComponent />
      </LocaleProvider>
    </NextIntlClientProvider>
  );
}

describe('RTL Layout Support', () => {
  describe('Arabic (RTL) Layout', () => {
    it('should detect Arabic as RTL language', () => {
      renderWithLocaleProvider('ar', arMessages);
      
      const container = screen.getByTestId('container');
      const directionIndicator = screen.getByTestId('direction-indicator');
      const rtlIndicator = screen.getByTestId('rtl-indicator');
      
      expect(container).toHaveAttribute('dir', 'rtl');
      expect(container).toHaveClass('rtl');
      expect(directionIndicator).toHaveTextContent('Direction: rtl');
      expect(rtlIndicator).toHaveTextContent('Is RTL: true');
    });
    
    it('should apply RTL-specific CSS classes', () => {
      renderWithLocaleProvider('ar', arMessages);
      
      const buttonWithIcon = screen.getByTestId('button-with-icon');
      expect(buttonWithIcon).toHaveClass('flex-row-reverse');
    });
    
    it('should use RTL-appropriate spacing classes', () => {
      renderWithLocaleProvider('ar', arMessages);
      
      const iconSpan = screen.getByText('Icon');
      expect(iconSpan).toHaveClass('ml-2');
      expect(iconSpan).not.toHaveClass('mr-2');
    });
  });
  
  describe('English (LTR) Layout', () => {
    it('should detect English as LTR language', () => {
      renderWithLocaleProvider('en', enMessages);
      
      const container = screen.getByTestId('container');
      const directionIndicator = screen.getByTestId('direction-indicator');
      const rtlIndicator = screen.getByTestId('rtl-indicator');
      
      expect(container).toHaveAttribute('dir', 'ltr');
      expect(container).toHaveClass('ltr');
      expect(directionIndicator).toHaveTextContent('Direction: ltr');
      expect(rtlIndicator).toHaveTextContent('Is RTL: false');
    });
    
    it('should apply LTR-specific CSS classes', () => {
      renderWithLocaleProvider('en', enMessages);
      
      const buttonWithIcon = screen.getByTestId('button-with-icon');
      expect(buttonWithIcon).toHaveClass('flex-row');
      expect(buttonWithIcon).not.toHaveClass('flex-row-reverse');
    });
    
    it('should use LTR-appropriate spacing classes', () => {
      renderWithLocaleProvider('en', enMessages);
      
      const iconSpan = screen.getByText('Icon');
      expect(iconSpan).toHaveClass('mr-2');
      expect(iconSpan).not.toHaveClass('ml-2');
    });
  });
});

describe('Locale Info Hook', () => {
  it('should provide correct locale information for RTL languages', () => {
    let hookResult: any;
    
    function TestHook() {
      hookResult = useLocaleInfo();
      return null;
    }
    
    render(
      <NextIntlClientProvider locale="ar" messages={arMessages}>
        <LocaleProvider messages={arMessages} locale="ar">
          <TestHook />
        </LocaleProvider>
      </NextIntlClientProvider>
    );
    
    expect(hookResult.locale).toBe('ar');
    expect(hookResult.isRTL).toBe(true);
    expect(hookResult.dir).toBe('rtl');
  });
  
  it('should provide correct locale information for LTR languages', () => {
    let hookResult: any;
    
    function TestHook() {
      hookResult = useLocaleInfo();
      return null;
    }
    
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LocaleProvider messages={enMessages} locale="en">
          <TestHook />
        </LocaleProvider>
      </NextIntlClientProvider>
    );
    
    expect(hookResult.locale).toBe('en');
    expect(hookResult.isRTL).toBe(false);
    expect(hookResult.dir).toBe('ltr');
  });
});