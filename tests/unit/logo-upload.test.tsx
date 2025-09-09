import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LogoUpload from '@/components/settings/logo-upload';
import { useToast } from '@/hooks/use-toast';

// Mock the useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(window.URL, 'createObjectURL', {
  value: mockCreateObjectURL,
});
Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LogoUpload', () => {
  const mockToast = vi.fn();
  const mockOnLogoUpdate = vi.fn();

  beforeEach(() => {
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
    mockFetch.mockClear();
    mockToast.mockClear();
    mockOnLogoUpdate.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload button when no logo is present', () => {
    render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    expect(screen.getByText('Upload Logo')).toBeInTheDocument();
    expect(screen.getByText('Organization Logo')).toBeInTheDocument();
    expect(screen.getByText('Upload a logo for your organization.')).toBeInTheDocument();
  });

  it('renders change and remove buttons when logo is present', () => {
    render(
      <LogoUpload
        currentLogoUrl="https://example.com/logo.png"
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    expect(screen.getByText('Change Logo')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
    expect(screen.getByAltText('Organization logo')).toBeInTheDocument();
  });

  it('displays current logo image when provided', () => {
    const logoUrl = 'https://example.com/logo.png';
    render(
      <LogoUpload
        currentLogoUrl={logoUrl}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const logoImage = screen.getByAltText('Organization logo');
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute('src', logoUrl);
  });

  it('validates file type and shows error for invalid types', async () => {
    render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const fileInput = screen.getByRole('button', { name: /upload logo/i });
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a mock file with invalid type
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(hiddenInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid File',
        description: 'Please select a valid image file (JPEG, PNG, or WebP)',
        variant: 'destructive',
      });
    });
  });

  it('validates file size and shows error for large files', async () => {
    render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a mock file that's too large (6MB)
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    fireEvent.change(hiddenInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid File',
        description: 'File size must be less than 5MB',
        variant: 'destructive',
      });
    });
  });

  it('uploads valid file successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { logo_url: 'https://example.com/new-logo.png' }
      }),
    });

    render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a valid file
    const validFile = new File(['content'], 'logo.jpg', { type: 'image/jpeg' });

    fireEvent.change(hiddenInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(validFile);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/organization/logo', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });

    await waitFor(() => {
      expect(mockOnLogoUpdate).toHaveBeenCalledWith('https://example.com/new-logo.png');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Logo uploaded successfully',
      });
    });
  });

  it('handles upload failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Upload failed'
      }),
    });

    render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['content'], 'logo.jpg', { type: 'image/jpeg' });

    fireEvent.change(hiddenInput, { target: { files: [validFile] } });

    // Wait for the upload to complete and show error
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Upload Failed',
        description: 'Upload failed',
        variant: 'destructive',
      });
    });

    // Verify that createObjectURL was called (preview was created)
    expect(mockCreateObjectURL).toHaveBeenCalledWith(validFile);
    
    // The onLogoUpdate should not be called on failure
    expect(mockOnLogoUpdate).not.toHaveBeenCalled();
  });

  it('removes logo successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { logo_url: null }
      }),
    });

    render(
      <LogoUpload
        currentLogoUrl="https://example.com/logo.png"
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/organization/logo', {
        method: 'DELETE',
      });
    });

    await waitFor(() => {
      expect(mockOnLogoUpdate).toHaveBeenCalledWith(null);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Logo removed successfully',
      });
    });
  });

  it('handles remove failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Remove failed'
      }),
    });

    render(
      <LogoUpload
        currentLogoUrl="https://example.com/logo.png"
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Remove Failed',
        description: 'Remove failed',
        variant: 'destructive',
      });
    });
  });

  it('disables buttons when disabled prop is true', () => {
    render(
      <LogoUpload
        currentLogoUrl="https://example.com/logo.png"
        onLogoUpdate={mockOnLogoUpdate}
        disabled={true}
      />
    );

    expect(screen.getByText('Change Logo')).toBeDisabled();
    expect(screen.getByText('Remove')).toBeDisabled();
  });

  it('shows loading states during upload and remove operations', async () => {
    // Mock a slow upload
    mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['content'], 'logo.jpg', { type: 'image/jpeg' });

    fireEvent.change(hiddenInput, { target: { files: [validFile] } });

    // Should show uploading state
    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  it('cleans up preview URL on unmount', () => {
    const { unmount } = render(
      <LogoUpload
        currentLogoUrl={null}
        onLogoUpdate={mockOnLogoUpdate}
      />
    );

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['content'], 'logo.jpg', { type: 'image/jpeg' });

    fireEvent.change(hiddenInput, { target: { files: [validFile] } });

    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });
});