import { createAdminClient } from '@/lib/supabase/admin';
import { ProcessingError, ProcessingErrorType } from '@/lib/types';

/**
 * Comprehensive Logging Service
 * 
 * This service provides structured logging for all system operations,
 * including processing steps, AI usage, performance metrics, and errors.
 * 
 * Requirements covered:
 * - 10.1: Log all processing steps with timestamps
 * - 10.2: Log usage and costs per organization
 * - 10.3: Log detailed error information for debugging
 * - 10.4: Log security events
 * - 10.5: Alert administrators on system performance degradation
 */

export interface ProcessingStepLog {
  orgId: string;
  emailId: string;
  step: string;
  status: 'started' | 'completed' | 'failed';
  details?: Record<string, any>;
  errorMessage?: string;
  processingTimeMs?: number;
  correlationId?: string;
}

export interface AIUsageLog {
  orgId: string;
  emailId: string;
  serviceType: 'language_detection' | 'translation' | 'data_extraction';
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  processingTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface PerformanceMetric {
  orgId: string;
  metricType: 'processing_time' | 'ai_cost' | 'api_latency' | 'error_rate';
  metricValue: number;
  metricUnit: string;
  context?: Record<string, any>;
}

export interface SystemHealthMetric {
  metricName: string;
  metricValue: number;
  metricUnit: string;
  status: 'healthy' | 'warning' | 'critical';
  details?: Record<string, any>;
}

export class LoggingService {
  private supabase;
  
  // Performance thresholds for alerting
  private readonly PERFORMANCE_THRESHOLDS = {
    processing_time: { warning: 30000, critical: 60000 }, // ms
    ai_cost: { warning: 0.10, critical: 0.50 }, // USD per request
    api_latency: { warning: 5000, critical: 10000 }, // ms
    error_rate: { warning: 0.05, critical: 0.15 }, // percentage
  };

  constructor() {
    this.supabase = createAdminClient();
  }

  /**
   * Log processing step with correlation tracking
   */
  async logProcessingStep(log: ProcessingStepLog): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('log_processing_step', {
        org_uuid: log.orgId,
        email_uuid: log.emailId,
        step_name: log.step,
        step_status: log.status,
        step_details: log.details,
        error_msg: log.errorMessage,
        processing_time: log.processingTimeMs,
      });

      if (error) {
        console.error('Failed to log processing step:', error);
      }

