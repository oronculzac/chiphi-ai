import { createAdminClient } from '@/lib/supabase/admin';
import { loggingService } from './logging-service';

/**
 * Provider Performance Service for Email Processing
 * 
 * This service tracks provider performance metrics including latency,
 * success rates, and error tracking for monitoring and optimization.
 * 
 * Requirements covered:
 * - 1.5: Add provider performance logging with latency, success rate, and error tracking
 */

export interface ProviderMetrics {
  orgId: string;
  provider: 'ses' | 'cloudflare';
  operation: 'verify' | 'parse' | 'process' | 'health_check';
  latencyMs: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface ProviderPerformanceStats {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorBreakdown: Array<{
    errorType: string;
    count: number;
    percentage: number;
  }>;
  timeRange: {
    start: string;
    end: string;
    hoursBack: number;
  };
}

export class ProviderPerformanceService {
  private supabase;

  constructor() {
    this.supabase = createAdminClient();
  }

  /**
   * Log provider performance metrics
   */
  async logProviderMetrics(metrics: ProviderMetrics): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('provider_performance_logs')
        .insert({
          org_id: metrics.orgId,
          provider: metrics.provider,
          operation: metrics.operation,
          latency_ms: metrics.latencyMs,
          success: metrics.success,
          error_type: metrics.errorType,
          error_message: metrics.errorMessage,
          correlation_id: metrics.correlationId,
          metadata: metrics.metadata,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to log provider metrics:', error);
        // Don't throw error as this is not critical for processing
      }

      // Also log to processing logs for correlation
      await loggingService.logProcessingStep({
        orgId: metrics.orgId,
        emailId: '',
        step: `provider_${metrics.operation}`,
        status: metrics.success ? 'completed' : 'failed',
        details: {
          provider: metrics.provider,
          operation: metrics.operation,
          latencyMs: metrics.latencyMs,
          errorType: metrics.errorType,
          correlationId: metrics.correlationId,
          ...metrics.metadata,
        },
        errorMessage: metrics.errorMessage,
        processingTimeMs: metrics.latencyMs,
        correlationId: metrics.correlationId,
      });

    } catch (error) {
      console.error('Error logging provider metrics:', error);
      // Don't throw error as this is not critical for processing
    }
  }

  /**
   * Get provider performance statistics
   */
  async getProviderPerformanceStats(
    provider?: string,
    orgId?: string,
    hoursBack = 24
  ): Promise<ProviderPerformanceStats[]> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      const endTime = new Date();

      let query = this.supabase
        .from('provider_performance_logs')
        .select('*')
        .gte('created_at', cutoffTime.toISOString())
        .lte('created_at', endTime.toISOString());

