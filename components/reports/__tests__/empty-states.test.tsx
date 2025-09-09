import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { 
  MTDEmptyState, 
  CategoryEmptyState, 
  TrendEmptyState, 
  ReportsEmptyState 
} from '../empty-states';

describe('Empty States', () => {
  describe('MTDEmptyState', () => {
    it('should render no-transactions variant correctly', () => {
      render(
        <MTDEmptyState 
          variant="no-transactions" 
        />
      );
      
      expect(screen.getByText('No Transactions Yet')).toBeInTheDocument();
      expect(screen.getByText('Start by forwarding your first receipt email to begin tracking your expenses.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /learn how to add receipts/i })).toBeInTheDocument();
    });

    it('should render filtered-out variant with action buttons', () => {
      const mockWidenRange = vi.fn();
      const mockClearFilters = vi.fn();
      
      render(
        <MTDEmptyState 
          variant="filtered-out"
          onWidenRange={mockWidenRange}
          onClearFilters={mockClearFilters}
          currentRange="last30"
        />
      );
      
      expect(screen.getByText('No Data for Current Filters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /last 90 days/i })).toBeInTheDocument();
      
      // Test button interactions
      fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
      expect(mockClearFilters).toHaveBeenCalled();
      
      fireEvent.click(screen.getByRole('button', { name: /last 90 days/i }));
      expect(mockWidenRange).toHaveBeenCalledWith('last90');
    });

    it('should render no-data variant with widen range buttons', () => {
      const mockWidenRange = vi.fn();
      
      render(
        <MTDEmptyState 
          variant="no-data"
          onWidenRange={mockWidenRange}
        />
      );
      
      expect(screen.getByText('No Spending Data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /last 90 days/i })).toBeInTheDocument();
    });
  });

  describe('CategoryEmptyState', () => {
    it('should render no-transactions variant correctly', () => {
      render(
        <CategoryEmptyState 
          variant="no-transactions" 
        />
      );
      
      expect(screen.getByText('No Categories to Show')).toBeInTheDocument();
      expect(screen.getByText('Once you start processing receipts, you\'ll see a breakdown of spending by category here.')).toBeInTheDocument();
    });

    it('should render filtered-out variant with clear filters option', () => {
      const mockClearFilters = vi.fn();
      
      render(
        <CategoryEmptyState 
          variant="filtered-out"
          onClearFilters={mockClearFilters}
        />
      );
      
      expect(screen.getByText('No Categories Match Filters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
      expect(mockClearFilters).toHaveBeenCalled();
    });
  });

  describe('TrendEmptyState', () => {
    it('should render no-transactions variant correctly', () => {
      render(
        <TrendEmptyState 
          variant="no-transactions" 
        />
      );
      
      expect(screen.getByText('No Trends to Display')).toBeInTheDocument();
      expect(screen.getByText('Start tracking expenses to see spending trends and patterns over time.')).toBeInTheDocument();
    });

    it('should render filtered-out variant with action buttons', () => {
      const mockClearFilters = vi.fn();
      const mockWidenRange = vi.fn();
      
      render(
        <TrendEmptyState 
          variant="filtered-out"
          onClearFilters={mockClearFilters}
          onWidenRange={mockWidenRange}
        />
      );
      
      expect(screen.getByText('No Trend Data Available')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
      expect(mockClearFilters).toHaveBeenCalled();
    });
  });

  describe('ReportsEmptyState', () => {
    it('should render welcome state for new organizations', () => {
      const mockGetStarted = vi.fn();
      
      render(
        <ReportsEmptyState 
          hasAnyTransactions={false}
          onGetStarted={mockGetStarted}
        />
      );
      
      expect(screen.getByText('Welcome to Reports')).toBeInTheDocument();
      expect(screen.getByText('Start by processing your first receipt to see detailed financial analytics and insights here.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));
      expect(mockGetStarted).toHaveBeenCalled();
    });

    it('should render filtered state for organizations with transactions', () => {
      const mockClearFilters = vi.fn();
      const mockWidenRange = vi.fn();
      
      render(
        <ReportsEmptyState 
          hasAnyTransactions={true}
          onClearFilters={mockClearFilters}
          onWidenRange={mockWidenRange}
        />
      );
      
      expect(screen.getByText('No Data for Current Selection')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
      expect(mockClearFilters).toHaveBeenCalled();
    });
  });

  describe('Quick Action Buttons', () => {
    it('should disable buttons based on current range', () => {
      const mockWidenRange = vi.fn();
      
      render(
        <MTDEmptyState 
          variant="filtered-out"
          onWidenRange={mockWidenRange}
          currentRange="last90"
        />
      );
      
      const last90Button = screen.getByRole('button', { name: /last 90 days/i });
      expect(last90Button).toBeDisabled();
      
      const last6MonthsButton = screen.getByRole('button', { name: /last 6 months/i });
      expect(last6MonthsButton).not.toBeDisabled();
    });
  });
});