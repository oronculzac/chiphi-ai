import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import GmailSetupWizard from '../gmail-setup-wizard'

// Mock the hooks and services
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

describe('GmailSetupWizard', () => {
  const mockOnComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API response
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        alias: {
          id: 'test-id',
          orgId: 'test-org',
          aliasEmail: 'receipts-test@example.com',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    })
  })

  it('renders welcome step initially', () => {
    render(<GmailSetupWizard onComplete={mockOnComplete} />)
    
    expect(screen.getByText('Welcome to Gmail Setup')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument()
  })

  it('shows provided alias email when passed as prop', async () => {
    const testEmail = 'test@example.com'
    render(<GmailSetupWizard aliasEmail={testEmail} onComplete={mockOnComplete} />)
    
    // Navigate to step 2
    fireEvent.click(screen.getByText('Continue'))
    
    await waitFor(() => {
      expect(screen.getByText(testEmail)).toBeInTheDocument()
    })
  })

  it('creates new alias when none provided', async () => {
    render(<GmailSetupWizard onComplete={mockOnComplete} />)
    
    // Navigate to step 2
    fireEvent.click(screen.getByText('Continue'))
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/inbox-alias', {
        method: 'POST',
      })
    })
  })

  it('allows navigation through all steps', async () => {
    render(<GmailSetupWizard aliasEmail="test@example.com" onComplete={mockOnComplete} />)
    
    // Step 1 -> 2
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => {
      expect(screen.getByText('Your Unique Forwarding Address')).toBeInTheDocument()
    })

    // Step 2 -> 3
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Open Gmail Settings')).toBeInTheDocument()

    // Step 3 -> 4
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Add Forwarding Address')).toBeInTheDocument()

    // Step 4 -> 5
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Verify Forwarding Address')).toBeInTheDocument()
  })

  it('requires verification code to proceed from step 5', async () => {
    render(<GmailSetupWizard aliasEmail="test@example.com" onComplete={mockOnComplete} />)
    
    // Navigate to step 5
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('Continue'))
      await waitFor(() => {}) // Wait for any async operations
    }

    // Should be disabled without verification code
    const continueButton = screen.getByText('Continue')
    expect(continueButton).toBeDisabled()

    // Enter verification code
    const codeInput = screen.getByPlaceholderText('Enter verification code from Gmail')
    fireEvent.change(codeInput, { target: { value: 'TEST123' } })

    // Should now be enabled
    expect(continueButton).not.toBeDisabled()
  })

  it('calls onComplete when finishing setup', async () => {
    render(<GmailSetupWizard aliasEmail="test@example.com" onComplete={mockOnComplete} />)
    
    // Navigate to final step
    for (let i = 0; i < 7; i++) {
      if (i === 4) {
        // Add verification code at step 5
        const codeInput = screen.getByPlaceholderText('Enter verification code from Gmail')
        fireEvent.change(codeInput, { target: { value: 'TEST123' } })
      }
      if (i === 6) {
        // Skip test step by clicking continue directly
        fireEvent.click(screen.getByText('Continue'))
      } else {
        fireEvent.click(screen.getByText('Continue'))
      }
      await waitFor(() => {}) // Wait for any async operations
    }

    // Should be on final step
    expect(screen.getByText('Setup Complete!')).toBeInTheDocument()
    
    // Click finish
    fireEvent.click(screen.getByText('Finish Setup'))
    expect(mockOnComplete).toHaveBeenCalled()
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('API Error'))
    
    render(<GmailSetupWizard onComplete={mockOnComplete} />)
    
    // Navigate to step 2 where alias creation happens
    fireEvent.click(screen.getByText('Continue'))
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to create alias/)).toBeInTheDocument()
    })
  })
})