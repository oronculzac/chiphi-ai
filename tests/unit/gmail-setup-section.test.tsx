import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GmailSetupSection } from '@/components/settings/gmail-setup-section';

// Mock the CopyButton component
vi.mock('@/components/ui/copy-button', () => ({
  CopyButton: ({ text, label, 'data-testid': testId }: any) => (
    <button data-testid={testId} data-copy-text={text}>
      {label}
    </button>
  ),
}));

describe('GmailSetupSection', () => {
  const mockEmailAlias = 'u_test123@chiphi.oronculzac.com';

  it('should render Gmail setup instructions', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    expect(screen.getByText('Gmail Setup Instructions')).toBeInTheDocument();
    expect(screen.getByText('Configure Gmail to automatically forward receipts to your ChiPhi AI alias.')).toBeInTheDocument();
  });

  it('should generate correct Gmail filter string', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    const expectedFilterString = `to:(${mockEmailAlias}) OR subject:(receipt OR invoice OR purchase OR order OR payment)`;
    const filterElement = screen.getByTestId('gmail-filter-string');
    
    expect(filterElement).toHaveTextContent(expectedFilterString);
  });

  it('should render copy button for Gmail filter', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    const copyButton = screen.getByTestId('copy-gmail-filter-button');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute('data-copy-text', expect.stringContaining(mockEmailAlias));
  });

  it('should display all setup steps', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    expect(screen.getByText('Open Gmail Settings')).toBeInTheDocument();
    expect(screen.getByText('Create New Filter')).toBeInTheDocument();
    expect(screen.getByText('Set Filter Action')).toBeInTheDocument();
    expect(screen.getByText('Apply Filter')).toBeInTheDocument();
  });

  it('should include email alias in step 3 description', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    expect(screen.getByText(`Choose "Forward it to" and enter your alias: ${mockEmailAlias}. Important: Add "[AICHIPHI]" to the subject line when forwarding.`)).toBeInTheDocument();
  });

  it('should display mobile-specific instructions', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    expect(screen.getByText('Mobile Gmail App')).toBeInTheDocument();
    expect(screen.getByText(/For mobile setup, use the Gmail web interface/)).toBeInTheDocument();
    expect(screen.getByText('Desktop Required')).toBeInTheDocument();
    expect(screen.getByText('Web Interface Only')).toBeInTheDocument();
  });

  it('should display pro tips section', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();
    expect(screen.getByText(/Test the filter by sending a test email/)).toBeInTheDocument();
    expect(screen.getByText(/You can modify the filter criteria/)).toBeInTheDocument();
    expect(screen.getByText(/Consider creating a Gmail label/)).toBeInTheDocument();
  });

  it('should have proper responsive layout classes', () => {
    render(<GmailSetupSection emailAlias={mockEmailAlias} />);

    // Check for responsive classes on filter string container
    const filterContainer = screen.getByTestId('gmail-filter-string').closest('.flex');
    expect(filterContainer).toHaveClass('items-center', 'justify-between', 'gap-3');

    // Check for break-all class on filter string for mobile
    const filterString = screen.getByTestId('gmail-filter-string');
    expect(filterString).toHaveClass('break-all');
  });

  it('should generate filter string with correct format', () => {
    const testAlias = 'u_example@chiphi.oronculzac.com';
    render(<GmailSetupSection emailAlias={testAlias} />);

    const filterString = screen.getByTestId('gmail-filter-string').textContent;
    
    // Should include the alias
    expect(filterString).toContain(`to:(${testAlias})`);
    
    // Should include OR operator
    expect(filterString).toContain(' OR ');
    
    // Should include subject keywords
    expect(filterString).toContain('subject:(receipt OR invoice OR purchase OR order OR payment)');
  });

  it('should handle long email aliases gracefully', () => {
    const longAlias = 'u_very_long_organization_name_with_many_characters@chiphi.oronculzac.com';
    render(<GmailSetupSection emailAlias={longAlias} />);

    const filterElement = screen.getByTestId('gmail-filter-string');
    expect(filterElement).toHaveClass('break-all');
    
    // Check that the full filter string contains the long alias
    const filterText = filterElement.textContent || '';
    expect(filterText).toContain(longAlias);
    expect(filterText).toContain('to:(');
    expect(filterText).toContain(') OR subject:(');
  });
});