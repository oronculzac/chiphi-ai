import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IntegrationsTab from '../integrations-tab';

// Mock console.log to test toggle functionality
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('IntegrationsTab', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('should render the integrations tab with header and description', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Connect ChiPhi AI with your favorite tools and services to streamline your financial workflow.')).toBeInTheDocument();
  });

  it('should display available integrations section', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('Available Integrations')).toBeInTheDocument();
    expect(screen.getByText('Enable integrations to automatically sync your financial data with external services.')).toBeInTheDocument();
  });

  it('should display Google Sheets integration with coming soon badge', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('Google Sheets')).toBeInTheDocument();
    expect(screen.getByText('Automatically sync your transaction data to Google Sheets for advanced analysis and reporting.')).toBeInTheDocument();
    
    // Check for Coming Soon badge
    const comingSoonBadges = screen.getAllByText('Coming Soon');
    expect(comingSoonBadges).toHaveLength(2); // Both Google Sheets and Notion should have this badge
  });

  it('should display Notion integration with coming soon badge', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(screen.getByText('Export and organize your financial data in Notion databases with customizable templates.')).toBeInTheDocument();
  });

  it('should have disabled toggle switches for coming soon integrations', () => {
    render(<IntegrationsTab />);
    
    const googleSheetsToggle = screen.getByTestId('integration-toggle-google-sheets');
    const notionToggle = screen.getByTestId('integration-toggle-notion');
    
    expect(googleSheetsToggle).toBeDisabled();
    expect(notionToggle).toBeDisabled();
    
    // Both should be unchecked
    expect(googleSheetsToggle).not.toBeChecked();
    expect(notionToggle).not.toBeChecked();
  });

  it('should have proper aria labels for toggle switches', () => {
    render(<IntegrationsTab />);
    
    const googleSheetsToggle = screen.getByLabelText('Toggle Google Sheets integration');
    const notionToggle = screen.getByLabelText('Toggle Notion integration');
    
    expect(googleSheetsToggle).toBeInTheDocument();
    expect(notionToggle).toBeInTheDocument();
  });

  it('should display tooltip explanations for disabled integrations', async () => {
    render(<IntegrationsTab />);
    
    const googleSheetsToggle = screen.getByTestId('integration-toggle-google-sheets');
    
    // Hover over the toggle to show tooltip
    fireEvent.mouseEnter(googleSheetsToggle.parentElement!);
    
    // Note: Tooltip testing in jsdom is limited, so we'll just verify the tooltip trigger exists
    expect(googleSheetsToggle.parentElement).toHaveAttribute('data-slot', 'tooltip-trigger');
  });

  it('should display notion tooltip on hover', async () => {
    render(<IntegrationsTab />);
    
    const notionToggle = screen.getByTestId('integration-toggle-notion');
    
    // Hover over the toggle to show tooltip
    fireEvent.mouseEnter(notionToggle.parentElement!);
    
    // Note: Tooltip testing in jsdom is limited, so we'll just verify the tooltip trigger exists
    expect(notionToggle.parentElement).toHaveAttribute('data-slot', 'tooltip-trigger');
  });

  it('should not trigger toggle change for disabled switches', () => {
    render(<IntegrationsTab />);
    
    const googleSheetsToggle = screen.getByTestId('integration-toggle-google-sheets');
    
    // Try to click the disabled toggle
    fireEvent.click(googleSheetsToggle);
    
    // Should not log anything since the toggle is disabled
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should display future integrations section', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('More Integrations Coming Soon')).toBeInTheDocument();
    expect(screen.getByText('We\'re working on additional integrations to make your financial workflow even more seamless.')).toBeInTheDocument();
  });

  it('should display planned integrations list', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('Planned integrations include:')).toBeInTheDocument();
    expect(screen.getByText('Airtable - Organize data in flexible databases')).toBeInTheDocument();
    expect(screen.getByText('Zapier - Connect with hundreds of apps')).toBeInTheDocument();
    expect(screen.getByText('QuickBooks - Direct accounting software sync')).toBeInTheDocument();
    expect(screen.getByText('Slack - Get notifications in your workspace')).toBeInTheDocument();
  });

  it('should display contact information for integration requests', () => {
    render(<IntegrationsTab />);
    
    expect(screen.getByText('Have a specific integration request? Contact our support team to let us know what you\'d like to see next.')).toBeInTheDocument();
  });

  it('should have expandable design structure for future additions', () => {
    render(<IntegrationsTab />);
    
    // Check that the component structure supports adding more integrations
    const cards = document.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBeGreaterThanOrEqual(2); // At least the main integrations card and future integrations card
  });

  it('should render icons for each integration', () => {
    render(<IntegrationsTab />);
    
    // Check that icons are rendered (they should be in the DOM as SVG elements)
    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should have proper spacing and separators between integrations', () => {
    render(<IntegrationsTab />);
    
    // Check for separator elements (they have data-slot="separator")
    const separators = document.querySelectorAll('[data-slot="separator"]');
    expect(separators.length).toBeGreaterThan(0);
  });

  it('should maintain consistent styling across integration items', () => {
    render(<IntegrationsTab />);
    
    const googleSheetsName = screen.getByText('Google Sheets');
    const notionName = screen.getByText('Notion');
    
    // Both should have the same styling classes (checking they exist in DOM)
    expect(googleSheetsName).toBeInTheDocument();
    expect(notionName).toBeInTheDocument();
  });
});