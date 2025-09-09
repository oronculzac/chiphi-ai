'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsTabErrorBoundary } from '@/components/settings/error-boundary';
import OrganizationTab from '@/components/settings/organization-tab';
import InboundEmailTab from '@/components/settings/inbound-email-tab';
import NotificationsTab from '@/components/settings/notifications-tab';
import DataTab from '@/components/settings/data-tab';
import IntegrationsTab from '@/components/settings/integrations-tab';

interface SettingsPageContentProps {
  searchParams: {
    tab?: string;
  };
}

const VALID_TABS = [
  'organization',
  'inbound-email',
  'notifications',
  'data',
  'integrations',
] as const;

type ValidTab = typeof VALID_TABS[number];

const DEFAULT_TAB: ValidTab = 'organization';

export function SettingsPageContent({ searchParams }: SettingsPageContentProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  
  // Get current tab from URL or default
  const currentTab = (searchParams.tab && VALID_TABS.includes(searchParams.tab as ValidTab)) 
    ? (searchParams.tab as ValidTab)
    : DEFAULT_TAB;

  const [activeTab, setActiveTab] = useState<ValidTab>(currentTab);

  // Update URL when tab changes
  const handleTabChange = useCallback((value: string) => {
    const newTab = value as ValidTab;
    setActiveTab(newTab);
    
    // Update URL for deep linking
    const params = new URLSearchParams(urlSearchParams.toString());
    if (newTab === DEFAULT_TAB) {
      params.delete('tab');
    } else {
      params.set('tab', newTab);
    }
    
    const queryString = params.toString();
    const newUrl = queryString ? `/settings?${queryString}` : '/settings';
    router.push(newUrl, { scroll: false });
  }, [router, urlSearchParams]);

  // Sync activeTab with URL changes
  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Tab Navigation */}
        <div className="border-b border-border px-8">
          <div className="w-full">
            {/* Mobile: Scrollable tabs */}
            <div className="block md:hidden">
              <TabsList className="w-full bg-transparent h-auto p-0 flex overflow-x-auto">
                <TabsTrigger 
                  value="organization" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-3 font-medium text-xs whitespace-nowrap flex-shrink-0"
                >
                  Organization
                </TabsTrigger>
                <TabsTrigger 
                  value="inbound-email"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-3 font-medium text-xs whitespace-nowrap flex-shrink-0"
                >
                  Email
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-3 font-medium text-xs whitespace-nowrap flex-shrink-0"
                >
                  Notifications
                </TabsTrigger>
                <TabsTrigger 
                  value="data"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-3 font-medium text-xs whitespace-nowrap flex-shrink-0"
                >
                  Data
                </TabsTrigger>
                <TabsTrigger 
                  value="integrations"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-3 py-3 font-medium text-xs whitespace-nowrap flex-shrink-0"
                >
                  Integrations
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Desktop: Full width tabs */}
            <div className="hidden md:block">
              <TabsList className="w-fit bg-transparent h-auto p-0 flex">
                <TabsTrigger 
                  value="organization" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-sm"
                >
                  Organization
                </TabsTrigger>
                <TabsTrigger 
                  value="inbound-email"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-sm"
                >
                  Inbound Email
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-sm"
                >
                  Notifications
                </TabsTrigger>
                <TabsTrigger 
                  value="data"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-sm"
                >
                  Data
                </TabsTrigger>
                <TabsTrigger 
                  value="integrations"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-3 font-medium text-sm"
                >
                  Integrations
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-8 py-6">
          <TabsContent value="organization" className="mt-0">
            <SettingsTabErrorBoundary tabName="Organization">
              <OrganizationTab />
            </SettingsTabErrorBoundary>
          </TabsContent>
          
          <TabsContent value="inbound-email" className="mt-0">
            <SettingsTabErrorBoundary tabName="Inbound Email">
              <InboundEmailTab />
            </SettingsTabErrorBoundary>
          </TabsContent>
          
          <TabsContent value="notifications" className="mt-0">
            <SettingsTabErrorBoundary tabName="Notifications">
              <NotificationsTab />
            </SettingsTabErrorBoundary>
          </TabsContent>
          
          <TabsContent value="data" className="mt-0">
            <SettingsTabErrorBoundary tabName="Data">
              <DataTab />
            </SettingsTabErrorBoundary>
          </TabsContent>
          
          <TabsContent value="integrations" className="mt-0">
            <SettingsTabErrorBoundary tabName="Integrations">
              <IntegrationsTab />
            </SettingsTabErrorBoundary>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}