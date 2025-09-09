import { Suspense } from 'react';
import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { SettingsPageLoading } from '@/components/settings/settings-page-loading';
import { SettingsPageError } from '@/components/settings/settings-page-error';

// Dynamic import for settings content to implement lazy loading
const SettingsPageContent = dynamic(
  () => import('@/components/settings/settings-page-content').then(mod => ({ default: mod.SettingsPageContent })),
  {
    loading: () => <SettingsPageLoading />,
  }
);

export const metadata: Metadata = {
  title: 'Settings - AI Receipts Dashboard',
  description: 'Manage your organization, email configuration, notifications, and data preferences for ChiPhi AI.',
  keywords: ['settings', 'organization', 'email', 'notifications', 'data', 'integrations'],
  openGraph: {
    title: 'Settings - AI Receipts Dashboard',
    description: 'Configure your ChiPhi AI experience with comprehensive settings management',
    type: 'website',
  },
};

interface SettingsPageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = await searchParams;
  
  return (
    <div className="space-y-6">
      <div className="px-8 pt-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your organization, email configuration, notifications, and data preferences.
        </p>
      </div>
      
      {/* Settings Content with Error Boundary */}
      <Suspense fallback={<SettingsPageLoading />}>
        <SettingsPageError>
          <SettingsPageContent searchParams={resolvedSearchParams} />
        </SettingsPageError>
      </Suspense>
    </div>
  );
}