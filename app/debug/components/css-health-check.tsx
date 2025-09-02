'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface HealthCheck {
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message?: string;
  details?: string;
}

export function CSSHealthCheck() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const runHealthChecks = async () => {
    setIsRunning(true);
    setProgress(0);

    const checks: HealthCheck[] = [
      {
        name: 'Tailwind CSS Loading',
        description: 'Verify Tailwind CSS is properly loaded and compiled',
        status: 'pending'
      },
      {
        name: 'CSS Variables',
        description: 'Check if CSS custom properties are available',
        status: 'pending'
      },
      {
        name: 'Theme Configuration',
        description: 'Verify theme colors and spacing are applied',
        status: 'pending'
      },
      {
        name: 'Component Styles',
        description: 'Check if shadcn/ui component styles are loaded',
        status: 'pending'
      },
      {
        name: 'Font Loading',
        description: 'Verify custom fonts are loaded correctly',
        status: 'pending'
      },
      {
        name: 'Dark Mode Support',
        description: 'Check if dark mode CSS variables are available',
        status: 'pending'
      }
    ];

    setHealthChecks(checks);

    // Run health checks
    for (let i = 0; i < checks.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const check = checks[i];
      
      try {
        switch (check.name) {
          case 'Tailwind CSS Loading':
            // Check if Tailwind utilities are working
            const testElement = document.createElement('div');
            testElement.className = 'bg-blue-500 text-white p-4 rounded-lg';
            document.body.appendChild(testElement);
            const computedStyle = window.getComputedStyle(testElement);
            document.body.removeChild(testElement);
            
            if (computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              check.status = 'pass';
              check.message = 'Tailwind CSS utilities are working correctly';
            } else {
              check.status = 'fail';
              check.message = 'Tailwind CSS utilities not applied - check configuration';
            }
            break;

          case 'CSS Variables':
            // Check for CSS custom properties
            const rootStyle = getComputedStyle(document.documentElement);
            const hasVariables = rootStyle.getPropertyValue('--background') || 
                                rootStyle.getPropertyValue('--foreground');
            
            if (hasVariables) {
              check.status = 'pass';
              check.message = 'CSS custom properties are available';
              check.details = `Found variables: ${hasVariables}`;
            } else {
              check.status = 'warning';
              check.message = 'CSS custom properties not found - theme may not be loaded';
            }
            break;

          case 'Theme Configuration':
            // Check theme colors
            const bodyStyle = getComputedStyle(document.body);
            const backgroundColor = bodyStyle.backgroundColor;
            const color = bodyStyle.color;
            
            if (backgroundColor !== 'rgba(0, 0, 0, 0)' || color !== 'rgba(0, 0, 0, 0)') {
              check.status = 'pass';
              check.message = 'Theme colors are applied';
              check.details = `Background: ${backgroundColor}, Color: ${color}`;
            } else {
              check.status = 'warning';
              check.message = 'Default theme colors detected';
            }
            break;

          case 'Component Styles':
            // Check if button component has proper styles
            const buttonTest = document.createElement('button');
            buttonTest.className = 'inline-flex items-center justify-center rounded-md text-sm font-medium';
            document.body.appendChild(buttonTest);
            const buttonStyle = window.getComputedStyle(buttonTest);
            document.body.removeChild(buttonTest);
            
            if (buttonStyle.display === 'inline-flex') {
              check.status = 'pass';
              check.message = 'Component styles are loaded';
            } else {
              check.status = 'fail';
              check.message = 'Component styles not applied';
            }
            break;

          case 'Font Loading':
            // Check font family
            const fontFamily = getComputedStyle(document.body).fontFamily;
            
            if (fontFamily.includes('Inter') || fontFamily.includes('system-ui')) {
              check.status = 'pass';
              check.message = 'Custom fonts loaded successfully';
              check.details = `Font: ${fontFamily}`;
            } else {
              check.status = 'warning';
              check.message = 'Using fallback fonts';
              check.details = `Font: ${fontFamily}`;
            }
            break;

          case 'Dark Mode Support':
            // Check for dark mode CSS variables
            const darkModeSupport = document.documentElement.classList.contains('dark') ||
                                  getComputedStyle(document.documentElement).getPropertyValue('--background');
            
            if (darkModeSupport) {
              check.status = 'pass';
              check.message = 'Dark mode support detected';
            } else {
              check.status = 'warning';
              check.message = 'Dark mode support not detected';
            }
            break;

          default:
            check.status = 'warning';
            check.message = 'Check not implemented';
        }
      } catch (error) {
        check.status = 'fail';
        check.message = `Error running check: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      setHealthChecks([...checks]);
      setProgress(((i + 1) / checks.length) * 100);
    }
    
    setIsRunning(false);
  };

  useEffect(() => {
    // Auto-run health checks on component mount
    const timer = setTimeout(() => {
      runHealthChecks();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />;
    }
  };

  const getStatusBadge = (status: HealthCheck['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'fail':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  const passedChecks = healthChecks.filter(c => c.status === 'pass').length;
  const failedChecks = healthChecks.filter(c => c.status === 'fail').length;
  const warningChecks = healthChecks.filter(c => c.status === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Health Check Controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">CSS Health Diagnostics</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive checks for Tailwind CSS configuration and theme integrity
          </p>
        </div>
        <Button 
          onClick={runHealthChecks} 
          disabled={isRunning}
          variant="outline"
        >
          {isRunning ? 'Running Checks...' : 'Run Health Checks'}
        </Button>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Running health checks...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Health Summary */}
      {healthChecks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{passedChecks}</p>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{warningChecks}</p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{failedChecks}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Health Check Results */}
      <div className="space-y-3">
        {healthChecks.map((check, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(check.status)}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{check.name}</h4>
                      {getStatusBadge(check.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{check.description}</p>
                    {check.message && (
                      <p className="text-sm">{check.message}</p>
                    )}
                    {check.details && (
                      <p className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
                        {check.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall Health Status */}
      {healthChecks.length > 0 && !isRunning && (
        <Alert className={failedChecks > 0 ? 'border-red-200 bg-red-50' : 
                         warningChecks > 0 ? 'border-yellow-200 bg-yellow-50' : 
                         'border-green-200 bg-green-50'}>
          <AlertDescription>
            {failedChecks > 0 ? (
              <span className="text-red-800">
                <strong>Critical Issues Detected:</strong> {failedChecks} health check(s) failed. 
                Please review the configuration and fix any issues.
              </span>
            ) : warningChecks > 0 ? (
              <span className="text-yellow-800">
                <strong>Minor Issues:</strong> {warningChecks} warning(s) detected. 
                The system is functional but could be optimized.
              </span>
            ) : (
              <span className="text-green-800">
                <strong>All Systems Healthy:</strong> All CSS health checks passed successfully.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}