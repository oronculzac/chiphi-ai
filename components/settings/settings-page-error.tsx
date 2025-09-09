'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SettingsPageErrorProps {
  children: ReactNode;
}

interface SettingsPageErrorState {
  hasError: boolean;
  error?: Error;
}

export class SettingsPageError extends Component<SettingsPageErrorProps, SettingsPageErrorState> {
  constructor(props: SettingsPageErrorProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SettingsPageErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Settings page error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-2xl mx-auto py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              There was an error loading the settings page. This might be a temporary issue.
            </AlertDescription>
          </Alert>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <Button onClick={this.handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 p-4 bg-muted rounded-lg">
              <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
              <pre className="mt-2 text-sm overflow-auto whitespace-pre-wrap break-words text-foreground">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}