'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface StyleTest {
  name: string;
  element: string;
  property: string;
  expectedValue?: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  actualValue?: string;
  message?: string;
}

export function StyleProbes() {
  const [styleTests, setStyleTests] = useState<StyleTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const runStyleTests = async () => {
    setIsRunning(true);
    setProgress(0);
    
    const tests: StyleTest[] = [
      {
        name: 'Button Background Color',
        element: '[data-testid="button-primary"]',
        property: 'backgroundColor',
        status: 'pending'
      },
      {
        name: 'Button Border Radius',
        element: '[data-testid="button-primary"]',
        property: 'borderRadius',
        status: 'pending'
      },
      {
        name: 'Card Border Width',
        element: '[data-testid="card-probe"]',
        property: 'borderWidth',
        status: 'pending'
      },
      {
        name: 'Card Background Color',
        element: '[data-testid="card-probe"]',
        property: 'backgroundColor',
        status: 'pending'
      },
      {
        name: 'Badge Font Weight',
        element: '[data-testid="badge-default"]',
        property: 'fontWeight',
        status: 'pending'
      },
      {
        name: 'Badge Padding',
        element: '[data-testid="badge-default"]',
        property: 'padding',
        status: 'pending'
      },
      {
        name: 'Input Border Color',
        element: '[data-testid="input-probe"]',
        property: 'borderColor',
        status: 'pending'
      },
      {
        name: 'Input Focus Ring',
        element: '[data-testid="input-probe"]:focus',
        property: 'outline',
        status: 'pending'
      }
    ];

    setStyleTests(tests);

    // Simulate style testing with computed style checks
    for (let i = 0; i < tests.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const test = tests[i];
      const element = document.querySelector(test.element);
      
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        const actualValue = computedStyle.getPropertyValue(test.property);
        
        // Basic validation - check if style is applied (not transparent/default)
        let status: 'pass' | 'fail' | 'warning' = 'pass';
        let message = 'Style applied correctly';
        
        if (test.property === 'backgroundColor' && actualValue === 'rgba(0, 0, 0, 0)') {
          status = 'fail';
          message = 'Background is transparent - Tailwind may not be loaded';
        } else if (test.property === 'borderRadius' && parseFloat(actualValue) === 0) {
          status = 'warning';
          message = 'No border radius applied';
        } else if (test.property === 'borderWidth' && parseFloat(actualValue) === 0) {
          status = 'warning';
          message = 'No border applied';
        }
        
        test.status = status;
        test.actualValue = actualValue;
        test.message = message;
      } else {
        test.status = 'fail';
        test.message = 'Element not found';
      }
      
      setStyleTests([...tests]);
      setProgress(((i + 1) / tests.length) * 100);
    }
    
    setIsRunning(false);
  };

  useEffect(() => {
    // Auto-run tests on component mount
    const timer = setTimeout(() => {
      runStyleTests();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const getStatusIcon = (status: StyleTest['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300 animate-pulse" />;
    }
  };

  const passedTests = styleTests.filter(t => t.status === 'pass').length;
  const failedTests = styleTests.filter(t => t.status === 'fail').length;
  const warningTests = styleTests.filter(t => t.status === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Test Controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Style Probe Tests</h3>
          <p className="text-sm text-muted-foreground">
            Automated verification of component styling and Tailwind CSS integration
          </p>
        </div>
        <Button 
          onClick={runStyleTests} 
          disabled={isRunning}
          variant="outline"
        >
          {isRunning ? 'Running Tests...' : 'Run Style Tests'}
        </Button>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Running style tests...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Test Results Summary */}
      {styleTests.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{passedTests}</p>
                  <p className="text-sm text-muted-foreground">Passed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{warningTests}</p>
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
                  <p className="text-2xl font-bold text-red-600">{failedTests}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* Style Probe Components */}
      <div className="space-y-6">
        <div>
          <h4 className="text-md font-semibold mb-4">Button Probes</h4>
          <div className="flex flex-wrap gap-3" data-testid="button-probe">
            <Button data-testid="button-primary" variant="default">
              Primary Button
            </Button>
            <Button data-testid="button-secondary" variant="secondary">
              Secondary Button
            </Button>
            <Button data-testid="button-outline" variant="outline">
              Outline Button
            </Button>
            <Button data-testid="button-ghost" variant="ghost">
              Ghost Button
            </Button>
            <Button data-testid="button-destructive" variant="destructive">
              Destructive Button
            </Button>
          </div>
        </div>

        <div>
          <h4 className="text-md font-semibold mb-4">Card Probes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-probe">
              <CardHeader>
                <CardTitle>Test Card</CardTitle>
                <CardDescription>
                  This card tests proper styling and layout
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card content with proper spacing and typography. This should render
                  with correct borders, background, and shadow effects.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-probe-2">
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="test-input">Test Input</Label>
                  <Input 
                    id="test-input"
                    data-testid="input-probe"
                    placeholder="Enter test text..."
                  />
                </div>
                <Button size="sm" className="w-full">
                  Test Action
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <h4 className="text-md font-semibold mb-4">Badge Probes</h4>
          <div className="flex flex-wrap gap-2" data-testid="badge-probe">
            <Badge data-testid="badge-default" variant="default">
              Default Badge
            </Badge>
            <Badge data-testid="badge-secondary" variant="secondary">
              Secondary Badge
            </Badge>
            <Badge data-testid="badge-outline" variant="outline">
              Outline Badge
            </Badge>
            <Badge data-testid="badge-destructive" variant="destructive">
              Destructive Badge
            </Badge>
          </div>
        </div>

        <div>
          <h4 className="text-md font-semibold mb-4">Alert Probes</h4>
          <div className="space-y-3">
            <Alert data-testid="alert-default">
              <AlertDescription>
                This is a default alert to test styling and layout.
              </AlertDescription>
            </Alert>
            <Alert data-testid="alert-destructive" variant="destructive">
              <AlertDescription>
                This is a destructive alert to test error styling.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      <Separator />

      {/* Test Results Details */}
      {styleTests.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-semibold">Detailed Test Results</h4>
          <div className="space-y-2">
            {styleTests.map((test, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <p className="font-medium">{test.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {test.element} → {test.property}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {test.actualValue && (
                    <p className="text-sm font-mono">{test.actualValue}</p>
                  )}
                  {test.message && (
                    <p className="text-xs text-muted-foreground">{test.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}