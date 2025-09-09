'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Mail, Bell, Clock, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettingsApi } from '@/hooks/use-api-with-retry';
import { ErrorStateWithRetry, NotificationsTabSkeleton } from '@/components/settings/loading-states';
import { useSettingsTranslations } from '@/hooks/use-settings-translations';
import { useLocaleInfo } from '@/components/providers/locale-provider';

interface NotificationPreferences {
  receiptProcessed: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  summaryEmails: string[];
}

export default function NotificationsTab() {
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const initialLoadRef = useRef(false);
  const { toast } = useToast();
  const { notifications, common } = useSettingsTranslations();
  const { isRTL } = useLocaleInfo();

  // Use the new API hook with retry functionality
  const {
    data: preferences,
    loading,
    error,
    execute,
    retry,
    isRetrying
  } = useSettingsApi<NotificationPreferences>({
    receiptProcessed: true,
    dailySummary: false,
    weeklySummary: false,
    summaryEmails: [],
  }, {
    showToastOnError: false, // We'll handle error display manually
    errorMessage: 'Failed to update notification preferences'
  });

  // Load notification preferences on component mount
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    execute(async () => {
      const response = await fetch('/api/settings/notifications');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    });
  }, []);

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;

    const updatedPreferences = { ...preferences, ...updates };
    
    const result = await execute(
      async () => {
        const response = await fetch('/api/settings/notifications', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedPreferences),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      },
      {
        // Optimistic update - immediately show the new preferences
        optimisticUpdate: () => updatedPreferences,
        rollbackOnError: true
      }
    );

    if (result) {
      toast({
        title: 'Success',
        description: 'Notification preferences updated successfully.',
      });
    }
  };

  const handleToggleChange = (key: keyof Omit<NotificationPreferences, 'summaryEmails'>, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !preferences) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    // Check if email already exists
    if (preferences.summaryEmails.includes(newEmail)) {
      toast({
        title: 'Email Already Added',
        description: 'This email address is already in your notification list.',
        variant: 'destructive',
      });
      return;
    }

    const updatedEmails = [...preferences.summaryEmails, newEmail];
    const result = await updatePreferences({ summaryEmails: updatedEmails });
    
    if (result) {
      setNewEmail('');
      setAddingEmail(false);
    }
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (!preferences) return;
    
    const updatedEmails = preferences.summaryEmails.filter(email => email !== emailToRemove);
    await updatePreferences({ summaryEmails: updatedEmails });
  };

  // Show loading skeleton on initial load
  if (loading && !preferences) {
    return <NotificationsTabSkeleton />;
  }

  // Show error state with retry option
  if (error && !preferences) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Notification Preferences</h2>
          <p className="text-muted-foreground">
            Configure how and when you receive notifications about receipt processing and system activity.
          </p>
        </div>
        <ErrorStateWithRetry
          error={error}
          onRetry={retry}
          loading={isRetrying}
          title="Failed to load notification preferences"
          description="There was a problem loading your notification settings. Please try again."
        />
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Notification Preferences</h2>
        <p className="text-muted-foreground">
          Configure how and when you receive notifications about receipt processing and system activity.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Notification Types Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Choose which notifications you want to receive via email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Receipt Processed Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="receipt-processed" className="text-base font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  New receipt processed
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a new receipt is successfully processed and categorized.
                </p>
              </div>
              <Switch
                id="receipt-processed"
                checked={preferences.receiptProcessed}
                onCheckedChange={(checked) => handleToggleChange('receiptProcessed', checked)}
                disabled={loading}
              />
            </div>

            {/* Daily Summary Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="daily-summary" className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Daily summary
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily digest of all processed receipts and spending activity.
                </p>
              </div>
              <Switch
                id="daily-summary"
                checked={preferences.dailySummary}
                onCheckedChange={(checked) => handleToggleChange('dailySummary', checked)}
                disabled={loading}
              />
            </div>

            {/* Weekly Summary Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-summary" className="text-base font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Weekly summary
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get a weekly overview of your spending patterns and category breakdowns.
                </p>
              </div>
              <Switch
                id="weekly-summary"
                checked={preferences.weeklySummary}
                onCheckedChange={(checked) => handleToggleChange('weeklySummary', checked)}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Additional Email Recipients
            </CardTitle>
            <CardDescription>
              Add extra email addresses to receive summary notifications. These emails will receive daily and weekly summaries when enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Email List */}
            {preferences.summaryEmails.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Current recipients:</Label>
                <div className="flex flex-wrap gap-2">
                  {preferences.summaryEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveEmail(email)}
                        disabled={loading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Email */}
            {addingEmail ? (
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddEmail();
                    } else if (e.key === 'Escape') {
                      setNewEmail('');
                      setAddingEmail(false);
                    }
                  }}
                  disabled={loading}
                  autoFocus
                />
                <Button onClick={handleAddEmail} disabled={loading || !newEmail.trim()}>
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewEmail('');
                    setAddingEmail(false);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setAddingEmail(true)}
                className=&quot;flex items-center gap-2&quot;
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
                Add email address
              </Button>
            )}

            {preferences.summaryEmails.length === 0 && !addingEmail && (
              <p className="text-sm text-muted-foreground">
                No additional email recipients configured. Summary notifications will only be sent to your account email.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Show error alert if there&apos;s an error but we have data */}
        {error && preferences && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Some operations may be temporarily unavailable: {error.message}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={retry}
                disabled={isRetrying}
                className="ml-2"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Retry'
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}