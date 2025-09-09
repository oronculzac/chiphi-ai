import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useSettingsTranslations } from '@/hooks/use-settings-translations';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';

// Test component that uses the settings translations hook
function TestComponent() {
  const { organization, common, tabs } = useSettingsTranslations();
  
  return (
    <div>
      <h1 data-testid="organization-title">{organization.title}</h1>
      <p data-testid="organization-description">{organization.description}</p>
      <button data-testid="save-button">{common.save}</button>
      <button data-testid="cancel-button">{common.cancel}</button>
      <span data-testid="organization-tab">{tabs.organization}</span>
      <span data-testid="notifications-tab">{tabs.notifications}</span>
    </div>
  );
}

// Helper function to render with locale
function renderWithLocale(locale: string, messages: any) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TestComponent />
    </NextIntlClientProvider>
  );
}

describe('Settings i18n Integration', () => {
  describe('English (en)', () => {
    it('should display English text correctly', () => {
      renderWithLocale('en', enMessages);
      
      expect(screen.getByTestId('organization-title')).toHaveTextContent('Organization Settings');
      expect(screen.getByTestId('organization-description')).toHaveTextContent(
        'Manage your organization\'s basic information and team members.'
      );
      expect(screen.getByTestId('save-button')).toHaveTextContent('Save');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
      expect(screen.getByTestId('organization-tab')).toHaveTextContent('Organization');
      expect(screen.getByTestId('notifications-tab')).toHaveTextContent('Notifications');
    });
  });

  describe('Spanish (es)', () => {
    it('should display Spanish text correctly', () => {
      renderWithLocale('es', esMessages);
      
      expect(screen.getByTestId('organization-title')).toHaveTextContent('Configuración de Organización');
      expect(screen.getByTestId('organization-description')).toHaveTextContent(
        'Gestiona la información básica de tu organización y miembros del equipo.'
      );
      expect(screen.getByTestId('save-button')).toHaveTextContent('Guardar');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancelar');
      expect(screen.getByTestId('organization-tab')).toHaveTextContent('Organización');
      expect(screen.getByTestId('notifications-tab')).toHaveTextContent('Notificaciones');
    });
  });

  describe('French (fr)', () => {
    it('should display French text correctly', () => {
      renderWithLocale('fr', frMessages);
      
      expect(screen.getByTestId('organization-title')).toHaveTextContent('Paramètres d\'Organisation');
      expect(screen.getByTestId('organization-description')).toHaveTextContent(
        'Gérez les informations de base de votre organisation et les membres de l\'équipe.'
      );
      expect(screen.getByTestId('save-button')).toHaveTextContent('Enregistrer');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Annuler');
      expect(screen.getByTestId('organization-tab')).toHaveTextContent('Organisation');
      expect(screen.getByTestId('notifications-tab')).toHaveTextContent('Notifications');
    });
  });

  describe('Arabic (ar) - RTL Support', () => {
    it('should display Arabic text correctly', () => {
      renderWithLocale('ar', arMessages);
      
      expect(screen.getByTestId('organization-title')).toHaveTextContent('إعدادات المنظمة');
      expect(screen.getByTestId('organization-description')).toHaveTextContent(
        'إدارة المعلومات الأساسية لمنظمتك وأعضاء الفريق.'
      );
      expect(screen.getByTestId('save-button')).toHaveTextContent('حفظ');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('إلغاء');
      expect(screen.getByTestId('organization-tab')).toHaveTextContent('المنظمة');
      expect(screen.getByTestId('notifications-tab')).toHaveTextContent('الإشعارات');
    });
  });
});

describe('Settings Translation Hook', () => {
  it('should provide all required translation functions', () => {
    let hookResult: any;
    
    function TestHook() {
      hookResult = useSettingsTranslations();
      return null;
    }
    
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TestHook />
      </NextIntlClientProvider>
    );
    
    // Check that all expected properties exist
    expect(hookResult).toHaveProperty('t');
    expect(hookResult).toHaveProperty('tCommon');
    expect(hookResult).toHaveProperty('formatDate');
    expect(hookResult).toHaveProperty('formatFileSize');
    expect(hookResult).toHaveProperty('common');
    expect(hookResult).toHaveProperty('tabs');
    expect(hookResult).toHaveProperty('organization');
    expect(hookResult).toHaveProperty('inboundEmail');
    expect(hookResult).toHaveProperty('notifications');
    expect(hookResult).toHaveProperty('data');
    expect(hookResult).toHaveProperty('integrations');
    
    // Check common translations
    expect(hookResult.common.save).toBe('Save');
    expect(hookResult.common.cancel).toBe('Cancel');
    expect(hookResult.common.edit).toBe('Edit');
    expect(hookResult.common.delete).toBe('Delete');
    
    // Check organization translations
    expect(hookResult.organization.title).toBe('Organization Settings');
    expect(hookResult.organization.name.label).toBe('Organization Name');
    expect(hookResult.organization.name.placeholder).toBe('Enter organization name');
  });
});

describe('Localized Formatting', () => {
  it('should format file sizes correctly', () => {
    let hookResult: any;
    
    function TestHook() {
      hookResult = useSettingsTranslations();
      return null;
    }
    
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TestHook />
      </NextIntlClientProvider>
    );
    
    expect(hookResult.formatFileSize(1024)).toBe('1.0 KB');
    expect(hookResult.formatFileSize(1048576)).toBe('1.0 MB');
    expect(hookResult.formatFileSize(1073741824)).toBe('1.0 GB');
  });
  
  it('should format file sizes in French locale', () => {
    let hookResult: any;
    
    function TestHook() {
      hookResult = useSettingsTranslations();
      return null;
    }
    
    render(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <TestHook />
      </NextIntlClientProvider>
    );
    
    expect(hookResult.formatFileSize(1024)).toBe('1,0 Ko');
    expect(hookResult.formatFileSize(1048576)).toBe('1,0 Mo');
    expect(hookResult.formatFileSize(1073741824)).toBe('1,0 Go');
  });
});

describe('Dynamic Content Localization', () => {
  it('should handle parameterized translations', () => {
    let hookResult: any;
    
    function TestHook() {
      hookResult = useSettingsTranslations();
      return null;
    }
    
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TestHook />
      </NextIntlClientProvider>
    );
    
    expect(hookResult.organization.logo.tooLarge('5MB')).toBe('File size must be less than 5MB');
    expect(hookResult.data.dangerZone.deleteAccount.dialog.warning('Test Org')).toBe(
      'To confirm, type your organization name: Test Org'
    );
  });
});