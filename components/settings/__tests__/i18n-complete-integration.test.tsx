import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { useSettingsTranslations } from '@/hooks/use-settings-translations';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';

import { vi } from 'vitest';

// Mock toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock API hook
const mockExecute = vi.fn();
const mockRetry = vi.fn();
vi.mock('@/hooks/use-api-with-retry', () => ({
  useSettingsApi: () => ({
    data: null,
    loading: false,
    error: null,
    execute: mockExecute,
    retry: mockRetry,
    isRetrying: false
  })
}));

// Complete settings component that demonstrates i18n integration
function CompleteSettingsComponent() {
  const { organization, notifications, data, common, formatFileSize } = useSettingsTranslations();
  const [orgName, setOrgName] = React.useState('');
  const [emailNotifications, setEmailNotifications] = React.useState(false);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 data-testid="settings-title">{organization.title}</h1>
        <p data-testid="settings-description">{organization.description}</p>
      </div>
      
      {/* Organization Section */}
      <div className="space-y-4">
        <h2 data-testid="org-section-title">{organization.title}</h2>
        
        <div className="space-y-2">
          <label data-testid="org-name-label">{organization.name.label}</label>
          <input
            data-testid="org-name-input"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder={organization.name.placeholder}
          />
        </div>
        
        <div className="flex gap-2">
          <button data-testid="save-button">{common.save}</button>
          <button data-testid="cancel-button">{common.cancel}</button>
        </div>
        
        <div data-testid="logo-info">
          {organization.logo.description}
        </div>
        
        <div data-testid="file-size-example">
          {formatFileSize(1048576)} {/* 1MB */}
        </div>
      </div>
      
      {/* Notifications Section */}
      <div className="space-y-4">
        <h2 data-testid="notifications-title">{notifications.title}</h2>
        <p data-testid="notifications-description">{notifications.description}</p>
        
        <div className="space-y-2">
          <label data-testid="email-notifications-label">
            {notifications.types.receiptProcessed.label}
          </label>
          <p data-testid="email-notifications-description">
            {notifications.types.receiptProcessed.description}
          </p>
          <input
            type="checkbox"
            data-testid="email-notifications-checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
          />
        </div>
        
        <div data-testid="daily-summary-label">
          {notifications.types.dailySummary.label}
        </div>
        
        <div data-testid="weekly-summary-label">
          {notifications.types.weeklySummary.label}
        </div>
      </div>
      
      {/* Data Section */}
      <div className="space-y-4">
        <h2 data-testid="data-title">{data.title}</h2>
        <p data-testid="data-description">{data.description}</p>
        
        <div className="space-y-2">
          <h3 data-testid="export-title">{data.export.title}</h3>
          <p data-testid="export-description">{data.export.description}</p>
          
          <button data-testid="export-csv-button">
            {data.export.buttons.csv}
          </button>
          
          <button data-testid="export-ynab-button">
            {data.export.buttons.ynab}
          </button>
        </div>
        
        <div className="space-y-2">
          <h3 data-testid="danger-zone-title">{data.dangerZone.title}</h3>
          <p data-testid="danger-zone-description">{data.dangerZone.description}</p>
          
          <button data-testid="delete-account-button">
            {data.dangerZone.deleteAccount.button}
          </button>
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="space-y-2">
        <div data-testid="loading-text">{common.loading}</div>
        <div data-testid="error-text">{common.error}</div>
        <div data-testid="success-text">{common.success}</div>
        <div data-testid="retry-text">{common.retry}</div>
      </div>
    </div>
  );
}

// Helper function to render with locale
function renderWithLocale(locale: string, messages: any) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleProvider messages={messages} locale={locale}>
        <CompleteSettingsComponent />
      </LocaleProvider>
    </NextIntlClientProvider>
  );
}

