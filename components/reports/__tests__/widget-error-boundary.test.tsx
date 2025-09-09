import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { WidgetErrorBoundary, withErrorBoundary, determineEmptyStateVariant } from '../widget-error-boundary';

// Mock component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Component rendered successfully</div>;
};

// Mock component for testing HOC
const MockWidget = ({ data }: { data: string }) => {
  return <div>Widget with data: {data}</div>;
};

const WrappedWidget = withErrorBoundary(MockWidget, 'Test Widget', {
  fallbackTitle: 'Test Widget Error',
  showTechnicalDetails: true
});

describe('WidgetErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error occurs', () => {
    render(
      <WidgetErrorBoundary widgetName="Test Widget">
        <ThrowError shouldThrow={false} />
      </WidgetErrorBoundary>
    );
    
    expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
  });

  it('should render error UI when child component throws', () => {
    render(
      <WidgetErrorBoundary widgetName="Test Widget" fallbackTitle="Custom Error Title">
        <ThrowError shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
  });

  it('should show technical details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <WidgetErrorBoundary widgetName="Test Widget" showTechnicalDetails={true}>
        <ThrowError shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    
    expect(screen.getByText('Technical Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log details/i })).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should call onRetry when retry button is clicked', () => {
    const mockRetry = vi.fn();
    
    render(
      <WidgetErrorBoundary widgetName="Test Widget" onRetry={mockRetry}>
        <ThrowError shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockRetry).toHaveBeenCalled();
  });

  it('should work with HOC wrapper', () => {
    render(<WrappedWidget data="test data" />);
    expect(screen.getByText('Widget with data: test data')).toBeInTheDocument();
  });

  it('should handle retry count and show retry attempts', () => {
    const { rerender } = render(
      <WidgetErrorBoundary widgetName="Test Widget">
        <ThrowError shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    
    // First error
    expect(screen.getByText('Test Widget Error')).toBeInTheDocument();
    
    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    
    // Simulate another error after retry
    rerender(
      <WidgetErrorBoundary widgetName="Test Widget">
        <ThrowError shouldThrow={true} />
      </WidgetErrorBoundary>
    );
  });

  describe('Error severity classification', () => {
    it('should classify network errors as medium severity', () => {
      const NetworkError = () => {
        throw new Error('NetworkError: Failed to fetch');
      };
      
      render(
        <WidgetErrorBoundary widgetName="Test Widget">
          <NetworkError />
        </WidgetErrorBoundary>
      );
      
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    });

    it('should classify TypeError as high severity', () => {
      const TypeError = () => {
        const error = new Error('Cannot read property of undefined');
        error.name = 'TypeError';
        throw error;
      };
      
      render(
        <WidgetErrorBoundary widgetName="Test Widget">
          <TypeError />
        </WidgetErrorBoundary>
      );
      
      expect(screen.getByText(/critical error occurred/i)).toBeInTheDocument();
    });
  });
});

describe('determineEmptyStateVariant', () => {
  it('should return no-transactions when hasAnyTransactions is false', () => {
    const result = determineEmptyStateVariant([], false, false);
    expect(result).toBe('no-transactions');
  });

  it('should return filtered-out when has active filters and no data', () => {
    const result = determineEmptyStateVariant([], true, true);
    expect(result).toBe('filtered-out');
  });

  it('should return no-data for other cases', () => {
    const result = determineEmptyStateVariant([], true, false);
    expect(result).toBe('no-data');
  });

  it('should return filtered-out when data is null and has active filters', () => {
    const result = determineEmptyStateVariant(null, true, true);
    expect(result).toBe('filtered-out');
  });
});