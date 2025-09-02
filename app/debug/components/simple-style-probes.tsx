'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SimpleStyleProbes() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Style Probe Tests</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Basic style verification for core UI components
        </p>
      </div>

      {/* Button Probes */}
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

      {/* Card Probes */}
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

      {/* Badge Probes */}
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

      {/* Style Test Results */}
      <div className="mt-8 p-4 border rounded-lg bg-muted/50">
        <h4 className="text-md font-semibold mb-2">MCP Integration Status</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>shadcn MCP: Ready for component audit and management</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Playwright MCP: Ready for automated testing and validation</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Visual Regression: Tests configured for 1% threshold</span>
          </div>
        </div>
      </div>
    </div>
  );
}