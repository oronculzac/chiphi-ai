/**
 * Performance optimization configuration for reports
 * 
 * Requirements covered:
 * - 8.1: Implement performance optimizations and caching
 * - 8.2: Configure SWR caching policies with appropriate stale-while-revalidate settings
 * - 8.3: Add request deduplication for simultaneous filter changes
 * - 8.4: Implement lazy loading for secondary page elements
 * - 8.5: Load chart libraries dynamically to improve initial page load
 */

// SWR Configuration for Reports Data
export const REPORTS_SWR_CONFIG = {
  // Caching optimizations
  revalidateOnFocus: false, // Don't revalidate on window focus to reduce API calls
  revalidateOnReconnect: false, // Disable reconnect revalidation to reduce requests
  dedupingInterval: 60000, // 60 seconds deduplication for better caching (increased from 30s)

  // Stale-while-revalidate settings
  revalidateIfStale: false, // Don't revalidate stale data automatically
  refreshInterval: 0, // Disable automatic background refresh to prevent repeated requests
  focusThrottleInterval: 30000, // 30 seconds throttle for focus revalidation (increased from 10s)

  // Performance optimizations
  keepPreviousData: true, // Keep previous data while loading new data

  // Error handling
  errorRetryCount: 3,
  errorRetryInterval: (retryCount: number) => {
    // Exponential backoff: 1s, 2s, 4s, max 10s
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  },

  // Request deduplication
  compare: (a: any, b: any) => {
    // Custom comparison to prevent unnecessary re-renders
    return JSON.stringify(a) === JSON.stringify(b);
  }
} as const;

// Debounce Configuration
export const DEBOUNCE_CONFIG = {
  SEARCH_INPUT: 300, // 300ms for search input
  FILTER_CHANGES: 150, // 150ms for filter changes
  RESIZE_EVENTS: 100, // 100ms for resize events
} as const;

// Performance Thresholds
export const PERFORMANCE_THRESHOLDS = {
  WIDGET_RENDER: 100, // 100ms for widget rendering
  CHART_RENDER: 200, // 200ms for chart rendering
  DATA_TRANSFORM: 50, // 50ms for data transformation
  API_RESPONSE: 2000, // 2 seconds for API responses
} as const;

// Chart Configuration
export const CHART_CONFIG = {
  // Dynamic import settings
  ENABLE_SSR: false, // Disable SSR for charts
  LOADING_TIMEOUT: 5000, // 5 seconds timeout for chart loading

  // Rendering optimizations
  ANIMATION_DURATION: 300, // 300ms for chart animations
  RESPONSIVE_DEBOUNCE: 100, // 100ms debounce for responsive updates

  // Data limits
  MAX_CATEGORY_ITEMS: 8, // Maximum categories before grouping into "Other"
  MAX_TREND_POINTS: 90, // Maximum trend points to display

  // Color palette (colorblind-friendly)
  COLORS: [
    '#2563eb', // blue
    '#dc2626', // red
    '#16a34a', // green
    '#ca8a04', // yellow
    '#9333ea', // purple
    '#c2410c', // orange
    '#0891b2', // cyan
    '#be123c', // rose
  ]
} as const;

// Memory Management
export const MEMORY_CONFIG = {
  // Cache limits
  MAX_CACHED_REQUESTS: 50, // Maximum number of cached SWR requests
  MAX_PERFORMANCE_METRICS: 100, // Maximum performance metrics to store

  // Cleanup intervals
  CACHE_CLEANUP_INTERVAL: 300000, // 5 minutes
  METRICS_CLEANUP_INTERVAL: 600000, // 10 minutes

  // Memory thresholds
  MEMORY_WARNING_THRESHOLD: 50 * 1024 * 1024, // 50MB
  MEMORY_CRITICAL_THRESHOLD: 100 * 1024 * 1024, // 100MB
} as const;

// Bundle Optimization
export const BUNDLE_CONFIG = {
  // Dynamic imports
  ENABLE_CHART_SPLITTING: true, // Enable dynamic chart imports
  ENABLE_COMPONENT_SPLITTING: true, // Enable component code splitting

  // Preloading
  ENABLE_HOVER_PRELOAD: true, // Preload on hover
  PRELOAD_DELAY: 100, // 100ms delay before preloading

  // Lazy loading
  ENABLE_LAZY_LOADING: true, // Enable lazy loading for secondary elements
  INTERSECTION_THRESHOLD: 0.1, // 10% visibility threshold for lazy loading
} as const;

// Development vs Production Settings
export const getEnvironmentConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    // Logging
    ENABLE_PERFORMANCE_LOGGING: isDevelopment,
    ENABLE_DEBUG_LOGGING: isDevelopment,
    ENABLE_VERBOSE_LOGGING: false, // Only enable for debugging

    // Monitoring
    ENABLE_PERFORMANCE_MONITORING: true,
    ENABLE_ERROR_TRACKING: true,
    ENABLE_METRICS_COLLECTION: !isDevelopment, // Only in production

    // Optimizations
    ENABLE_MEMOIZATION: true,
    ENABLE_VIRTUALIZATION: false, // Not needed for current data sizes
    ENABLE_COMPRESSION: !isDevelopment, // Only in production
  };
};

// Utility functions for performance optimization
export const performanceUtils = {
  // Check if performance API is available
  isPerformanceAPIAvailable: () => {
    return typeof window !== 'undefined' && 'performance' in window;
  },

  // Get memory usage (if available)
  getMemoryUsage: () => {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      return (window.performance as any).memory;
    }
    return null;
  },

  // Check if memory usage is high
  isMemoryUsageHigh: () => {
    const memory = performanceUtils.getMemoryUsage();
    if (!memory) return false;

    return memory.usedJSHeapSize > MEMORY_CONFIG.MEMORY_WARNING_THRESHOLD;
  },

  // Force garbage collection (development only)
  forceGarbageCollection: () => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  },

  // Measure operation performance
  measureOperation: async <T>(name: string, operation: () => Promise<T> | T): Promise<T> => {
    if (!performanceUtils.isPerformanceAPIAvailable()) {
      return await operation();
    }

    const startTime = performance.now();

    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (getEnvironmentConfig().ENABLE_PERFORMANCE_LOGGING) {
        console.log(`📊 ${name} completed in ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.error(`❌ ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
};

export default {
  SWR: REPORTS_SWR_CONFIG,
  DEBOUNCE: DEBOUNCE_CONFIG,
  PERFORMANCE: PERFORMANCE_THRESHOLDS,
  CHART: CHART_CONFIG,
  MEMORY: MEMORY_CONFIG,
  BUNDLE: BUNDLE_CONFIG,
  getEnvironmentConfig,
  utils: performanceUtils
};