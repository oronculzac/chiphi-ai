import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { ErrorBoundary } from '../error-boundary';
import { LoadingSpinner, ErrorStateWithRetry } from '../loading-states';

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

describe('Error Handling Components', () => {
  describe('ErrorBoundary', () => {
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
  });

  describe('LoadingSpinner', () => {
    it('renders with default message', () => {
      render(<LoadingSpinner />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with custom message', () => {
      render(<LoadingSpinner message="Custom loading message" />);
      
      expect(screen.getByText('Custom loading message')).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />);
      
      // Check that the component renders without error
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      rerender(<LoadingSpinner size="lg" />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('ErrorStateWithRetry', () => {
    it('renders error message and retry button', () => {
      const mockError = new Error('Test error message');
      const mockRetry = vi.fn();

      render(
        <ErrorStateWithRetry
          error={mockError}
          onRetry={mockRetry}
          title="Custom Error Title"
          description="Custom error description"
        />
      );

      expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
      expect(screen.getByText('Custom error description')).toBeInTheDocument();
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('shows loading state when retrying', () => {
      const mockError = new Error('Test error');
      const mockRetry = vi.fn();

      render(
        <ErrorStateWithRetry
          error={mockError}
          onRetry={mockRetry}
          loading={true}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeDisabled();
    });

    it('shows attempt count', () => {
      const mockError = new Error('Test error');
      const mockRetry = vi.fn();

      render(
        <ErrorStateWithRetry
          error={mockError}
          onRetry={mockRetry}
          attempt={2}
        />
      );

      expect(screen.getByRole('button', { name: /retry \(2\)/i })).toBeInTheDocument();
    });

    it('uses error message as fallback description', () => {
      const mockError = new Error('Specific error message');
      const mockRetry = vi.fn();

      render(
        <ErrorStateWithRetry
          error={mockError}
          onRetry={mockRetry}
        />
      );

      expect(screen.getByText('Specific error message')).toBeInTheDocument();
    });
  });
});

// Restore console.error after tests
afterEach(() => {
  console.error = originalConsoleError;
});