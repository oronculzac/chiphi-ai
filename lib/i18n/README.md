# Internationalization (i18n) System

This document describes the internationalization system implemented for the ChiPhi AI settings components.

## Overview

The i18n system provides:
- Multi-language support for 7 languages (English, Spanish, French, German, Japanese, Chinese, Arabic)
- RTL (Right-to-Left) layout support for Arabic
- Localized formatting for dates, numbers, and file sizes
- Dynamic content localization with parameterized translations
- Comprehensive testing coverage

## Supported Languages

| Language | Code | Direction | Status |
|----------|------|-----------|--------|
| English | `en` | LTR | Complete |
| Spanish | `es` | LTR | Complete |
| French | `fr` | LTR | Complete |
| German | `de` | LTR | Partial |
| Japanese | `ja` | LTR | Partial |
| Chinese | `zh` | LTR | Partial |
| Arabic | `ar` | RTL | Complete |

## Architecture

### Core Files

- `lib/i18n/config.ts` - Main configuration and locale setup
- `lib/i18n/utils.ts` - Localization utility functions
- `messages/[locale].json` - Translation files for each language
- `components/providers/locale-provider.tsx` - React provider for locale context
- `hooks/use-settings-translations.ts` - Custom hook for settings translations
- `middleware.ts` - Next.js middleware for locale detection
- `styles/rtl.css` - RTL layout styles

### Translation Structure

Translation files are organized hierarchically:

```json
{
  "settings": {
    "title": "Settings",
    "tabs": {
      "organization": "Organization",
      "notifications": "Notifications"
    },
    "organization": {
      "name": {
        "label": "Organization Name",
        "placeholder": "Enter organization name"
      }
    }
  }
}
```

## Usage

### Basic Translation Hook

```typescript
import { useSettingsTranslations } from '@/hooks/use-settings-translations';

function MyComponent() {
  const { organization, common, formatFileSize } = useSettingsTranslations();
  
  return (
    <div>
      <h1>{organization.title}</h1>
      <button>{common.save}</button>
      <span>{formatFileSize(1048576)}</span> {/* 1.0 MB */}
    </div>
  );
}
```

### RTL Support

```typescript
import { useLocaleInfo } from '@/components/providers/locale-provider';

function MyComponent() {
  const { isRTL, dir } = useLocaleInfo();
  
  return (
    <div dir={dir} className={isRTL ? 'rtl' : 'ltr'}>
      <button className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className={isRTL ? 'ml-2' : 'mr-2'}>Icon</span>
        <span>Button Text</span>
      </button>
    </div>
  );
}
```

### Localized Formatting

```typescript
import { useLocalizedDate, useLocalizedNumber, useLocalizedFileSize } from '@/lib/i18n/utils';

function FormattingExample() {
  const { formatDate } = useLocalizedDate();
  const { formatCurrency } = useLocalizedNumber();
  const { formatFileSize } = useLocalizedFileSize();
  
  return (
    <div>
      <div>{formatDate(new Date())}</div>
      <div>{formatCurrency(1234.56, 'USD')}</div>
      <div>{formatFileSize(1048576)}</div>
    </div>
  );
}
```

### Parameterized Translations

```typescript
function ParameterizedExample() {
  const { organization } = useSettingsTranslations();
  
  return (
    <div>
      {/* Simple parameter */}
      <div>{organization.logo.tooLarge('5MB')}</div>
      
      {/* Multiple parameters */}
      <div>{organization.members.removeDialog.description('John Doe')}</div>
    </div>
  );
}
```

## Adding New Languages

1. Create a new translation file in `messages/[locale].json`
2. Add the locale to the `locales` array in `lib/i18n/config.ts`
3. If RTL, add to `rtlLocales` array
4. Add date-fns locale import in `lib/i18n/utils.ts`
5. Configure number and file size formats in `lib/i18n/config.ts`
6. Add tests for the new locale

## Adding New Translations

1. Add the key to the English translation file (`messages/en.json`)
2. Add corresponding translations to all other language files
3. Update the `useSettingsTranslations` hook if needed
4. Add tests for the new translations

## RTL Layout Guidelines

### CSS Classes

The RTL system automatically applies these classes:

- `.rtl` - Applied to RTL containers
- `.rtl .flex` - Reverses flex direction
- `.rtl .mr-2` / `.rtl .ml-2` - Swaps margins
- `.rtl .text-left` / `.rtl .text-right` - Swaps text alignment

### Component Guidelines

1. Use conditional classes based on `isRTL`:
   ```typescript
   className={isRTL ? 'ml-2' : 'mr-2'}
   ```

2. Reverse flex layouts for RTL:
   ```typescript
   className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
   ```

3. Set `dir` attribute on containers:
   ```typescript
   <div dir={dir}>
   ```

## Testing

### Running i18n Tests

```bash
# Run all i18n tests
npm run test:unit -- --run components/settings/__tests__/i18n-*.test.tsx

# Run specific test suites
npm run test:unit -- --run components/settings/__tests__/i18n-integration.test.tsx
npm run test:unit -- --run components/settings/__tests__/rtl-layout.test.tsx
npm run test:unit -- --run components/settings/__tests__/localized-formatting.test.tsx
```

### Test Coverage

The test suite covers:
- Translation rendering in all supported languages
- RTL layout behavior
- Localized formatting (dates, numbers, file sizes)
- Parameterized translations
- Interactive elements with localized content
- Error handling and edge cases

## Configuration

### Next.js Configuration

The system uses `next-intl` with the following configuration in `next.config.mjs`:

```javascript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/config.ts');

export default withNextIntl(nextConfig);
```

### Middleware

Locale detection and routing is handled by `middleware.ts`:

```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: true,
});
```

## Performance Considerations

1. **Bundle Splitting**: Translation files are loaded dynamically
2. **Memoization**: Formatting functions are memoized
3. **Lazy Loading**: Components use dynamic imports where appropriate
4. **Caching**: Formatted values are cached when possible

## Accessibility

The i18n system includes accessibility features:

1. **Screen Reader Support**: Proper `lang` attributes
2. **Keyboard Navigation**: RTL-aware focus management
3. **High Contrast**: Compatible with high contrast modes
4. **Reduced Motion**: Respects user motion preferences

## Troubleshooting

### Common Issues

1. **Missing Translations**: Check that all language files have the required keys
2. **RTL Layout Issues**: Ensure proper CSS classes and `dir` attributes
3. **Date Formatting Errors**: Verify date-fns locale imports
4. **Test Failures**: Check React imports in test files

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
NEXT_INTL_DEBUG=true
```

## Future Enhancements

1. **Additional Languages**: Korean, Portuguese, Italian
2. **Pluralization**: Enhanced plural form support
3. **Context-Aware Translations**: Gender-specific translations
4. **Translation Management**: Integration with translation services
5. **Performance**: Further optimization of bundle sizes