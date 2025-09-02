import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DemoDashboardAnalytics } from '../demo-dashboard-analytics';

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

describe('DemoDashboardAnalytics', () => {
  it('renders analytics dashboard with key metrics', () => {
    render(<DemoDashboardAnalytics orgId="test-org-id" />);

    // Check for main title
    expect(screen.getByText('Real-time Analytics Dashboard')).toBeInTheDocument();

    // Check for key metric cards
    expect(screen.getByText('Month to Date')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Top Category')).toBeInTheDocument();
    expect(screen.getByText('30-Day Trend')).toBeInTheDocument();

    // Check for chart titles
    expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
    expect(screen.getByText('30-Day Spending Trend')).toBeInTheDocument();

    // Check for refresh button
    expect(screen.getByText('Refresh')).toBeInTheDocument();

    // Check for real-time indicator
    expect(screen.getByText(/Real-time updates active/)).toBeInTheDocument();
  });

  it('displays mock data correctly', () => {
    render(<DemoDashboardAnalytics orgId="test-org-id" />);

    // Check that currency formatting is working
    expect(screen.getByText(/\$2,847\.32/)).toBeInTheDocument();

    // Check that top category is displayed
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('renders charts', () => {
    render(<DemoDashboardAnalytics orgId="test-org-id" />);

    // Check that chart components are rendered
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(1);
    expect(screen.getAllByTestId('line-chart')).toHaveLength(1);
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(2);
  });
});