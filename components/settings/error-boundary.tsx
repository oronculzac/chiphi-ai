'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolateErrors?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorId: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: this.generateErrorId()
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { 
      hasError: true, 
      error,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log error details for debugging
    console.group(`🚨 Error Boundary [${this.state.errorId}]`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => prevProps.resetKeys?.[idx] !== key)) {
        this.resetErrorBoundary();
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private generateErrorId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
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

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;
      const { isolateErrors = false } = this.props;

      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
            <CardDescription>
              {isolateErrors 
                ? "This section encountered an error, but other parts of the page should still work."
                : "There was an error loading this content. This might be a temporary issue."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </div>
            
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4 p-4 bg-muted rounded-lg">
                <summary className="cursor-pointer font-medium text-sm">
                  Stack Trace (Development)
                </summary>
                <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundary for settings tabs
export function SettingsTabErrorBoundary({ 
  children, 
  tabName 
}: { 
  children: ReactNode; 
  tabName: string;
}) {
  return (
    <ErrorBoundary
      isolateErrors={true}
      onError={(error, errorInfo) => {
        console.error(`Settings tab error [${tabName}]:`, error, errorInfo);
      }}
      fallback={
        <div className="w-full py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error in {tabName} Tab</AlertTitle>
            <AlertDescription className="mt-2">
              This tab encountered an error and couldn't load properly. 
              Other tabs should still work normally.
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 flex gap-3">
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}