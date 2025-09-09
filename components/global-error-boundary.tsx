'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GlobalErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId: string;
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: this.generateErrorId()
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return { 
      hasError: true, 
      error,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Global ErrorBoundary caught an error:', error, errorInfo);
    
    // Log error details for debugging
    console.group(`🚨 Global Error [${this.state.errorId}]`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, {
      //   tags: { boundary: 'global' },
      //   extra: errorInfo
      // });
    }
  }

  private generateErrorId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  resetErrorBoundary = () => {
    this.setState({ 
      hasError: false, 
      error: undefined,
      errorId: this.generateErrorId()
    });
  };

  handleRetry = () => {
    this.resetErrorBoundary();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                Something went wrong
              </CardTitle>
              <CardDescription>
                The application encountered an unexpected error. This might be a temporary issue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <Bug className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    <div className="text-sm font-mono">
                      {error?.name}: {error?.message}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Error ID: {errorId}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={this.handleRetry} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={this.handleReload}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>

                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  If this problem persists, please try the following:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Clear your browser cache and cookies</li>
                  <li>Try using a different browser or incognito mode</li>
                  <li>Check your internet connection</li>
                  <li>Contact support if the issue continues</li>
                </ul>
              </div>
              
              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-4 p-4 bg-muted rounded-lg">
                  <summary className="cursor-pointer font-medium text-sm">
                    Stack Trace (Development)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap max-h-64">
                    {error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withGlobalErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  const WithGlobalErrorBoundaryComponent = (props: P) => {
    return (
      <GlobalErrorBoundary>
        <WrappedComponent {...props} />
      </GlobalErrorBoundary>
    );
  };

  WithGlobalErrorBoundaryComponent.displayName = `withGlobalErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithGlobalErrorBoundaryComponent;
}