import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryBreakdownWidget } from '../category-breakdown-widget';

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children, ...props }: any) => (
    <div data-testid="pie-chart" {...props}>
      {children}
    </div>
  ),
  Pie: ({ data, onClick, ...props }: any) => (
    <div data-testid="pie" {...props}>
      {data?.map((item: any, index: number) => (
        <div
          key={index}
          data-testid={`pie-segment-${item.category}`}
          onClick={() => onClick?.(item)}
          style={{ cursor: 'pointer' }}
        >
          {item.category}: {item.amount}
        </div>
      ))}
    </div>
  ),
  Cell: ({ fill, ...props }: any) => (
    <div data-testid="pie-cell" style={{ backgroundColor: fill }} {...props} />
  ),
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip">{content}</div>
  ),
  Legend: ({ content }: any) => {
    // Mock the payload that would normally be provided by Recharts
    const mockPayload = [
      { payload: { category: 'Food & Dining', amount: 500 }, color: '#2563eb' },
      { payload: { category: 'Transportation', amount: 300 }, color: '#dc2626' },
      { payload: { category: 'Shopping', amount: 250 }, color: '#16a34a' },
    ];
    return (
      <div data-testid="legend">
        {content && typeof content === 'function' 
          ? content({ payload: mockPayload })
          : content && React.isValidElement(content)
          ? React.cloneElement(content, { payload: mockPayload })
          : content
        }
      </div>
    );
  },
}));

const mockCategoryData = [
  { category: 'Food & Dining', amount: 500, percentage: 35, count: 15 },
  { category: 'Transportation', amount: 300, percentage: 21, count: 8 },
  { category: 'Shopping', amount: 250, percentage: 17.5, count: 12 },
  { category: 'Entertainment', amount: 200, percentage: 14, count: 6 },
  { category: 'Utilities', amount: 100, percentage: 7, count: 3 },
  { category: 'Healthcare', amount: 75, percentage: 5.25, count: 2 },
];

const mockLargeCategoryData = [
  { category: 'Food & Dining', amount: 500, percentage: 25, count: 15 },
  { category: 'Transportation', amount: 300, percentage: 15, count: 8 },
  { category: 'Shopping', amount: 250, percentage: 12.5, count: 12 },
  { category: 'Entertainment', amount: 200, percentage: 10, count: 6 },
  { category: 'Utilities', amount: 150, percentage: 7.5, count: 3 },
  { category: 'Healthcare', amount: 125, percentage: 6.25, count: 2 },
  { category: 'Education', amount: 100, percentage: 5, count: 4 },
  { category: 'Travel', amount: 100, percentage: 5, count: 2 },
  { category: 'Insurance', amount: 75, percentage: 3.75, count: 1 },
  { category: 'Subscriptions', amount: 50, percentage: 2.5, count: 5 },
  { category: 'Gifts', amount: 50, percentage: 2.5, count: 3 },
];

describe('CategoryBreakdownWidget', () => {
  const mockOnCategoryClick = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    render(
      <CategoryBreakdownWidget
        data={[]}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={true}
      />
    );

    expect(screen.getByTestId('category-widget')).toBeInTheDocument();
    expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
    // Check for skeleton elements using data-slot attribute
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(4); // 1 circular + 3 rectangular skeletons
  });

  it('renders error state correctly', () => {
    const errorMessage = 'Failed to load category data';
    
    render(
      <CategoryBreakdownWidget
        data={[]}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
        error={errorMessage}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Retry'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty state correctly', () => {
    render(
      <CategoryBreakdownWidget
        data={[]}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    expect(screen.getByText('No category data available')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your date range or filters')).toBeInTheDocument();
  });

  it('renders category data correctly', () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    expect(screen.getByText('Transportation')).toBeInTheDocument();
    expect(screen.getByText('Shopping')).toBeInTheDocument();
  });

  it('handles category click from chart segment', async () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    const foodSegment = screen.getByTestId('pie-segment-Food & Dining');
    fireEvent.click(foodSegment);

    await waitFor(() => {
      expect(mockOnCategoryClick).toHaveBeenCalledWith('Food & Dining');
    });
  });

  it('handles category click from legend', async () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    // The legend is rendered as part of the component
    // We need to find the button for the category
    const foodButton = screen.getByLabelText('Filter by Food & Dining');
    fireEvent.click(foodButton);

    await waitFor(() => {
      expect(mockOnCategoryClick).toHaveBeenCalledWith('Food & Dining');
    });
  });

  it('shows active filter indication', () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={['Food & Dining']}
        loading={false}
      />
    );

    expect(screen.getByText('(1 filter active)')).toBeInTheDocument();
    expect(screen.getByText('Clear Category Filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove filter for Food & Dining')).toBeInTheDocument();
  });

  it('shows multiple active filters indication', () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={['Food & Dining', 'Transportation']}
        loading={false}
      />
    );

    expect(screen.getByText('(2 filters active)')).toBeInTheDocument();
    expect(screen.getByText('Clear Category Filters')).toBeInTheDocument();
  });

  it('handles clear all filters', async () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={['Food & Dining', 'Transportation']}
        loading={false}
      />
    );

    const clearButton = screen.getByText('Clear Category Filters');
    fireEvent.click(clearButton);

    await waitFor(() => {
      // Should call onCategoryClick for each selected category to clear them
      expect(mockOnCategoryClick).toHaveBeenCalledWith('Food & Dining');
      expect(mockOnCategoryClick).toHaveBeenCalledWith('Transportation');
      expect(mockOnCategoryClick).toHaveBeenCalledTimes(2);
    });
  });

  it('groups categories into "Other" when more than 8 categories', () => {
    render(
      <CategoryBreakdownWidget
        data={mockLargeCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    // Should show top 7 categories plus "Other" in pie segments
    expect(screen.getByTestId('pie-segment-Food & Dining')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Transportation')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Shopping')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Entertainment')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Utilities')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Healthcare')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Education')).toBeInTheDocument();
    expect(screen.getByTestId('pie-segment-Other')).toBeInTheDocument();

    // Should not show the smaller categories individually in pie segments
    expect(screen.queryByTestId('pie-segment-Travel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-segment-Insurance')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-segment-Subscriptions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-segment-Gifts')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    const widget = screen.getByTestId('category-widget');
    expect(widget).toHaveAttribute('role', 'article');
    expect(widget).toHaveAttribute('aria-labelledby', 'category-title');
    
    const title = screen.getByText('Category Breakdown');
    expect(title).toHaveAttribute('id', 'category-title');
  });

  it('formats currency correctly in legend', () => {
    render(
      <CategoryBreakdownWidget
        data={mockCategoryData}
        onCategoryClick={mockOnCategoryClick}
        selectedCategories={[]}
        loading={false}
      />
    );

    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
  });
});