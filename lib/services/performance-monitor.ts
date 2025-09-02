/**
 * Performance Monitoring Service
 * Tracks AI service response times, database query performance,
 * and system metrics for optimization insights
 */

import { createClient } from '@/lib/supabase/server';

export interface PerformanceMetric {
  id?: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  org_id?: string;
  endpoint?: string;
  user_agent?: string;
  created_at?: string;
}

export interface AIServiceMetrics {
  service: 'openai' | 'translation' | 'extraction';
  operation: string;
  responseTime: number;
  tokenUsage?: number;
  cost?: number;
  success: boolean;
  error?: string;
}

export interface DatabaseMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  success: boolean;
  error?: string;
}

export interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  cacheHitRate: number;
}

export class PerformanceMonitor {
  private supabase;
  private metrics: PerformanceMetric[] = [];
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.supabase = createClient();
    
    // Flush metrics periodically
    setInterval(() => this.flushMetrics(), this.flushInterval);
    
    // Flush on process exit
    process.on('beforeExit', () => this.flushMetrics());
  }

  /**
   * Record AI service performance metrics
   */
  recordAIMetrics(metrics: AIServiceMetrics, orgId?: string): void {
    const baseMetricName = `ai_${metrics.service}_${metrics.operation}`;
    
    this.addMetric({
      metric_name: `${baseMetricName}_response_time`,
      metric_value: metrics.responseTime,
      metric_unit: 'ms',
      org_id: orgId
    });

    if (metrics.tokenUsage) {
      this.addMetric({
        metric_name: `${baseMetricName}_token_usage`,
        metric_value: metrics.tokenUsage,
        metric_unit: 'tokens',
        org_id: orgId
      });
    }

    if (metrics.cost) {
      this.addMetric({
        metric_name: `${baseMetricName}_cost`,
        metric_value: metrics.cost,
        metric_unit: 'usd',
        org_id: orgId
      });
    }

    this.addMetric({
      metric_name: `${baseMetricName}_success_rate`,
      metric_value: metrics.success ? 1 : 0,
      metric_unit: 'boolean',
      org_id: orgId
    });

    if (!metrics.success && metrics.error) {
      this.addMetric({
        metric_name: `${baseMetricName}_error`,
        metric_value: 1,
        metric_unit: 'count',
        org_id: orgId
      });
    }
  }

  /**
   * Record database performance metrics
   */
  recordDatabaseMetrics(metrics: DatabaseMetrics, orgId?: string): void {
    const queryType = this.extractQueryType(metrics.query);
    
    this.addMetric({
      metric_name: `db_${queryType}_execution_time`,
      metric_value: metrics.executionTime,
      metric_unit: 'ms',
      org_id: orgId
    });

    this.addMetric({
      metric_name: `db_${queryType}_rows_affected`,
      metric_value: metrics.rowsAffected,
      metric_unit: 'count',
      org_id: orgId
    });

    this.addMetric({
      metric_name: `db_${queryType}_success_rate`,
      metric_value: metrics.success ? 1 : 0,
      metric_unit: 'boolean',
      org_id: orgId
    });
  }

  /**
   * Record system performance metrics
   */
  recordSystemMetrics(metrics: SystemMetrics): void {
    this.addMetric({
      metric_name: 'system_memory_usage',
      metric_value: metrics.memoryUsage,
      metric_unit: 'mb'
    });

    this.addMetric({
      metric_name: 'system_cpu_usage',
      metric_value: metrics.cpuUsage,
      metric_unit: 'percent'
    });

    this.addMetric({
      metric_name: 'system_active_connections',
      metric_value: metrics.activeConnections,
      metric_unit: 'count'
    });

    this.addMetric({
      metric_name: 'system_cache_hit_rate',
      metric_value: metrics.cacheHitRate,
      metric_unit: 'percent'
    });
  }

  /**
   * Record API endpoint performance
   */
  recordEndpointMetrics(
    endpoint: string,
    responseTime: number,
    statusCode: number,
    userAgent?: string,
    orgId?: string
  ): void {
    const endpointName = this.normalizeEndpoint(endpoint);
    
    this.addMetric({
      metric_name: `api_${endpointName}_response_time`,
      metric_value: responseTime,
      metric_unit: 'ms',
      endpoint,
      user_agent: userAgent,
      org_id: orgId
    });

    this.addMetric({
      metric_name: `api_${endpointName}_status_${statusCode}`,
      metric_value: 1,
      metric_unit: 'count',
      endpoint,
      user_agent: userAgent,
      org_id: orgId
    });
  }

  /**
   * Get performance statistics for a time period
   */
  async getPerformanceStats(
    metricName: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<{
    avg: number;
    min: number;
    max: number;
    count: number;
    p95: number;
    p99: number;
  }> {
    try {
      let query = this.supabase
        .from('performance_metrics')
        .select('metric_value')
        .eq('metric_name', metricName)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return { avg: 0, min: 0, max: 0, count: 0, p95: 0, p99: 0 };
      }

      const values = data.map(d => d.metric_value).sort((a, b) => a - b);
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      
      const p95Index = Math.floor(count * 0.95);
      const p99Index = Math.floor(count * 0.99);

      return {
        avg: sum / count,
        min: values[0],
        max: values[count - 1],
        count,
        p95: values[p95Index] || 0,
        p99: values[p99Index] || 0
      };
    } catch (error) {
      console.error('Error fetching performance stats:', error);
      throw error;
    }
  }

  /**
   * Get top slow queries or operations
   */
  async getSlowOperations(
    limit = 10,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<Array<{
    metric_name: string;
    avg_value: number;
    max_value: number;
    count: number;
  }>> {
    try {
      let query = this.supabase
        .rpc('get_slow_operations', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          result_limit: limit,
          org_filter: orgId
        });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching slow operations:', error);
      return [];
    }
  }

  /**
   * Get AI service cost breakdown
   */
  async getAICostBreakdown(
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<Array<{
    service: string;
    operation: string;
    total_cost: number;
    total_tokens: number;
    request_count: number;
  }>> {
    try {
      let query = this.supabase
        .rpc('get_ai_cost_breakdown', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          org_filter: orgId
        });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching AI cost breakdown:', error);
      return [];
    }
  }

  /**
   * Add metric to batch for later flushing
   */
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push({
      ...metric,
      created_at: new Date().toISOString()
    });

    // Flush if batch is full
    if (this.metrics.length >= this.batchSize) {
      this.flushMetrics();
    }
  }

  /**
   * Flush accumulated metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) return;

    try {
      const metricsToFlush = [...this.metrics];
      this.metrics = [];

      const { error } = await this.supabase
        .from('performance_metrics')
        .insert(metricsToFlush);

      if (error) {
        console.error('Error flushing performance metrics:', error);
        // Re-add metrics to queue for retry
        this.metrics.unshift(...metricsToFlush);
      }
    } catch (error) {
      console.error('Error flushing performance metrics:', error);
    }
  }

  /**
   * Extract query type from SQL query
   */
  private extractQueryType(query: string): string {
    const normalized = query.toLowerCase().trim();
    
    if (normalized.startsWith('select')) return 'select';
    if (normalized.startsWith('insert')) return 'insert';
    if (normalized.startsWith('update')) return 'update';
    if (normalized.startsWith('delete')) return 'delete';
    if (normalized.startsWith('upsert')) return 'upsert';
    
    return 'other';
  }

  /**
   * Normalize endpoint name for metrics
   */
  private normalizeEndpoint(endpoint: string): string {
    return endpoint
      .replace(/^\/api\//, '')
      .replace(/\/\d+/g, '/:id')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase();
  }
}

// Utility functions for measuring performance
export function measureAsync<T>(
  fn: () => Promise<T>,
  onComplete: (duration: number, result: T, error?: Error) => void
): Promise<T> {
  const start = Date.now();
  
  return fn()
    .then(result => {
      const duration = Date.now() - start;
      onComplete(duration, result);
      return result;
    })
    .catch(error => {
      const duration = Date.now() - start;
      onComplete(duration, null as any, error);
      throw error;
    });
}

export function measureSync<T>(
  fn: () => T,
  onComplete: (duration: number, result: T, error?: Error) => void
): T {
  const start = Date.now();
  
  try {
    const result = fn();
    const duration = Date.now() - start;
    onComplete(duration, result);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    onComplete(duration, null as any, error as Error);
    throw error;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();