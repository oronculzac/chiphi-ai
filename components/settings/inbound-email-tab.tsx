'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GmailSetupSection } from './gmail-setup-section';
import { Mail, AlertCircle, CheckCircle, Clock, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useSettingsApi } from '@/hooks/use-api-with-retry';
import { ErrorStateWithRetry, InboundEmailTabSkeleton } from '@/components/settings/loading-states';
import { withRetry } from '@/lib/utils/retry';

interface EmailAlias {
  id: string;
  aliasEmail: string;
  isActive: boolean;
  createdAt: string;
}

interface VerificationStatus {
  code: string | null;
  timestamp: string | null;
  isPolling: boolean;
  error: string | null;
}

export default function InboundEmailTab() {
  const [verification, setVerification] = useState<VerificationStatus>({
    code: null,
    timestamp: null,
    isPolling: false,
    error: null
  });

  // Use the new API hook with retry functionality
  const {
    data: alias,
    loading,
    error,
    execute,
    retry,
    isRetrying
  } = useSettingsApi<EmailAlias>(null, {
    showToastOnError: false, // We'll handle error display manually
    errorMessage: 'Failed to load email alias'
  });

  useEffect(() => {
    execute(async () => {
      const response = await fetch('/api/settings/alias');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.alias;
    });
  }, [execute]);

  const fetchVerificationCode = useCallback(async () => {
    return withRetry(async () => {
      const response = await fetch('/api/alias/verification-code');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    }, {
      maxAttempts: 2,
      baseDelay: 500,
      maxDelay: 2000
    });
  }, []);

  const startPolling = useCallback(async () => {
    if (verification.isPolling) return;

    setVerification(prev => ({
      ...prev,
      isPolling: true,
      error: null
    }));

    const maxAttempts = 20; // Poll for up to 2 minutes (20 attempts * 6 seconds)
    let attempts = 0;
    let pollInterval: NodeJS.Timeout;

    const poll = async () => {
      try {
        attempts++;
        const data = await fetchVerificationCode();

        if (data.code) {
          // Code found, stop polling
          setVerification({
            code: data.code,
            timestamp: data.timestamp,
            isPolling: false,
            error: null
          });
          clearInterval(pollInterval);
        } else if (attempts >= maxAttempts) {
          // Timeout reached, stop polling
          setVerification(prev => ({
            ...prev,
            isPolling: false,
            error: 'Timeout: No verification code received within 2 minutes'
          }));
          clearInterval(pollInterval);
        }
      } catch (err) {
        setVerification(prev => ({
          ...prev,
          isPolling: false,
          error: err instanceof Error ? err.message : 'Failed to fetch verification code'
        }));
        clearInterval(pollInterval);
      }
    };

    // Start polling immediately, then every 6 seconds
    await poll();
    if (verification.isPolling) {
      pollInterval = setInterval(poll, 6000);
    }
  }, [verification.isPolling, fetchVerificationCode]);

  const resetVerification = useCallback(() => {
    setVerification({
      code: null,
      timestamp: null,
      isPolling: false,
      error: null
    });
  }, []);

  // Show loading skeleton on initial load
  if (loading && !alias) {
    return <InboundEmailTabSkeleton />;
  }

  // Show error state with retry option
  if (error && !alias) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Inbound Email Configuration</h2>
          <p className="text-muted-foreground">
            View your email alias, set up Gmail forwarding, and verify your email configuration.
          </p>
        </div>
        <ErrorStateWithRetry
          error={error}
          onRetry={retry}
          loading={isRetrying}
          title="Failed to load email configuration"
          description="There was a problem loading your email alias. Please try again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Inbound Email Configuration</h2>
        <p className="text-muted-foreground">
          View your email alias, set up Gmail forwarding, and verify your email configuration.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Email Alias Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Your Email Alias
            </CardTitle>
            <CardDescription>
              Forward receipts to this unique email address for automatic processing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alias ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-medium" data-testid="email-alias">
                      {alias.aliasEmail}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Created on {new Date(alias.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <CopyButton
                    text={alias.aliasEmail}
                    label="Copy"
                    variant="outline"
                    size="sm"
                    successMessage="Email alias copied to clipboard"
                    data-testid="copy-alias-button"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>
                    Use this email address to forward receipts from your email provider. 
                    All emails sent to this address will be automatically processed and 
                    categorized in your dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No email alias found. Please contact support if this issue persists.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Gmail Setup Section */}
        {alias && <GmailSetupSection emailAlias={alias.aliasEmail} />}

        {/* Verification Card */}
        <Card>
          <CardHeader>
            <CardTitle>Email Verification</CardTitle>
            <CardDescription>
              Check if your email forwarding is working correctly by getting a verification code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Verification Status */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {verification.code ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium text-green-700" data-testid="verification-status">
                          Verified
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Code received at {verification.timestamp ? new Date(verification.timestamp).toLocaleString() : 'Unknown time'}
                        </div>
                      </div>
                    </>
                  ) : verification.isPolling ? (
                    <>
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                      <div>
                        <div className="font-medium text-blue-700">
                          Polling for verification code...
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Checking every 6 seconds (up to 2 minutes)
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          No verification code received
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Click "Get Verification Code" to start polling
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {verification.code && (
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-sm font-medium bg-background px-2 py-1 rounded border" data-testid="verification-code">
                      {verification.code}
                    </div>
                    <CopyButton
                      text={verification.code}
                      label="Copy"
                      variant="outline"
                      size="sm"
                      successMessage="Verification code copied to clipboard"
                    />
                  </div>
                )}
              </div>

              {/* Error Display */}
              {verification.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{verification.error}</AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={startPolling}
                  disabled={verification.isPolling}
                  variant="default"
                  size="sm"
                  data-testid="get-verification-code"
                >
                  {verification.isPolling ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Polling...
                    </>
                  ) : (
                    'Get Verification Code'
                  )}
                </Button>
                
                {(verification.code || verification.error) && (
                  <Button
                    onClick={resetVerification}
                    variant="outline"
                    size="sm"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {/* Instructions */}
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>How to test:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Click "Get Verification Code" to start polling</li>
                  <li>Send an email to your alias with "VERIFY" in the subject</li>
                  <li>The system will automatically detect and display the verification code</li>
                  <li>A green "Verified" status indicates your email forwarding is working</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Show error alert if there's an error but we have data */}
        {error && alias && (
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