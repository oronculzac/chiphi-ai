import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { ErrorBoundary, SettingsTabErrorBoundary } from '../error-boundary';

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('resets error state when retry button is clicked', async () => {
    let shouldThrow = true;
    const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

    const { rerender } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Change the component to not throw
    shouldThrow = false;
    
    // Click retry button
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Rerender with the updated component
    rerender(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  it('reloads page when reload button is clicked', () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /reload page/i }));

    expect(mockReload).toHaveBeenCalled();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('resets when resetKeys change', () => {
    let resetKey = 'key1';
    const TestComponent = () => <ThrowError shouldThrow={resetKey === 'key1'} />;

    const { rerender } = render(
      <ErrorBoundary resetKeys={[resetKey]}>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Change reset key
    resetKey = 'key2';
    rerender(
      <ErrorBoundary resetKeys={[resetKey]}>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('shows stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Stack Trace (Development)')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('hides stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Stack Trace (Development)')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('SettingsTabErrorBoundary', () => {
  it('renders tab-specific error message', () => {
    render(
      <SettingsTabErrorBoundary tabName="Organization">
        <ThrowError />
      </SettingsTabErrorBoundary>
    );

    expect(screen.getByText('Error in Organization Tab')).toBeInTheDocument();
    expect(screen.getByText(/This tab encountered an error/)).toBeInTheDocument();
  });

  it('isolates errors to prevent full page crashes', () => {
    const onError = vi.fn();

    render(
      <div>
        <div>Other content</div>
        <SettingsTabErrorBoundary tabName="Test" onError={onError}>
          <ThrowError />
        </SettingsTabErrorBoundary>
      </div>
    );

    // Other content should still be visible
    expect(screen.getByText('Other content')).toBeInTheDocument();
    // Error should be contained to the tab
    expect(screen.getByText('Error in Test Tab')).toBeInTheDocument();
  });
});