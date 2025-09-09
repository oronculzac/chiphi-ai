import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { 
  TabSkeleton,
  OrganizationTabSkeleton,
  InboundEmailTabSkeleton,
  NotificationsTabSkeleton,
  DataTabSkeleton,
  IntegrationsTabSkeleton
} from '@/components/ui/tab-skeleton';

describe('TabSkeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<TabSkeleton />);
    
    // Should render header by default
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders specified number of sections', () => {
    render(<TabSkeleton sections={2} />);
    
    // Should render 2 card sections
    const cards = screen.getAllByRole('generic').filter(el => 
      el.className?.includes('border')
    );
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('hides header when showHeader is false', () => {
    const { container } = render(<TabSkeleton showHeader={false} />);
    
    // Header skeletons should not be present at the top level
    const headerSkeletons = container.querySelectorAll('.mb-6 .space-y-2');
    expect(headerSkeletons.length).toBe(0);
  });

  it('applies custom className', () => {
    const { container } = render(<TabSkeleton className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders different sections with varying content', () => {
    const { container } = render(<TabSkeleton sections={1} />);
    
    // Should have form-like skeleton elements
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5); // Multiple skeleton elements per section
  });
});

describe('OrganizationTabSkeleton', () => {
  it('renders organization-specific skeleton layout', () => {
    const { container } = render(<OrganizationTabSkeleton />);
    
    // Should render multiple card sections for org info, logo, and members
    const cards = container.querySelectorAll('[class*="border"]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('does not show header', () => {
    const { container } = render(<OrganizationTabSkeleton />);
    
    // Should not have header section
    const headerSection = container.querySelector('.mb-6');
    expect(headerSection).toBeNull();
  });
});

describe('InboundEmailTabSkeleton', () => {
  it('renders email-specific skeleton layout', () => {
    const { container } = render(<InboundEmailTabSkeleton />);
    
    // Should render cards for alias, gmail setup, and verification
    const cards = container.querySelectorAll('[class*="border"]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('includes copy button skeleton', () => {
    const { container } = render(<InboundEmailTabSkeleton />);
    
    // Should have skeleton elements arranged in flex layout (alias + copy button)
    const flexElements = container.querySelectorAll('.flex');
    expect(flexElements.length).toBeGreaterThan(0);
  });
});

describe('NotificationsTabSkeleton', () => {
  it('renders notifications-specific skeleton layout', () => {
    const { container } = render(<NotificationsTabSkeleton />);
    
    // Should render cards for notification preferences and email settings
    const cards = container.querySelectorAll('[class*="border"]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('includes toggle switch skeletons', () => {
    const { container } = render(<NotificationsTabSkeleton />);
    
    // Should have skeleton elements for toggle switches
    const toggleSkeletons = container.querySelectorAll('.rounded-full');
    expect(toggleSkeletons.length).toBeGreaterThan(0);
  });

  it('includes justify-between layouts for toggle rows', () => {
    const { container } = render(<NotificationsTabSkeleton />);
    
    // Should have flex justify-between layouts for toggle rows
    const justifyBetweenElements = container.querySelectorAll('.justify-between');
    expect(justifyBetweenElements.length).toBeGreaterThan(0);
  });
});

describe('DataTabSkeleton', () => {
  it('renders data-specific skeleton layout', () => {
    const { container } = render(<DataTabSkeleton />);
    
    // Should render cards for export and danger zone
    const cards = container.querySelectorAll('[class*="border"]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('includes grid layout for export options', () => {
    const { container } = render(<DataTabSkeleton />);
    
    // Should have grid layout for export options
    const gridElements = container.querySelectorAll('.grid');
    expect(gridElements.length).toBeGreaterThan(0);
  });

  it('includes danger zone styling', () => {
    const { container } = render(<DataTabSkeleton />);
    
    // Should have destructive border styling for danger zone
    const dangerElements = container.querySelectorAll('[class*="destructive"]');
    expect(dangerElements.length).toBeGreaterThan(0);
  });
});

describe('IntegrationsTabSkeleton', () => {
  it('renders integrations-specific skeleton layout', () => {
    const { container } = render(<IntegrationsTabSkeleton />);
    
    // Should render card for integrations
    const cards = container.querySelectorAll('[class*="border"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('includes integration item layouts', () => {
    const { container } = render(<IntegrationsTabSkeleton />);
    
    // Should have multiple integration items with icon, text, and toggle
    const integrationItems = container.querySelectorAll('.flex.items-center.justify-between');
    expect(integrationItems.length).toBeGreaterThanOrEqual(3);
  });

  it('includes icon skeletons for integrations', () => {
    const { container } = render(<IntegrationsTabSkeleton />);
    
    // Should have square icon skeletons
    const iconSkeletons = container.querySelectorAll('.h-8.w-8');
    expect(iconSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('includes toggle switch skeletons', () => {
    const { container } = render(<IntegrationsTabSkeleton />);
    
    // Should have rounded toggle switch skeletons
    const toggleSkeletons = container.querySelectorAll('.rounded-full');
    expect(toggleSkeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Skeleton Accessibility', () => {
  it('provides appropriate loading indication', () => {
    const { container } = render(<TabSkeleton />);
    
    // Skeleton components should be perceivable as loading states
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    skeletons.forEach(skeleton => {
      expect(skeleton).toBeInTheDocument();
    });
  });

  it('maintains layout structure during loading', () => {
    const { container: loadingContainer } = render(<TabSkeleton sections={2} />);
    
    // Should maintain consistent layout structure
    const loadingCards = loadingContainer.querySelectorAll('[class*="border"]');
    expect(loadingCards.length).toBeGreaterThanOrEqual(2);
  });
});