      if (provider) {
        query = query.eq('provider', provider);
      }

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data: logs, error } = await query;

      if (error) {
        throw new Error(`Failed to get provider performance logs: ${error.message}`);
      }

      // Group by provider
      const providerGroups = new Map<string, any[]>();
      logs?.forEach(log => {
        const providerName = log.provider;
        if (!providerGroups.has(providerName)) {
          providerGroups.set(providerName, []);
        }
        providerGroups.get(providerName)!.push(log);
      });

      // Calculate statistics for each provider
      const stats: ProviderPerformanceStats[] = [];

      for (const [providerName, providerLogs] of providerGroups.entries()) {
        const totalRequests = providerLogs.length;
        const successfulRequests = providerLogs.filter(log => log.success).length;
        const failedRequests = totalRequests - successfulRequests;
        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

        // Calculate latency statistics
        const latencies = providerLogs.map(log => log.latency_ms).sort((a, b) => a - b);
        const averageLatencyMs = latencies.length > 0 
          ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length 
          : 0;

        const p95Index = Math.floor(latencies.length * 0.95);
        const p99Index = Math.floor(latencies.length * 0.99);
        const p95LatencyMs = latencies.length > 0 ? latencies[p95Index] || 0 : 0;
        const p99LatencyMs = latencies.length > 0 ? latencies[p99Index] || 0 : 0;

        // Calculate error breakdown
        const errorCounts = new Map<string, number>();
        providerLogs
          .filter(log => !log.success && log.error_type)
          .forEach(log => {
            const errorType = log.error_type;
            errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
          });

        const errorBreakdown = Array.from(errorCounts.entries()).map(([errorType, count]) => ({
          errorType,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
        }));

        stats.push({
          provider: providerName,
          totalRequests,
          successfulRequests,
          failedRequests,
          successRate,
          averageLatencyMs,
          p95LatencyMs,
          p99LatencyMs,
          errorBreakdown,
          timeRange: {
            start: cutoffTime.toISOString(),
            end: endTime.toISOString(),
            hoursBack,
          },
        });
      }

      return stats;

    } catch (error) {
      console.error('Error getting provider performance statistics:', error);
      return [];
    }
  }

  /**
   * Get provider health summary
   */
  async getProviderHealthSummary(
    hoursBack = 1
  ): Promise<Array<{
    provider: string;
    healthy: boolean;
    successRate: number;
    averageLatencyMs: number;
    lastSuccessfulRequest?: string;
    lastError?: {
      type: string;
      message: string;
      timestamp: string;
    };
  }>> {
    try {
      const stats = await this.getProviderPerformanceStats(undefined, undefined, hoursBack);
      
      const healthSummary = await Promise.all(
        stats.map(async (stat) => {
          // Get last successful request
          const { data: lastSuccess } = await this.supabase
            .from('provider_performance_logs')
            .select('created_at')
            .eq('provider', stat.provider)
            .eq('success', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get last error
          const { data: lastError } = await this.supabase
            .from('provider_performance_logs')
            .select('error_type, error_message, created_at')
            .eq('provider', stat.provider)
            .eq('success', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Consider healthy if success rate > 95% and average latency < 5000ms
          const healthy = stat.successRate > 95 && stat.averageLatencyMs < 5000;

          return {
            provider: stat.provider,
            healthy,
            successRate: stat.successRate,
            averageLatencyMs: stat.averageLatencyMs,
            lastSuccessfulRequest: lastSuccess?.created_at,
            lastError: lastError ? {
              type: lastError.error_type,
              message: lastError.error_message,
              timestamp: lastError.created_at,
            } : undefined,
          };
        })
      );

      return healthSummary;

    } catch (error) {
      console.error('Error getting provider health summary:', error);
      return [];
    }
  }

  /**
   * Clean up old performance logs to prevent database bloat
   */
  async cleanupOldPerformanceLogs(retentionDays = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from('provider_performance_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup old performance logs: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      console.log('Old provider performance logs cleaned up', { deletedCount, retentionDays });

      return deletedCount;

    } catch (error) {
      console.error('Provider performance logs cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get provider performance alerts
   */
  async getProviderPerformanceAlerts(
    thresholds: {
      successRateThreshold?: number;
      latencyThresholdMs?: number;
      errorRateThreshold?: number;
    } = {}
  ): Promise<Array<{
    provider: string;
    alertType: 'low_success_rate' | 'high_latency' | 'high_error_rate';
    severity: 'warning' | 'critical';
    message: string;
    currentValue: number;
    threshold: number;
    timestamp: string;
  }>> {
    try {
      const {
        successRateThreshold = 95,
        latencyThresholdMs = 5000,
        errorRateThreshold = 5,
      } = thresholds;

      const stats = await this.getProviderPerformanceStats(undefined, undefined, 1);
      const alerts: any[] = [];

      for (const stat of stats) {
        const timestamp = new Date().toISOString();

        // Check success rate
        if (stat.successRate < successRateThreshold) {
          alerts.push({
            provider: stat.provider,
            alertType: 'low_success_rate',
            severity: stat.successRate < 90 ? 'critical' : 'warning',
            message: `Provider ${stat.provider} success rate (${stat.successRate.toFixed(1)}%) is below threshold (${successRateThreshold}%)`,
            currentValue: stat.successRate,
            threshold: successRateThreshold,
            timestamp,
          });
        }

        // Check latency
        if (stat.averageLatencyMs > latencyThresholdMs) {
          alerts.push({
            provider: stat.provider,
            alertType: 'high_latency',
            severity: stat.averageLatencyMs > 10000 ? 'critical' : 'warning',
            message: `Provider ${stat.provider} average latency (${stat.averageLatencyMs.toFixed(0)}ms) is above threshold (${latencyThresholdMs}ms)`,
            currentValue: stat.averageLatencyMs,
            threshold: latencyThresholdMs,
            timestamp,
          });
        }

        // Check error rate
        const errorRate = 100 - stat.successRate;
        if (errorRate > errorRateThreshold) {
          alerts.push({
            provider: stat.provider,
            alertType: 'high_error_rate',
            severity: errorRate > 10 ? 'critical' : 'warning',
            message: `Provider ${stat.provider} error rate (${errorRate.toFixed(1)}%) is above threshold (${errorRateThreshold}%)`,
            currentValue: errorRate,
            threshold: errorRateThreshold,
            timestamp,
          });
        }
      }

      return alerts;

    } catch (error) {
      console.error('Error getting provider performance alerts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const providerPerformanceService = new ProviderPerformanceService();