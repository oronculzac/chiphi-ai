'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Eye, 
  Palette, 
  Globe, 
  Volume2, 
  VolumeX, 
  Monitor,
  Sun,
  Moon,
  Smartphone,
  Save,
  RotateCcw,
  CheckCircle
} from 'lucide-react';

interface UserPreferences {
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  transactionAlerts: boolean;
  weeklyReports: boolean;
  
  // Display preferences
  theme: 'light' | 'dark' | 'system';
  language: string;
  currency: string;
  dateFormat: string;
  
  // Accessibility preferences
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  soundEffects: boolean;
  
  // Dashboard preferences
  defaultView: 'analytics' | 'transactions' | 'insights';
  itemsPerPage: number;
  autoRefresh: boolean;
  compactMode: boolean;
}

const defaultPreferences: UserPreferences = {
  emailNotifications: true,
  pushNotifications: false,
  transactionAlerts: true,
  weeklyReports: true,
  theme: 'system',
  language: 'en',
  currency: 'USD',
  dateFormat: 'MM/dd/yyyy',
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  soundEffects: true,
  defaultView: 'analytics',
  itemsPerPage: 25,
  autoRefresh: true,
  compactMode: false,
};

interface UserPreferencesProps {
  onClose?: () => void;
}

export function UserPreferences({ onClose }: UserPreferencesProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      
      // Try to load from localStorage first (for demo purposes)
      const stored = localStorage.getItem('user-preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
      
      // In a real app, this would be an API call:
      // const response = await fetch('/api/user/preferences');
      // const data = await response.json();
      // setPreferences(data.preferences);
      
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load preferences. Using defaults.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      
      // Save to localStorage (for demo purposes)
      localStorage.setItem('user-preferences', JSON.stringify(preferences));
      
      // In a real app, this would be an API call:
      // await fetch('/api/user/preferences', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(preferences),
      // });
      
      setHasChanges(false);
      toast({
        title: 'Preferences saved',
        description: 'Your preferences have been updated successfully.',
      });
      
      // Apply theme changes immediately
      if (preferences.theme !== 'system') {
        document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      }
      
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setPreferences(defaultPreferences);
    setHasChanges(true);
    toast({
      title: 'Reset to defaults',
      description: 'All preferences have been reset to default values.',
    });
  };

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />;
      case 'dark': return <Moon className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Loading preferences...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto" role="main" aria-labelledby="preferences-title">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle id="preferences-title" className="text-2xl flex items-center gap-2">
            <Palette className="w-6 h-6" aria-hidden="true" />
            User Preferences
          </CardTitle>
          {hasChanges && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Unsaved changes
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Notification Preferences */}
        <section aria-labelledby="notifications-heading">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 id="notifications-heading" className="text-lg font-semibold">Notifications</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="email-notifications" className="text-sm font-medium">
                Email notifications
              </Label>
              <Switch
                id="email-notifications"
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
                aria-describedby="email-notifications-desc"
              />
            </div>
            <div id="email-notifications-desc" className="sr-only">
              Receive email notifications for important updates
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="push-notifications" className="text-sm font-medium">
                Push notifications
              </Label>
              <Switch
                id="push-notifications"
                checked={preferences.pushNotifications}
                onCheckedChange={(checked) => updatePreference('pushNotifications', checked)}
                aria-describedby="push-notifications-desc"
              />
            </div>
            <div id="push-notifications-desc" className="sr-only">
              Receive browser push notifications
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="transaction-alerts" className="text-sm font-medium">
                Transaction alerts
              </Label>
              <Switch
                id="transaction-alerts"
                checked={preferences.transactionAlerts}
                onCheckedChange={(checked) => updatePreference('transactionAlerts', checked)}
                aria-describedby="transaction-alerts-desc"
              />
            </div>
            <div id="transaction-alerts-desc" className="sr-only">
              Get notified when new transactions are processed
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="weekly-reports" className="text-sm font-medium">
                Weekly reports
              </Label>
              <Switch
                id="weekly-reports"
                checked={preferences.weeklyReports}
                onCheckedChange={(checked) => updatePreference('weeklyReports', checked)}
                aria-describedby="weekly-reports-desc"
              />
            </div>
            <div id="weekly-reports-desc" className="sr-only">
              Receive weekly spending summary reports
            </div>
          </div>
        </section>

        <Separator />

        {/* Display Preferences */}
        <section aria-labelledby="display-heading">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 id="display-heading" className="text-lg font-semibold">Display</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="theme-select" className="text-sm font-medium">Theme</Label>
              <Select
                value={preferences.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') => updatePreference('theme', value)}
              >
                <SelectTrigger id="theme-select" aria-describedby="theme-desc">
                  <div className="flex items-center gap-2">
                    {getThemeIcon(preferences.theme)}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div id="theme-desc" className="sr-only">
                Choose your preferred color theme
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="language-select" className="text-sm font-medium">Language</Label>
              <Select
                value={preferences.language}
                onValueChange={(value) => updatePreference('language', value)}
              >
                <SelectTrigger id="language-select" aria-describedby="language-desc">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
              <div id="language-desc" className="sr-only">
                Select your preferred language
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency-select" className="text-sm font-medium">Currency</Label>
              <Select
                value={preferences.currency}
                onValueChange={(value) => updatePreference('currency', value)}
              >
                <SelectTrigger id="currency-select" aria-describedby="currency-desc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="JPY">JPY (¥)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                </SelectContent>
              </Select>
              <div id="currency-desc" className="sr-only">
                Choose your preferred currency for displaying amounts
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-format-select" className="text-sm font-medium">Date Format</Label>
              <Select
                value={preferences.dateFormat}
                onValueChange={(value) => updatePreference('dateFormat', value)}
              >
                <SelectTrigger id="date-format-select" aria-describedby="date-format-desc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                  <SelectItem value="MMM d, yyyy">MMM D, YYYY</SelectItem>
                </SelectContent>
              </Select>
              <div id="date-format-desc" className="sr-only">
                Choose how dates should be displayed
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Accessibility Preferences */}
        <section aria-labelledby="accessibility-heading">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 id="accessibility-heading" className="text-lg font-semibold">Accessibility</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="reduced-motion" className="text-sm font-medium">
                Reduce motion
              </Label>
              <Switch
                id="reduced-motion"
                checked={preferences.reducedMotion}
                onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
                aria-describedby="reduced-motion-desc"
              />
            </div>
            <div id="reduced-motion-desc" className="sr-only">
              Reduce animations and transitions for better accessibility
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="high-contrast" className="text-sm font-medium">
                High contrast
              </Label>
              <Switch
                id="high-contrast"
                checked={preferences.highContrast}
                onCheckedChange={(checked) => updatePreference('highContrast', checked)}
                aria-describedby="high-contrast-desc"
              />
            </div>
            <div id="high-contrast-desc" className="sr-only">
              Use high contrast colors for better visibility
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="large-text" className="text-sm font-medium">
                Large text
              </Label>
              <Switch
                id="large-text"
                checked={preferences.largeText}
                onCheckedChange={(checked) => updatePreference('largeText', checked)}
                aria-describedby="large-text-desc"
              />
            </div>
            <div id="large-text-desc" className="sr-only">
              Use larger text sizes for better readability
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="sound-effects" className="text-sm font-medium flex items-center gap-2">
                {preferences.soundEffects ? (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                )}
                Sound effects
              </Label>
              <Switch
                id="sound-effects"
                checked={preferences.soundEffects}
                onCheckedChange={(checked) => updatePreference('soundEffects', checked)}
                aria-describedby="sound-effects-desc"
              />
            </div>
            <div id="sound-effects-desc" className="sr-only">
              Enable or disable sound effects for interactions
            </div>
          </div>
        </section>

        <Separator />

        {/* Dashboard Preferences */}
        <section aria-labelledby="dashboard-heading">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 id="dashboard-heading" className="text-lg font-semibold">Dashboard</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="default-view-select" className="text-sm font-medium">Default view</Label>
              <Select
                value={preferences.defaultView}
                onValueChange={(value: 'analytics' | 'transactions' | 'insights') => 
                  updatePreference('defaultView', value)
                }
              >
                <SelectTrigger id="default-view-select" aria-describedby="default-view-desc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="transactions">Transactions</SelectItem>
                  <SelectItem value="insights">AI Insights</SelectItem>
                </SelectContent>
              </Select>
              <div id="default-view-desc" className="sr-only">
                Choose which tab to show by default when opening the dashboard
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="items-per-page-select" className="text-sm font-medium">Items per page</Label>
              <Select
                value={preferences.itemsPerPage.toString()}
                onValueChange={(value) => updatePreference('itemsPerPage', parseInt(value))}
              >
                <SelectTrigger id="items-per-page-select" aria-describedby="items-per-page-desc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <div id="items-per-page-desc" className="sr-only">
                Number of transactions to show per page
              </div>
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="auto-refresh" className="text-sm font-medium">
                Auto-refresh data
              </Label>
              <Switch
                id="auto-refresh"
                checked={preferences.autoRefresh}
                onCheckedChange={(checked) => updatePreference('autoRefresh', checked)}
                aria-describedby="auto-refresh-desc"
              />
            </div>
            <div id="auto-refresh-desc" className="sr-only">
              Automatically refresh dashboard data every 30 seconds
            </div>
            
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="compact-mode" className="text-sm font-medium">
                Compact mode
              </Label>
              <Switch
                id="compact-mode"
                checked={preferences.compactMode}
                onCheckedChange={(checked) => updatePreference('compactMode', checked)}
                aria-describedby="compact-mode-desc"
              />
            </div>
            <div id="compact-mode-desc" className="sr-only">
              Use a more compact layout to show more information
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <Button
            onClick={savePreferences}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2"
            aria-describedby="save-desc"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
          <div id="save-desc" className="sr-only">
            Save all preference changes
          </div>
          
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="flex items-center gap-2"
            aria-describedby="reset-desc"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Reset to Defaults
          </Button>
          <div id="reset-desc" className="sr-only">
            Reset all preferences to their default values
          </div>
          
          {onClose && (
            <Button
              variant="ghost"
              onClick={onClose}
              className="sm:ml-auto"
              aria-label="Close preferences dialog"
            >
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}