'use client';

import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Bug, ExternalLink } from 'lucide-react';

/**
 * Individual widget error boundary component
 * Provides graceful degradation when individual widgets fail
 * 
 * Requirements covered:
 * - 7.4: Add proper error boundaries for individual widget failures
 * - 7.5: Create graceful degradation when widgets fail independently
 */

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetName: string;
  fallbackTitle?: string;
  onRetry?: () => void;
  showTechnicalDetails?: boolean;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
  retryCount: number;
}

export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const { widgetName } = this.props;
    const { retryCount } = this.state;
    
    // Log error with widget context
    console.error(`Widget Error [${widgetName}]:`, error, errorInfo);
    
    // Store error info for debugging
    this.setState({ errorInfo });
    
    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, {
      //   tags: { widget: widgetName, retryCount },
      //   extra: errorInfo
      // });
    }
    
    // Auto-retry for certain types of errors (max 2 retries)
    if (retryCount < 2 && this.shouldAutoRetry(error)) {
      this.scheduleAutoRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private shouldAutoRetry(error: Error): boolean {
    // Auto-retry for network errors, timeout errors, etc.
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'AbortError',
      'fetch'
    ];
    
    return retryableErrors.some(errorType => 
      error.name.includes(errorType) || 
      error.message.toLowerCase().includes(errorType.toLowerCase())
    );
  }

  private scheduleAutoRetry = () => {
    const { retryCount } = this.state;
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
    
    this.retryTimeoutId = setTimeout(() => {
      console.log(`Auto-retrying widget [${this.props.widgetName}] (attempt ${retryCount + 1})`);
      this.handleRetry();
    }, delay);
  };

  private handleRetry = () => {
    const { onRetry } = this.props;
    
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1
    }));
    
    // Call parent retry function if provided
    if (onRetry) {
      onRetry();
    }
  };

  private handleManualRetry = () => {
    // Clear any pending auto-retry
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    
    this.handleRetry();
  };

  private getErrorSeverity(error: Error): 'low' | 'medium' | 'high' {
    // Classify error severity based on error type
    if (error.name.includes('Network') || error.message.includes('fetch')) {
      return 'medium';
    }
    if (error.name.includes('TypeError') || error.name.includes('ReferenceError')) {
      return 'high';
    }
    return 'low';
  }

  private getErrorMessage(error: Error): string {
    const severity = this.getErrorSeverity(error);
    
    switch (severity) {
      case 'high':
        return 'A critical error occurred in this widget. Please refresh the page or contact support.';
      case 'medium':
        return 'This widget is temporarily unavailable. Please check your connection and try again.';
      default:
        return 'This widget encountered an issue. You can continue using other features while we resolve this.';
    }
  }

  render() {
    const { children, widgetName, fallbackTitle, showTechnicalDetails = false } = this.props;
    const { hasError, error, errorInfo, retryCount } = this.state;

    if (hasError && error) {
      const severity = this.getErrorSeverity(error);
      const errorMessage = this.getErrorMessage(error);
      const isRetryable = retryCount < 3;

      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {fallbackTitle || `${widgetName} Error`}
              {retryCount > 0 && (
                <span className="text-xs bg-destructive/10 px-2 py-1 rounded">
                  Retry {retryCount}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
              
              {severity === 'low' && (
                <p className="text-xs text-muted-foreground">
                  Other widgets should continue working normally.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {isRetryable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleManualRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh Page
              </Button>
              
              {process.env.NODE_ENV === 'development' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => console.log('Widget Error Details:', { error, errorInfo })}
                  className="gap-2"
                >
                  <Bug className="h-3 w-3" />
                  Log Details
                </Button>
              )}
            </div>

            {/* Technical details (development or when explicitly enabled) */}
            {(showTechnicalDetails || process.env.NODE_ENV === 'development') && error && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
                  Technical Details
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>Error:</strong> {error.name}
                  </div>
                  <div>
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words text-foreground">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo && errorInfo.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words text-foreground">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Help text */}
            <div className="text-xs text-muted-foreground border-t pt-3">
              <p>
                If this problem persists, try refreshing the page or{' '}
                <button 
                  className="underline hover:no-underline"
                  onClick={() => window.open('/support', '_blank')}
                >
                  contact support
                </button>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

// Higher-order component for easy widget wrapping
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  widgetName: string,
  options: {
    fallbackTitle?: string;
    showTechnicalDetails?: boolean;
  } = {}
) {
  const WithErrorBoundaryComponent = (props: P & { onRetry?: () => void }) => {
    const { onRetry, ...componentProps } = props;
    
    return (
      <WidgetErrorBoundary
        widgetName={widgetName}
        fallbackTitle={options.fallbackTitle}
        showTechnicalDetails={options.showTechnicalDetails}
        onRetry={onRetry}
      >
        <WrappedComponent {...(componentProps as P)} />
      </WidgetErrorBoundary>
    );
  };

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${widgetName})`;
  
  return WithErrorBoundaryComponent;
}

// Utility function to determine if data represents an empty state
export function determineEmptyStateVariant(
  data: any[] | null | undefined,
  hasAnyTransactions: boolean,
  hasActiveFilters: boolean
): 'no-data' | 'no-transactions' | 'filtered-out' {
  if (!hasAnyTransactions) {
    return 'no-transactions';
  }
  
  if (hasActiveFilters && (!data || data.length === 0)) {
    return 'filtered-out';
  }
  
  return 'no-data';
}