'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, Filter, ArrowRight } from 'lucide-react';

interface GmailSetupSectionProps {
  emailAlias: string;
}

export function GmailSetupSection({ emailAlias }: GmailSetupSectionProps) {
  // Generate Gmail filter string based on user's alias
  const generateGmailFilterString = (alias: string): string => {
    return `to:(${alias}) OR subject:(receipt OR invoice OR purchase OR order OR payment)`;
  };

  const gmailFilterString = generateGmailFilterString(emailAlias);

  const setupSteps = [
    {
      step: 1,
      title: 'Open Gmail Settings',
      description: 'Go to Gmail → Settings (gear icon) → See all settings → Filters and Blocked Addresses'
    },
    {
      step: 2,
      title: 'Create New Filter',
      description: 'Click "Create a new filter" and paste the filter criteria below'
    },
    {
      step: 3,
      title: 'Set Filter Action',
      description: `Choose "Forward it to" and enter your alias: ${emailAlias}. Important: Add "[AICHIPHI]" to the subject line when forwarding.`
    },
    {
      step: 4,
      title: 'Apply Filter',
      description: 'Check "Also apply filter to matching conversations" and click "Create filter"'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail Setup Instructions
        </CardTitle>
        <CardDescription>
          Configure Gmail to automatically forward receipts to your ChiPhi AI alias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filter String Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h4 className="font-medium">Gmail Filter Criteria</h4>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <code 
                  className="text-sm font-mono break-all text-foreground"
                  data-testid="gmail-filter-string"
                >
                  {gmailFilterString}
                </code>
              </div>
              <CopyButton
                text={gmailFilterString}
                label="Copy Filter"
                variant="outline"
                size="sm"
                successMessage="Gmail filter copied to clipboard"
                data-testid="copy-gmail-filter-button"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This filter will catch emails sent to your alias or emails with receipt-related keywords. Remember to add "[AICHIPHI]" to the subject line when forwarding.
          </p>
        </div>

        <Separator />

        {/* Setup Steps */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Step-by-Step Setup
          </h4>
          <div className="space-y-4">
            {setupSteps.map((step, index) => (
              <div key={step.step} className="flex gap-3">
                <div className="flex-shrink-0">
                  <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    {step.step}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-sm">{step.title}</h5>
                  <p className="text-sm text-muted-foreground mt-1 break-words">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Mobile-Friendly Instructions */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Mobile Gmail App</h4>
          <div className="text-sm text-foreground space-y-2">
            <p>
              For mobile setup, use the Gmail web interface in your browser instead of the mobile app, 
              as filter creation is not available in the mobile app.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                Desktop Required
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Web Interface Only
              </Badge>
            </div>
          </div>
        </div>

        {/* Additional Tips */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h5 className="font-medium text-sm text-foreground mb-2">
            💡 Pro Tips
          </h5>
          <ul className="text-sm text-foreground space-y-1">
            <li>• Test the filter by sending a test email with "receipt" in the subject</li>
            <li>• You can modify the filter criteria to include specific senders</li>
            <li>• Consider creating a Gmail label for forwarded receipts</li>
            <li>• Remember to include "[AICHIPHI]" in the subject when forwarding emails</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}