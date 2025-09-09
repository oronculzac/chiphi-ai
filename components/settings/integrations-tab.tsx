'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileSpreadsheet, FileText, Plus } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  comingSoon: boolean;
  tooltipText: string;
}

const integrations: Integration[] = [
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Automatically sync your transaction data to Google Sheets for advanced analysis and reporting.',
    icon: FileSpreadsheet,
    enabled: false,
    comingSoon: true,
    tooltipText: 'Google Sheets integration is currently in development. This will allow automatic syncing of your transaction data to spreadsheets.',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Export and organize your financial data in Notion databases with customizable templates.',
    icon: FileText,
    enabled: false,
    comingSoon: true,
    tooltipText: 'Notion integration is currently in development. This will enable exporting your data to Notion databases with rich formatting.',
  },
];

export default function IntegrationsTab() {
  const handleToggleChange = (integrationId: string, checked: boolean) => {
    // This will be implemented when integrations become functional
    console.log(`Toggle ${integrationId} to ${checked}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect ChiPhi AI with your favorite tools and services to streamline your financial workflow.
        </p>
      </div>

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Available Integrations
          </CardTitle>
          <CardDescription>
            Enable integrations to automatically sync your financial data with external services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {integrations.map((integration, index) => (
            <div key={integration.id}>
              <div className="flex items-start justify-between space-x-4">
                {/* Integration Info */}
                <div className="flex items-start space-x-3 flex-1">
                  <div className="flex-shrink-0 mt-1">
                    <integration.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground">
                        {integration.name}
                      </h3>
                      {integration.comingSoon && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {integration.description}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Switch
                          checked={integration.enabled}
                          disabled={integration.comingSoon}
                          onCheckedChange={(checked) => handleToggleChange(integration.id, checked)}
                          data-testid={`integration-toggle-${integration.id}`}
                          aria-label={`Toggle ${integration.name} integration`}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p>{integration.tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              
              {/* Separator between integrations (except last one) */}
              {index < integrations.length - 1 && (
                <Separator className="mt-6" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Future Integrations Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">More Integrations Coming Soon</CardTitle>
          <CardDescription>
            We&apos;re working on additional integrations to make your financial workflow even more seamless.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Planned integrations include:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Airtable - Organize data in flexible databases</li>
              <li>Zapier - Connect with hundreds of apps</li>
              <li>QuickBooks - Direct accounting software sync</li>
              <li>Slack - Get notifications in your workspace</li>
            </ul>
            <p className="mt-3 text-xs">
              Have a specific integration request? Contact our support team to let us know what you'd like to see next.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}