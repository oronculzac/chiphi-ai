'use client';

import { useTranslations } from 'next-intl';
import { useLocalizedDate, useLocalizedNumber, useLocalizedFileSize } from '@/lib/i18n/utils';

/**
 * Custom hook for settings-specific translations and formatting
 */
export function useSettingsTranslations() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('settings.common');
  const { formatDate, formatRelativeDate } = useLocalizedDate();
  const { formatNumber, formatCurrency, formatPercentage } = useLocalizedNumber();
  const { formatFileSize } = useLocalizedFileSize();

  return {
    // Translation functions
    t,
    tCommon,
    
    // Formatting functions
    formatDate,
    formatRelativeDate,
    formatNumber,
    formatCurrency,
    formatPercentage,
    formatFileSize,
    
    // Common translations
    common: {
      save: tCommon('save'),
      cancel: tCommon('cancel'),
      edit: tCommon('edit'),
      delete: tCommon('delete'),
      loading: tCommon('loading'),
      retry: tCommon('retry'),
      error: tCommon('error'),
      success: tCommon('success'),
      confirm: tCommon('confirm'),
      close: tCommon('close'),
      copy: tCommon('copy'),
      copied: tCommon('copied'),
      required: tCommon('required'),
      optional: tCommon('optional'),
      enabled: tCommon('enabled'),
      disabled: tCommon('disabled'),
    },
    
    // Tab translations
    tabs: {
      organization: t('tabs.organization'),
      inboundEmail: t('tabs.inboundEmail'),
      notifications: t('tabs.notifications'),
      data: t('tabs.data'),
      integrations: t('tabs.integrations'),
    },
    
    // Organization translations
    organization: {
      title: t('organization.title'),
      description: t('organization.description'),
      name: {
        label: t('organization.name.label'),
        placeholder: t('organization.name.placeholder'),
        required: t('organization.name.required'),
        maxLength: t('organization.name.maxLength'),
        saving: t('organization.name.saving'),
        saved: t('organization.name.saved'),
      },
      logo: {
        title: t('organization.logo.title'),
        description: t('organization.logo.description'),
        upload: t('organization.logo.upload'),
        remove: t('organization.logo.remove'),
        uploading: t('organization.logo.uploading'),
        uploaded: t('organization.logo.uploaded'),
        removed: t('organization.logo.removed'),
        error: t('organization.logo.error'),
        invalidType: t('organization.logo.invalidType'),
        tooLarge: (maxSize: string) => t('organization.logo.tooLarge', { maxSize }),
      },
      members: {
        title: t('organization.members.title'),
        description: t('organization.members.description'),
        invite: t('organization.members.invite'),
        email: t('organization.members.email'),
        role: t('organization.members.role'),
        joinedAt: t('organization.members.joinedAt'),
        actions: t('organization.members.actions'),
        roles: {
          owner: t('organization.members.roles.owner'),
          admin: t('organization.members.roles.admin'),
          member: t('organization.members.roles.member'),
        },
      },
    },
    
    // Inbound email translations
    inboundEmail: {
      title: t('inboundEmail.title'),
      description: t('inboundEmail.description'),
      alias: {
        title: t('inboundEmail.alias.title'),
        description: t('inboundEmail.alias.description'),
        copy: t('inboundEmail.alias.copy'),
        copied: t('inboundEmail.alias.copied'),
      },
      verification: {
        title: t('inboundEmail.verification.title'),
        description: t('inboundEmail.verification.description'),
        status: t('inboundEmail.verification.status'),
        lastReceived: t('inboundEmail.verification.lastReceived'),
        noEmails: t('inboundEmail.verification.noEmails'),
        getCode: t('inboundEmail.verification.getCode'),
        gettingCode: t('inboundEmail.verification.gettingCode'),
        verified: t('inboundEmail.verification.verified'),
        pending: t('inboundEmail.verification.pending'),
        codeReceived: (code: string) => t('inboundEmail.verification.codeReceived', { code }),
        codeExpires: (time: string) => t('inboundEmail.verification.codeExpires', { time }),
      },
    },
    
    // Notifications translations
    notifications: {
      title: t('notifications.title'),
      description: t('notifications.description'),
      types: {
        receiptProcessed: {
          label: t('notifications.types.receiptProcessed.label'),
          description: t('notifications.types.receiptProcessed.description'),
        },
        dailySummary: {
          label: t('notifications.types.dailySummary.label'),
          description: t('notifications.types.dailySummary.description'),
        },
        weeklySummary: {
          label: t('notifications.types.weeklySummary.label'),
          description: t('notifications.types.weeklySummary.description'),
        },
      },
      emails: {
        title: t('notifications.emails.title'),
        description: t('notifications.emails.description'),
        add: t('notifications.emails.add'),
        placeholder: t('notifications.emails.placeholder'),
        adding: t('notifications.emails.adding'),
        added: t('notifications.emails.added'),
        remove: t('notifications.emails.remove'),
        removing: t('notifications.emails.removing'),
        removed: t('notifications.emails.removed'),
        invalid: t('notifications.emails.invalid'),
        duplicate: t('notifications.emails.duplicate'),
      },
      saving: t('notifications.saving'),
      saved: t('notifications.saved'),
      error: t('notifications.error'),
    },
    
    // Data translations
    data: {
      title: t('data.title'),
      description: t('data.description'),
      export: {
        title: t('data.export.title'),
        description: t('data.export.description'),
        dateRange: {
          label: t('data.export.dateRange.label'),
          start: t('data.export.dateRange.start'),
          end: t('data.export.dateRange.end'),
          invalid: t('data.export.dateRange.invalid'),
        },
        format: {
          label: t('data.export.format.label'),
          csv: t('data.export.format.csv'),
          ynab: t('data.export.format.ynab'),
        },
        buttons: {
          csv: t('data.export.buttons.csv'),
          ynab: t('data.export.buttons.ynab'),
          exporting: t('data.export.buttons.exporting'),
          exported: t('data.export.buttons.exported'),
        },
      },
      dangerZone: {
        title: t('data.dangerZone.title'),
        description: t('data.dangerZone.description'),
        deleteAccount: {
          title: t('data.dangerZone.deleteAccount.title'),
          description: t('data.dangerZone.deleteAccount.description'),
          button: t('data.dangerZone.deleteAccount.button'),
          dialog: {
            title: t('data.dangerZone.deleteAccount.dialog.title'),
            description: t('data.dangerZone.deleteAccount.dialog.description'),
            warning: (organizationName: string) => 
              t('data.dangerZone.deleteAccount.dialog.warning', { organizationName }),
            placeholder: t('data.dangerZone.deleteAccount.dialog.placeholder'),
            mismatch: t('data.dangerZone.deleteAccount.dialog.mismatch'),
            confirm: t('data.dangerZone.deleteAccount.dialog.confirm'),
            cancel: t('data.dangerZone.deleteAccount.dialog.cancel'),
            deleting: t('data.dangerZone.deleteAccount.dialog.deleting'),
            deleted: t('data.dangerZone.deleteAccount.dialog.deleted'),
          },
        },
      },
    },
    
    // Integrations translations
    integrations: {
      title: t('integrations.title'),
      description: t('integrations.description'),
      comingSoon: t('integrations.comingSoon'),
      googleSheets: {
        title: t('integrations.googleSheets.title'),
        description: t('integrations.googleSheets.description'),
        tooltip: t('integrations.googleSheets.tooltip'),
      },
      notion: {
        title: t('integrations.notion.title'),
        description: t('integrations.notion.description'),
        tooltip: t('integrations.notion.tooltip'),
      },
    },
  };
}