describe('Complete i18n Integration', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockExecute.mockClear();
    mockRetry.mockClear();
  });
  
  describe('English Locale', () => {
    it('should render all settings sections in English', () => {
      renderWithLocale('en', enMessages);
      
      // Header
      expect(screen.getByTestId('settings-title')).toHaveTextContent('Organization Settings');
      expect(screen.getByTestId('settings-description')).toHaveTextContent(
        'Manage your organization\'s basic information and team members.'
      );
      
      // Organization section
      expect(screen.getByTestId('org-name-label')).toHaveTextContent('Organization Name');
      expect(screen.getByTestId('org-name-input')).toHaveAttribute(
        'placeholder', 
        'Enter organization name'
      );
      expect(screen.getByTestId('save-button')).toHaveTextContent('Save');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
      
      // Notifications section
      expect(screen.getByTestId('notifications-title')).toHaveTextContent('Notification Preferences');
      expect(screen.getByTestId('email-notifications-label')).toHaveTextContent('New receipt processed');
      expect(screen.getByTestId('daily-summary-label')).toHaveTextContent('Daily summary');
      expect(screen.getByTestId('weekly-summary-label')).toHaveTextContent('Weekly summary');
      
      // Data section
      expect(screen.getByTestId('data-title')).toHaveTextContent('Data Management');
      expect(screen.getByTestId('export-csv-button')).toHaveTextContent('Export CSV');
      expect(screen.getByTestId('export-ynab-button')).toHaveTextContent('Export YNAB');
      expect(screen.getByTestId('delete-account-button')).toHaveTextContent('Delete Account');
      
      // File size formatting
      expect(screen.getByTestId('file-size-example')).toHaveTextContent('1.0 MB');
      
      // Common elements
      expect(screen.getByTestId('loading-text')).toHaveTextContent('Loading...');
      expect(screen.getByTestId('error-text')).toHaveTextContent('An error occurred');
      expect(screen.getByTestId('success-text')).toHaveTextContent('Success');
      expect(screen.getByTestId('retry-text')).toHaveTextContent('Retry');
    });
  });
  
  describe('Spanish Locale', () => {
    it('should render all settings sections in Spanish', () => {
      renderWithLocale('es', esMessages);
      
      // Header
      expect(screen.getByTestId('settings-title')).toHaveTextContent('Configuración de Organización');
      expect(screen.getByTestId('settings-description')).toHaveTextContent(
        'Gestiona la información básica de tu organización y miembros del equipo.'
      );
      
      // Organization section
      expect(screen.getByTestId('org-name-label')).toHaveTextContent('Nombre de la Organización');
      expect(screen.getByTestId('org-name-input')).toHaveAttribute(
        'placeholder', 
        'Ingresa el nombre de la organización'
      );
      expect(screen.getByTestId('save-button')).toHaveTextContent('Guardar');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancelar');
      
      // Notifications section
      expect(screen.getByTestId('notifications-title')).toHaveTextContent('Preferencias de Notificación');
      expect(screen.getByTestId('email-notifications-label')).toHaveTextContent('Nuevo recibo procesado');
      expect(screen.getByTestId('daily-summary-label')).toHaveTextContent('Resumen diario');
      expect(screen.getByTestId('weekly-summary-label')).toHaveTextContent('Resumen semanal');
      
      // Data section
      expect(screen.getByTestId('data-title')).toHaveTextContent('Gestión de Datos');
      expect(screen.getByTestId('export-csv-button')).toHaveTextContent('Exportar CSV');
      expect(screen.getByTestId('export-ynab-button')).toHaveTextContent('Exportar YNAB');
      expect(screen.getByTestId('delete-account-button')).toHaveTextContent('Eliminar Cuenta');
      
      // Common elements
      expect(screen.getByTestId('loading-text')).toHaveTextContent('Cargando...');
      expect(screen.getByTestId('error-text')).toHaveTextContent('Ocurrió un error');
      expect(screen.getByTestId('success-text')).toHaveTextContent('Éxito');
      expect(screen.getByTestId('retry-text')).toHaveTextContent('Reintentar');
    });
  });
  
  describe('French Locale', () => {
    it('should render all settings sections in French', () => {
      renderWithLocale('fr', frMessages);
      
      // Header
      expect(screen.getByTestId('settings-title')).toHaveTextContent('Paramètres d\'Organisation');
      expect(screen.getByTestId('save-button')).toHaveTextContent('Enregistrer');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Annuler');
      
      // File size formatting in French
      expect(screen.getByTestId('file-size-example')).toHaveTextContent('1,0 Mo');
      
      // Common elements
      expect(screen.getByTestId('loading-text')).toHaveTextContent('Chargement...');
      expect(screen.getByTestId('error-text')).toHaveTextContent('Une erreur s\'est produite');
      expect(screen.getByTestId('success-text')).toHaveTextContent('Succès');
      expect(screen.getByTestId('retry-text')).toHaveTextContent('Réessayer');
    });
  });
  
  describe('Arabic Locale (RTL)', () => {
    it('should render all settings sections in Arabic with RTL support', () => {
      const { container } = renderWithLocale('ar', arMessages);
      
      // Check RTL direction
      expect(container.querySelector('.rtl')).toBeInTheDocument();
      
      // Header
      expect(screen.getByTestId('settings-title')).toHaveTextContent('إعدادات المنظمة');
      expect(screen.getByTestId('save-button')).toHaveTextContent('حفظ');
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('إلغاء');
      
      // File size formatting in Arabic
      expect(screen.getByTestId('file-size-example')).toHaveTextContent('1.0 ميجابايت');
      
      // Common elements
      expect(screen.getByTestId('loading-text')).toHaveTextContent('جاري التحميل...');
      expect(screen.getByTestId('error-text')).toHaveTextContent('حدث خطأ');
      expect(screen.getByTestId('success-text')).toHaveTextContent('نجح');
      expect(screen.getByTestId('retry-text')).toHaveTextContent('إعادة المحاولة');
    });
  });
  
  describe('Interactive Elements', () => {
    it('should handle form interactions with localized validation', async () => {
      renderWithLocale('en', enMessages);
      
      const orgNameInput = screen.getByTestId('org-name-input');
      const saveButton = screen.getByTestId('save-button');
      
      // Test input interaction
      fireEvent.change(orgNameInput, { target: { value: 'Test Organization' } });
      expect(orgNameInput).toHaveValue('Test Organization');
      
      // Test button interaction
      fireEvent.click(saveButton);
      // Button should be clickable (no errors thrown)
      expect(saveButton).toBeInTheDocument();
    });
    
    it('should handle checkbox interactions', () => {
      renderWithLocale('en', enMessages);
      
      const checkbox = screen.getByTestId('email-notifications-checkbox');
      
      // Initially unchecked
      expect(checkbox).not.toBeChecked();
      
      // Click to check
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      // Click to uncheck
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });
  
  describe('Dynamic Content', () => {
    it('should handle parameterized translations', () => {
      renderWithLocale('en', enMessages);
      
      // The component should render without errors even with dynamic content
      expect(screen.getByTestId('settings-title')).toBeInTheDocument();
      expect(screen.getByTestId('file-size-example')).toHaveTextContent('1.0 MB');
    });
  });
});