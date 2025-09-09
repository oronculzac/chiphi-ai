'use client';

import { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ReportsPageErrorProps {
  children: ReactNode;
}

interface ReportsPageErrorState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component for the reports page
 * Catches JavaScript errors and provides graceful fallback UI
 * 
 * Requirements covered:
 * - 7.4: Add proper error boundaries for individual widget failures
 * - 7.5: Create graceful degradation when widgets fail independently
 */
export default class ReportsPageError extends Component<ReportsPageErrorProps, ReportsPageErrorState> {
  constructor(props: ReportsPageErrorProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ReportsPageErrorState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Reports page error:', error, errorInfo);
    
    // In production, you would send this to your error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // Force a page refresh to retry loading
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-6">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Reports Loading Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We encountered an error while loading your reports. This might be due to a temporary issue 
                with data processing or network connectivity.
              </p>
              
              {this.state.error && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto whitespace-pre-wrap break-words text-foreground">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-4">
                <Button onClick={this.handleRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry Loading
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/dashboard'}
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Fallback content */}
          <Card>
            <CardHeader>
              <CardTitle>Alternative Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                While we work on fixing this issue, you can:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Check your recent transactions on the dashboard</li>
                <li>Try refreshing the page in a few minutes</li>
                <li>Contact support if the problem persists</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}