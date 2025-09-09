'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2, Database, FileX } from 'lucide-react';
import { ConfirmationDialog } from './confirmation-dialog';

interface DangerZoneSectionProps {
  organizationName: string;
}

interface DataDeletionOptions {
  transactions: boolean;
  emails: boolean;
  merchantMappings: boolean;
  processingLogs: boolean;
  notifications: boolean;
}

export default function DangerZoneSection({ organizationName }: DangerZoneSectionProps) {
  const { toast } = useToast();
  
  // Account deletion state
  const [showAccountDeleteDialog, setShowAccountDeleteDialog] = useState(false);
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);
  
  // Data deletion state
  const [showDataDeleteDialog, setShowDataDeleteDialog] = useState(false);
  const [isDataDeleting, setIsDataDeleting] = useState(false);
  const [dataOptions, setDataOptions] = useState<DataDeletionOptions>({
    transactions: false,
    emails: false,
    merchantMappings: false,
    processingLogs: false,
    notifications: false,
  });

  // Handle account deletion
  const handleAccountDeletion = async () => {
    setIsAccountDeleting(true);
    
    try {
      const response = await fetch('/api/settings/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }

      // Redirect to goodbye page
      window.location.href = '/goodbye';
      
    } catch (error) {
      console.error('Account deletion error:', error);
      toast({
        title: 'Account Deletion Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
      setIsAccountDeleting(false);
      setShowAccountDeleteDialog(false);
    }
  };

  // Handle selective data deletion
  const handleDataDeletion = async () => {
    const selectedTypes = Object.entries(dataOptions)
      .filter(([_, selected]) => selected)
      .map(([type, _]) => type);

    if (selectedTypes.length === 0) {
      toast({
        title: 'No Data Selected',
        description: 'Please select at least one data type to delete.',
        variant: 'destructive',
      });
      return;
    }

    setIsDataDeleting(true);
    
    try {
      const response = await fetch('/api/settings/data/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataTypes: selectedTypes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete data');
      }

      const result = await response.json();
      
      toast({
        title: 'Data Deleted Successfully',
        description: `Deleted ${result.deletedCount} records across ${selectedTypes.length} data types.`,
      });

      // Reset selection
      setDataOptions({
        transactions: false,
        emails: false,
        merchantMappings: false,
        processingLogs: false,
        notifications: false,
      });
      
    } catch (error) {
      console.error('Data deletion error:', error);
      toast({
        title: 'Data Deletion Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDataDeleting(false);
      setShowDataDeleteDialog(false);
    }
  };

  // Handle data option changes
  const handleDataOptionChange = (option: keyof DataDeletionOptions, checked: boolean) => {
    setDataOptions(prev => ({
      ...prev,
      [option]: checked,
    }));
  };

  const selectedDataCount = Object.values(dataOptions).filter(Boolean).length;

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently delete your account or specific data types. These actions cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Data Deletion Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Delete Specific Data</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Choose specific data types to delete while keeping your account active.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transactions"
                  checked={dataOptions.transactions}
                  onCheckedChange={(checked) => handleDataOptionChange('transactions', checked as boolean)}
                />
                <Label htmlFor="transactions" className="text-sm">
                  Transactions & Receipts
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emails"
                  checked={dataOptions.emails}
                  onCheckedChange={(checked) => handleDataOptionChange('emails', checked as boolean)}
                />
                <Label htmlFor="emails" className="text-sm">
                  Raw Email Data
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="merchantMappings"
                  checked={dataOptions.merchantMappings}
                  onCheckedChange={(checked) => handleDataOptionChange('merchantMappings', checked as boolean)}
                />
                <Label htmlFor="merchantMappings" className="text-sm">
                  Merchant Mappings
                </Label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="processingLogs"
                  checked={dataOptions.processingLogs}
                  onCheckedChange={(checked) => handleDataOptionChange('processingLogs', checked as boolean)}
                />
                <Label htmlFor="processingLogs" className="text-sm">
                  Processing Logs
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications"
                  checked={dataOptions.notifications}
                  onCheckedChange={(checked) => handleDataOptionChange('notifications', checked as boolean)}
                />
                <Label htmlFor="notifications" className="text-sm">
                  Notification Preferences
                </Label>
              </div>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setShowDataDeleteDialog(true)}
            disabled={selectedDataCount === 0 || isDataDeleting}
            className="flex items-center gap-2"
          >
            <FileX className="h-4 w-4" />
            {isDataDeleting ? 'Deleting...' : `Delete Selected Data (${selectedDataCount})`}
          </Button>
        </div>

        {/* Account Deletion Section */}
        <div className="border-t pt-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your entire account and all associated data. This action cannot be undone.
              </p>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-destructive/80 space-y-1">
                    <li>• All transaction and receipt data</li>
                    <li>• All email processing history</li>
                    <li>• All merchant mappings and learning data</li>
                    <li>• All organization settings and preferences</li>
                    <li>• Your user account and access</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={() => setShowAccountDeleteDialog(true)}
              disabled={isAccountDeleting}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isAccountDeleting ? 'Deleting Account...' : 'Delete Account'}
            </Button>
          </div>
        </div>

        {/* Account Deletion Confirmation Dialog */}
        <ConfirmationDialog
          open={showAccountDeleteDialog}
          onOpenChange={setShowAccountDeleteDialog}
          title="Delete Account"
          description="This action will permanently delete your account and all associated data. This cannot be undone."
          confirmText="Delete Account"
          cancelText="Cancel"
          variant="destructive"
          requiresTyping={{
            expectedText: organizationName,
            placeholder: `Type "${organizationName}" to confirm`,
          }}
          onConfirm={handleAccountDeletion}
          onCancel={() => setShowAccountDeleteDialog(false)}
          isLoading={isAccountDeleting}
        />

        {/* Data Deletion Confirmation Dialog */}
        <ConfirmationDialog
          open={showDataDeleteDialog}
          onOpenChange={setShowDataDeleteDialog}
          title="Delete Selected Data"
          description={`This will permanently delete ${selectedDataCount} selected data types. This action cannot be undone.`}
          confirmText="Delete Data"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleDataDeletion}
          onCancel={() => setShowDataDeleteDialog(false)}
          isLoading={isDataDeleting}
        />
      </CardContent>
    </Card>
  );
}