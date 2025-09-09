'use client';

import { useState } from 'react';
import { MTDTotalWidget } from './mtd-total-widget';
import { Button } from '@/components/ui/button';

// Mock data for testing different states
const mockDataStates = {
  loading: null,
  error: null,
  noData: null,
  noPrevious: {
    current: 1234.56,
    previous: 0,
    change: 0,
    changePercentage: 0,
  },
  increase: {
    current: 2847.32,
    previous: 2156.78,
    change: 690.54,
    changePercentage: 32.0,
  },
  decrease: {
    current: 1856.45,
    previous: 2456.78,
    change: -600.33,
    changePercentage: -24.4,
  },
  noChange: {
    current: 1500.00,
    previous: 1500.00,
    change: 0,
    changePercentage: 0,
  },
};

export function MTDTotalWidgetDemo() {
  const [currentState, setCurrentState] = useState<keyof typeof mockDataStates>('increase');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStateChange = (state: keyof typeof mockDataStates) => {
    setCurrentState(state);
    setLoading(state === 'loading');
    setError(state === 'error' ? 'Failed to load MTD data' : null);
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentState('increase');
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={currentState === 'loading' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('loading')}
        >
          Loading
        </Button>
        <Button
          variant={currentState === 'error' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('error')}
        >
          Error
        </Button>
        <Button
          variant={currentState === 'noData' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('noData')}
        >
          No Data
        </Button>
        <Button
          variant={currentState === 'noPrevious' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('noPrevious')}
        >
          No Previous
        </Button>
        <Button
          variant={currentState === 'increase' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('increase')}
        >
          Increase
        </Button>
        <Button
          variant={currentState === 'decrease' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('decrease')}
        >
          Decrease
        </Button>
        <Button
          variant={currentState === 'noChange' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleStateChange('noChange')}
        >
          No Change
        </Button>
      </div>
      
      <div className="max-w-sm">
        <MTDTotalWidget
          data={mockDataStates[currentState]}
          loading={loading}
          error={error}
          onRetry={handleRetry}
        />
      </div>
      
      <div className="text-sm text-muted-foreground">
        <p><strong>Current State:</strong> {currentState}</p>
        {mockDataStates[currentState] && (
          <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap break-words text-foreground">
            {JSON.stringify(mockDataStates[currentState], null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}