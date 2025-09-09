'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Performance monitoring hook for reports components
 * 
 * Requirements covered:
 * - 8.1: Monitor performance and optimize bottlenecks
 * - 8.4: Track component render times and chart performance
 */

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

interface UsePerformanceMonitorOptions {
  componentName: string;
  enabled?: boolean;
  threshold?: number; // Log warning if render time exceeds this (ms)
}

export function usePerformanceMonitor({
  componentName,
  enabled = process.env.NODE_ENV === 'development',
  threshold = 100 // 100ms threshold
}: UsePerformanceMonitorOptions) {
  const startTimeRef = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  // Start performance measurement
  const startMeasurement = useCallback(() => {
    if (!enabled) return;
    startTimeRef.current = performance.now();
  }, [enabled]);

  // End performance measurement and log results
  const endMeasurement = useCallback(() => {
    if (!enabled || startTimeRef.current === 0) return;
    
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;
    
    const metrics: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now()
    };
    
    // Store metrics
    metricsRef.current.push(metrics);
    
    // Keep only last 10 measurements
    if (metricsRef.current.length > 10) {
      metricsRef.current = metricsRef.current.slice(-10);
    }
    
    // Log performance data
    if (renderTime > threshold) {
      console.warn(`⚠️ Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    } else {
      console.log(`✅ ${componentName} rendered in ${renderTime.toFixed(2)}ms`);
    }
    
    // Reset start time
    startTimeRef.current = 0;
  }, [enabled, componentName, threshold]);

  // Get performance statistics
  const getStats = useCallback(() => {
    if (metricsRef.current.length === 0) return null;
    
    const renderTimes = metricsRef.current.map(m => m.renderTime);
    const avg = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
    const min = Math.min(...renderTimes);
    const max = Math.max(...renderTimes);
    
    return {
      componentName,
      measurements: metricsRef.current.length,
      averageRenderTime: avg,
      minRenderTime: min,
      maxRenderTime: max,
      lastRenderTime: renderTimes[renderTimes.length - 1]
    };
  }, [componentName]);

  // Measure component mount/unmount
  useEffect(() => {
    startMeasurement();
    
    return () => {
      endMeasurement();
    };
  }, [startMeasurement, endMeasurement]);

  return {
    startMeasurement,
    endMeasurement,
    getStats
  };
}

// Hook for measuring specific operations (like chart rendering)
export function useOperationTimer(operationName: string, enabled = process.env.NODE_ENV === 'development') {
  const measureOperation = useCallback(async <T>(operation: () => Promise<T> | T): Promise<T> => {
    if (!enabled) {
      return await operation();
    }
    
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`📊 ${operationName} completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`❌ ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, [operationName, enabled]);

  return { measureOperation };
}

// Global performance metrics collector
class PerformanceCollector {
  private static instance: PerformanceCollector;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();

  static getInstance(): PerformanceCollector {
    if (!PerformanceCollector.instance) {
      PerformanceCollector.instance = new PerformanceCollector();
    }
    return PerformanceCollector.instance;
  }

  addMetric(metric: PerformanceMetrics) {
    const existing = this.metrics.get(metric.componentName) || [];
    existing.push(metric);
    
    // Keep only last 50 measurements per component
    if (existing.length > 50) {
      existing.splice(0, existing.length - 50);
    }
    
    this.metrics.set(metric.componentName, existing);
  }

  getMetrics(componentName?: string) {
    if (componentName) {
      return this.metrics.get(componentName) || [];
    }
    return Object.fromEntries(this.metrics.entries());
  }

  getAverageRenderTime(componentName: string): number {
    const metrics = this.metrics.get(componentName) || [];
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + metric.renderTime, 0);
    return total / metrics.length;
  }

  getSlowestComponents(limit = 5): Array<{ name: string; avgTime: number }> {
    const componentAvgs = Array.from(this.metrics.entries()).map(([name, metrics]) => ({
      name,
      avgTime: metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length
    }));
    
    return componentAvgs
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  clear() {
    this.metrics.clear();
  }
}

export const performanceCollector = PerformanceCollector.getInstance();

// Hook to access global performance data
export function useGlobalPerformanceMetrics() {
  const getComponentMetrics = useCallback((componentName: string) => {
    return performanceCollector.getMetrics(componentName);
  }, []);

  const getAllMetrics = useCallback(() => {
    return performanceCollector.getMetrics();
  }, []);

  const getSlowestComponents = useCallback((limit?: number) => {
    return performanceCollector.getSlowestComponents(limit);
  }, []);

  const getAverageRenderTime = useCallback((componentName: string) => {
    return performanceCollector.getAverageRenderTime(componentName);
  }, []);

  return {
    getComponentMetrics,
    getAllMetrics,
    getSlowestComponents,
    getAverageRenderTime
  };
}