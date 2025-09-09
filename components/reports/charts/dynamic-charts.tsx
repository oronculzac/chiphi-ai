'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dynamic imports for Recharts components to reduce bundle size
 * 
 * Requirements covered:
 * - 8.1: Prioritize above-the-fold content and lazy load secondary elements
 * - 8.4: Load chart libraries dynamically to improve initial page load
 */

// Chart loading skeleton component
export function ChartSkeleton({ className = "w-full h-64" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

// Donut chart loading skeleton
export function DonutChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center h-64 mb-4">
        <Skeleton className="w-44 h-44 rounded-full" />
      </div>
      {/* Legend skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Dynamic imports with loading states
export const DynamicPieChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.PieChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Charts don&apos;t need SSR
  }
);

export const DynamicPie = dynamic(
  () => import('recharts').then(mod => ({ default: mod.Pie })),
  {
    ssr: false,
  }
);

export const DynamicCell = dynamic(
  () => import('recharts').then(mod => ({ default: mod.Cell })),
  {
    ssr: false,
  }
);

export const DynamicLineChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.LineChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicLine = dynamic(
  () => import('recharts').then(mod => ({ default: mod.Line })),
  {
    ssr: false,
  }
);

export const DynamicAreaChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.AreaChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const DynamicArea = dynamic(
  () => import('recharts').then(mod => ({ default: mod.Area })),
  {
    ssr: false,
  }
);

export const DynamicXAxis = dynamic(
  () => import('recharts').then(mod => ({ default: mod.XAxis })),
  {
    ssr: false,
  }
);

export const DynamicYAxis = dynamic(
  () => import('recharts').then(mod => ({ default: mod.YAxis })),
  {
    ssr: false,
  }
);

export const DynamicCartesianGrid = dynamic(
  () => import('recharts').then(mod => ({ default: mod.CartesianGrid })),
  {
    ssr: false,
  }
);

export const DynamicTooltip = dynamic(
  () => import('recharts').then(mod => ({ default: mod.Tooltip })),
  {
    ssr: false,
  }
);

export const DynamicLegend = dynamic(
  () => import('recharts').then(mod => ({ default: mod.Legend })),
  {
    ssr: false,
  }
);

export const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// Preload charts when user hovers over reports navigation
export function preloadCharts() {
  // Preload the chart components
  import('recharts');
}

// Hook to preload charts on hover
export function useChartPreloader() {
  const handleMouseEnter = () => {
    preloadCharts();
  };

  return { handleMouseEnter };
}