      // Also log to console for immediate visibility
      const logLevel = log.status === 'failed' ? 'error' : 'info';
      console[logLevel](`Processing step [${log.step}] ${log.status}:`, {
        orgId: log.orgId,
        emailId: log.emailId,
        processingTimeMs: log.processingTimeMs,
        correlationId: log.correlationId,
        details: log.details,
      });

    } catch (error) {
      console.error('Error logging processing step:', error);
    }
  }

  /**
   * Log AI service usage and costs
   */
  async logAIUsage(log: AIUsageLog): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('log_ai_usage', {
        org_uuid: log.orgId,
        email_uuid: log.emailId,
        service_type_param: log.serviceType,
        model_name_param: log.modelName,
        input_tokens_param: log.inputTokens,
        output_tokens_param: log.outputTokens,
        cost_usd_param: log.costUsd,
        processing_time_ms_param: log.processingTimeMs,
        success_param: log.success,
        error_message_param: log.errorMessage,
      });

      if (error) {
        console.error('Failed to log AI usage:', error);
      }

      // Log to console for monitoring
      console.info(`AI usage [${log.serviceType}]:`, {
        orgId: log.orgId,
        model: log.modelName,
        tokens: log.inputTokens + log.outputTokens,
        cost: log.costUsd,
        success: log.success,
        processingTimeMs: log.processingTimeMs,
      });

      // Check for cost alerts
      await this.checkCostThresholds(log);

    } catch (error) {
      console.error('Error logging AI usage:', error);
    }
  }

  /**
   * Track detailed error information
   */
  async trackError(
    error: ProcessingError,
    context: {
      orgId: string;
      emailId: string;
      step: string;
      correlationId?: string;
    }
  ): Promise<string | null> {
    try {
      const { data: errorId, error: dbError } = await this.supabase.rpc('track_error', {
        org_uuid: context.orgId,
        email_uuid: context.emailId,
        error_type_param: error.type,
        error_message_param: error.message,
        error_details_param: error.details,
        stack_trace_param: error.details?.stack,
        step_param: context.step,
        retryable_param: error.retryable,
        correlation_id_param: context.correlationId,
      });

      if (dbError) {
        console.error('Failed to track error:', dbError);
        return null;
      }

      // Log to console for immediate visibility
      console.error(`Error tracked [${error.type}]:`, {
        errorId,
        orgId: context.orgId,
        emailId: context.emailId,
        step: context.step,
        message: error.message,
        retryable: error.retryable,
        correlationId: context.correlationId,
      });

      return errorId;

    } catch (error) {
      console.error('Error tracking error:', error);
      return null;
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('record_performance_metric', {
        org_uuid: metric.orgId,
        metric_type_param: metric.metricType,
        metric_value_param: metric.metricValue,
        metric_unit_param: metric.metricUnit,
        context_param: metric.context,
      });

      if (error) {
        console.error('Failed to record performance metric:', error);
      }

      // Check performance thresholds
      await this.checkPerformanceThresholds(metric);

    } catch (error) {
      console.error('Error recording performance metric:', error);
    }
  }

  /**
   * Update system health metrics
   */
  async updateSystemHealth(metric: SystemHealthMetric): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('update_system_health', {
        metric_name_param: metric.metricName,
        metric_value_param: metric.metricValue,
        metric_unit_param: metric.metricUnit,
        status_param: metric.status,
        details_param: metric.details,
      });

      if (error) {
        console.error('Failed to update system health:', error);
      }

      // Log critical health issues
      if (metric.status === 'critical') {
        console.error(`CRITICAL SYSTEM HEALTH: ${metric.metricName}`, {
          value: metric.metricValue,
          unit: metric.metricUnit,
          details: metric.details,
        });
      }

    } catch (error) {
      console.error('Error updating system health:', error);
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: {
      orgId?: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      description: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Log to processing logs if orgId is available
      if (details.orgId) {
        await this.logProcessingStep({
          orgId: details.orgId,
          emailId: '', // Security events may not have email context
          step: 'security_event',
          status: severity === 'critical' ? 'failed' : 'completed',
          details: {
            eventType,
            severity,
            userId: details.userId,
            ipAddress: details.ipAddress,
            userAgent: details.userAgent,
            description: details.description,
            ...details.metadata,
          },
          errorMessage: severity === 'critical' ? details.description : undefined,
        });
      }

      // Always log to console for security monitoring
      const logLevel = ['high', 'critical'].includes(severity) ? 'error' : 'warn';
      console[logLevel](`SECURITY EVENT [${eventType}] - ${severity.toUpperCase()}:`, {
        description: details.description,
        orgId: details.orgId,
        userId: details.userId,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        timestamp: new Date().toISOString(),
        metadata: details.metadata,
      });

    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Get error statistics for monitoring dashboard
   */
  async getErrorStatistics(
    orgId?: string,
    hoursBack = 24
  ): Promise<Array<{
    errorType: string;
    errorCount: number;
    retryCountAvg: number;
    resolvedCount: number;
    resolutionRate: number;
  }>> {
    try {
      const { data, error } = await this.supabase.rpc('get_error_statistics', {
        org_uuid: orgId,
        hours_back: hoursBack,
      });

      if (error) {
        console.error('Failed to get error statistics:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error getting error statistics:', error);
      return [];
    }
  }

  /**
   * Get AI usage costs for organization
   */
  async getAIUsageCosts(
    orgId: string,
    daysBack = 30
  ): Promise<Array<{
    serviceType: string;
    totalCostUsd: number;
    totalTokens: number;
    requestCount: number;
    avgCostPerRequest: number;
    successRate: number;
  }>> {
    try {
      const { data, error } = await this.supabase.rpc('get_ai_usage_costs', {
        org_uuid: orgId,
        days_back: daysBack,
      });

      if (error) {
        console.error('Failed to get AI usage costs:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error getting AI usage costs:', error);
      return [];
    }
  }

  /**
   * Get system health summary
   */
  async getSystemHealthSummary(): Promise<Array<{
    metricName: string;
    currentValue: number;
    metricUnit: string;
    status: string;
    lastUpdated: string;
  }>> {
    try {
      const { data, error } = await this.supabase.rpc('get_system_health_summary');

      if (error) {
        console.error('Failed to get system health summary:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error getting system health summary:', error);
      return [];
    }
  }

  /**
   * Check cost thresholds and alert if exceeded
   */
  private async checkCostThresholds(log: AIUsageLog): Promise<void> {
    try {
      // Get recent costs for this org
      const recentCosts = await this.getAIUsageCosts(log.orgId, 1); // Last day
      const totalDailyCost = recentCosts.reduce((sum, cost) => sum + cost.totalCostUsd, 0);

      // Check daily cost threshold
      if (totalDailyCost > 10.0) { // $10 daily threshold
        await this.updateSystemHealth({
          metricName: `ai_daily_cost_${log.orgId}`,
          metricValue: totalDailyCost,
          metricUnit: 'USD',
          status: totalDailyCost > 50.0 ? 'critical' : 'warning',
          details: {
            orgId: log.orgId,
            threshold: totalDailyCost > 50.0 ? 50.0 : 10.0,
            serviceBreakdown: recentCosts,
          },
        });
      }

    } catch (error) {
      console.error('Error checking cost thresholds:', error);
    }
  }

  /**
   * Check performance thresholds and alert if exceeded
   */
  private async checkPerformanceThresholds(metric: PerformanceMetric): Promise<void> {
    try {
      const thresholds = this.PERFORMANCE_THRESHOLDS[metric.metricType];
      if (!thresholds) return;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (metric.metricValue >= thresholds.critical) {
        status = 'critical';
      } else if (metric.metricValue >= thresholds.warning) {
        status = 'warning';
      }

      if (status !== 'healthy') {
        await this.updateSystemHealth({
          metricName: `${metric.metricType}_${metric.orgId}`,
          metricValue: metric.metricValue,
          metricUnit: metric.metricUnit,
          status,
          details: {
            orgId: metric.orgId,
            threshold: status === 'critical' ? thresholds.critical : thresholds.warning,
            context: metric.context,
          },
        });
      }

    } catch (error) {
      console.error('Error checking performance thresholds:', error);
    }
  }

  /**
   * Create correlation ID for tracking related operations
   */
  generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Batch log multiple processing steps (for performance)
   */
  async batchLogProcessingSteps(logs: ProcessingStepLog[]): Promise<void> {
    try {
      // Process logs in parallel for better performance
      await Promise.allSettled(
        logs.map(log => this.logProcessingStep(log))
      );
    } catch (error) {
      console.error('Error batch logging processing steps:', error);
    }
  }

  /**
   * Clean up old logs (for maintenance)
   */
  async cleanupOldLogs(daysToKeep = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clean up old processing logs
      const { error: logsError } = await this.supabase
        .from('processing_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (logsError) {
        console.error('Failed to cleanup old processing logs:', logsError);
      }

      // Clean up old error tracking
      const { error: errorsError } = await this.supabase
        .from('error_tracking')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .eq('resolved', true);

      if (errorsError) {
        console.error('Failed to cleanup old error tracking:', errorsError);
      }

      console.log(`Cleaned up logs older than ${daysToKeep} days`);

    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
}

// Export singleton instance
export const loggingService = new LoggingService();