'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import LogoUpload from './logo-upload';
import MembersManagementSection from './members-management-section';
import { useSettingsApi } from '@/hooks/use-api-with-retry';
import { ErrorStateWithRetry, OrganizationTabSkeleton } from '@/components/settings/loading-states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSettingsTranslations } from '@/hooks/use-settings-translations';
import { useLocaleInfo } from '@/components/providers/locale-provider';

// Validation schema matching the API - will be localized in the component
const createOrganizationNameSchema = (requiredMessage: string, maxLengthMessage: string) => z.object({
  name: z.string().min(1, requiredMessage).max(100, maxLengthMessage).trim(),
});

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function OrganizationTab() {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameError, setNameError] = useState('');
  const initialLoadRef = useRef(false);
  const { toast } = useToast();
  const { organization: organizationTranslations, common } = useSettingsTranslations();
  const { isRTL } = useLocaleInfo();

  // Use the new API hook with retry functionality
  const {
    data: organization,
    loading,
    error,
    execute,
    retry,
    isRetrying
  } = useSettingsApi<Organization>(null, {
    onSuccess: (data) => {
      setEditName(data.name);
    },
    onError: (error) => {
      console.error('Organization API error:', error);
    },
    showToastOnError: false, // We'll handle error display manually
    errorMessage: 'Failed to load organization data'
  });

  // Fetch organization data on mount
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    execute(async () => {
      const response = await fetch('/api/settings/organization');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch organization');
      }

      return result.data;
    });
  }, []);

  const handleStartEdit = () => {
    setEditing(true);
    setEditName(organization?.name || '');
    setNameError('');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditName(organization?.name || '');
    setNameError('');
  };

  const validateName = (name: string) => {
    try {
      const schema = createOrganizationNameSchema(
        organizationTranslations.name.required,
        organizationTranslations.name.maxLength
      );
      schema.parse({ name });
      setNameError('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setNameError(error.errors[0]?.message || 'Invalid name');
      }
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateName(editName)) {
      return;
    }

    const result = await execute(
      async () => {
        const response = await fetch('/api/settings/organization', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: editName }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update organization');
        }

        return result.data;
      },
      {
        // Optimistic update - immediately show the new name
        optimisticUpdate: (currentData) => 
          currentData ? { ...currentData, name: editName, updated_at: new Date().toISOString() } : null,
        rollbackOnError: true
      }
    );

    if (result) {
      setEditing(false);
      toast({
        title: common.success,
        description: organizationTranslations.name.saved,
      });
    }
  };

  const handleNameChange = (value: string) => {
    setEditName(value);
    // Always validate on change to provide immediate feedback
    validateName(value);
  };

  const handleLogoUpdate = (logoUrl: string | null) => {
    // Update organization data optimistically
    execute(
      async () => {
        // Return the updated organization data
        if (!organization) throw new Error('No organization data');
        return {
          ...organization,
          logo_url: logoUrl,
          updated_at: new Date().toISOString()
        };
      },
      {
        optimisticUpdate: (currentData) => 
          currentData ? { ...currentData, logo_url: logoUrl, updated_at: new Date().toISOString() } : null
      }
    );
  };

  // Show loading skeleton on initial load
  if (loading && !organization) {
    return <OrganizationTabSkeleton />;
  }

  // Show error state with retry option
  if (error && !organization) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Organization Settings</h2>
          <p className="text-muted-foreground">
            Manage your organization information, logo, and team members.
          </p>
        </div>
        <ErrorStateWithRetry
          error={error}
          onRetry={retry}
          loading={isRetrying}
          title={common.error}
          description="There was a problem loading your organization information. Please try again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{organizationTranslations.title}</h2>
        <p className="text-muted-foreground">
          {organizationTranslations.description}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Organization Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{organizationTranslations.title}</CardTitle>
            <CardDescription>
              {organizationTranslations.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">{organizationTranslations.name.label}</Label>
              {editing ? (
                <div className="space-y-2">
                  <Input
                    id="org-name"
                    value={editName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={organizationTranslations.name.placeholder}
                    className={nameError ? 'border-destructive' : ''}
                    disabled={loading}
                  />
                  {nameError && (
                    <p className="text-sm text-destructive">{nameError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={loading || !!nameError || !editName.trim()}
                      size="sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {organizationTranslations.name.saving}
                        </>
                      ) : (
                        <>
                          <Save className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {common.save}
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {common.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{organization?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {organization?.updated_at ? new Date(organization.updated_at).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <Button onClick={handleStartEdit} variant="outline" size="sm">
                    {common.edit}
                  </Button>
                </div>
              )}
            </div>

            <LogoUpload
              currentLogoUrl={organization?.logo_url}
              onLogoUpdate={handleLogoUpdate}
              disabled={loading}
            />
          </CardContent>
        </Card>

        {/* Members Management Section */}
        <MembersManagementSection disabled={loading} />

        {/* Show error alert if there&apos;s an error but we have data */}
        {error && organization && (
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
                  common.retry
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}