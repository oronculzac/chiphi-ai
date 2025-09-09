import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MTDTotalWidget } from '../mtd-total-widget';

// Mock data for testing
const mockMTDData = {
  current: 2847.32,
  previous: 2156.78,
  change: 690.54,
  changePercentage: 32.0,
};

const mockMTDDataDecrease = {
  current: 1856.45,
  previous: 2456.78,
  change: -600.33,
  changePercentage: -24.4,
};

const mockMTDDataNoPrevious = {
  current: 1234.56,
  previous: 0,
  change: 0,
  changePercentage: 0,
};

describe('MTDTotalWidget', () => {
  it('renders loading state correctly', () => {
    render(
      <MTDTotalWidget
        data={null}
        loading={true}
      />
    );

    expect(screen.getByTestId('mtd-widget')).toBeInTheDocument();
    expect(screen.getByText('Month to Date')).toBeInTheDocument();
    // Should show skeleton loaders
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRetry = vi.fn();
    render(
      <MTDTotalWidget
        data={null}
        loading={false}
        error="Failed to load MTD data"
        onRetry={mockRetry}
      />
    );

    expect(screen.getByText('Failed to load MTD data')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    
    // Test retry button
    fireEvent.click(screen.getByText('Retry'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('renders no data state correctly', () => {
    render(
      <MTDTotalWidget
        data={null}
        loading={false}
      />
    );

    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('No spending data available')).toBeInTheDocument();
  });

  it('renders MTD data with increase correctly', () => {
    render(
      <MTDTotalWidget
        data={mockMTDData}
        loading={false}
      />
    );

    expect(screen.getByTestId('mtd-total')).toHaveTextContent('$2,847.32');
    expect(screen.getByText('32.0%')).toBeInTheDocument();
    expect(screen.getByText('$690.54 increase from previous period')).toBeInTheDocument();
    
    // Should show red color for increase (spending up is bad)
    const trendElement = screen.getByText('32.0%').closest('div');
    expect(trendElement).toHaveClass('text-red-500');
  });

  it('renders MTD data with decrease correctly', () => {
    render(
      <MTDTotalWidget
        data={mockMTDDataDecrease}
        loading={false}
      />
    );

    expect(screen.getByTestId('mtd-total')).toHaveTextContent('$1,856.45');
    expect(screen.getByText('24.4%')).toBeInTheDocument();
    expect(screen.getByText('$600.33 decrease from previous period')).toBeInTheDocument();
    
    // Should show green color for decrease (spending down is good)
    const trendElement = screen.getByText('24.4%').closest('div');
    expect(trendElement).toHaveClass('text-green-500');
  });

  it('renders MTD data with no previous data correctly', () => {
    render(
      <MTDTotalWidget
        data={mockMTDDataNoPrevious}
        loading={false}
      />
    );

    expect(screen.getByTestId('mtd-total')).toHaveTextContent('$1,234.56');
    expect(screen.getByText('No comparison data available')).toBeInTheDocument();
    expect(screen.getByText('Total spending this month')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <MTDTotalWidget
        data={mockMTDData}
        loading={false}
      />
    );

    const widget = screen.getByTestId('mtd-widget');
    expect(widget).toHaveAttribute('role', 'article');
    expect(widget).toHaveAttribute('aria-labelledby', 'mtd-title');
    
    const title = screen.getByText('Month to Date');
    expect(title).toHaveAttribute('id', 'mtd-title');
    
    const total = screen.getByTestId('mtd-total');
    expect(total).toHaveAttribute('aria-label', 'Month to date total: $2,847.32');
  });

  it('formats currency correctly', () => {
    const testData = {
      current: 1234567.89,
      previous: 1000000,
      change: 234567.89,
      changePercentage: 23.46,
    };

    render(
      <MTDTotalWidget
        data={testData}
        loading={false}
      />
    );

    expect(screen.getByTestId('mtd-total')).toHaveTextContent('$1,234,567.89');
    expect(screen.getByText('$234,567.89 increase from previous period')).toBeInTheDocument();
  });

  it('handles zero change correctly', () => {
    const testData = {
      current: 1500.00,
      previous: 1500.00,
      change: 0,
      changePercentage: 0,
    };

    render(
      <MTDTotalWidget
        data={testData}
        loading={false}
      />
    );

    expect(screen.getByText('No change')).toBeInTheDocument();
    expect(screen.getByText('$0.00 no change from previous period')).toBeInTheDocument();
  });
});