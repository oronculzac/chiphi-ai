import { loggingService } from './logging-service';
import { idempotencyService } from './idempotency-service';

/**
 * Correlation Service for Email Processing Pipeline
 * 
 * This service manages correlation IDs throughout the entire email processing
 * pipeline, ensuring all operations are linked for audit trail purposes.
 * 
 * Requirements covered:
 * - 4.4: Generate correlation ID and propagate through entire pipeline
 * - 4.5: Implement audit trail linking Lambda processing to transaction creation
 */

export interface CorrelationContext {
  correlationId: string;
  orgId: string;
  messageId: string;
  provider: 'ses' | 'cloudflare';
  alias: string;
  rawRef?: string;
  startTime: number;
  steps: Array<{
    step: string;
    status: 'started' | 'completed' | 'failed';
    timestamp: number;
    duration?: number;
    details?: any;
  }>;
}

export class CorrelationService {
  private activeCorrelations = new Map<string, CorrelationContext>();

  /**
   * Create a new correlation context for email processing
   */
  createCorrelationContext(
    orgId: string,
    messageId: string,
    provider: 'ses' | 'cloudflare',
    alias: string,
    rawRef?: string
  ): CorrelationContext {
    const correlationId = loggingService.generateCorrelationId();
    const context: CorrelationContext = {
      correlationId,
      orgId,
      messageId,
      provider,
      alias,
      rawRef,
      startTime: Date.now(),
      steps: [],
    };

    this.activeCorrelations.set(correlationId, context);
    return context;
  }

  /**
   * Get correlation context by ID
   */
  getCorrelationContext(correlationId: string): CorrelationContext | undefined {
    return this.activeCorrelations.get(correlationId);
  }

  /**
   * Start a processing step within a correlation context
   */
  async startStep(
    correlationId: string,
    stepName: string,
    details?: any
  ): Promise<void> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      console.warn(`Correlation context not found: ${correlationId}`);
      return;
    }

    const step = {
      step: stepName,
      status: 'started' as const,
      timestamp: Date.now(),
      details,
    };

    context.steps.push(step);

    // Log the step start
    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId: '', // Will be updated when email is created
      step: stepName,
      status: 'started',
      details: {
        messageId: context.messageId,
        provider: context.provider,
        alias: context.alias,
        rawRef: context.rawRef,
        correlationId,
        ...details,
      },
      correlationId,
    });
  }

  /**
   * Complete a processing step within a correlation context
   */
  async completeStep(
    correlationId: string,
    stepName: string,
    details?: any,
    emailId?: string
  ): Promise<void> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      console.warn(`Correlation context not found: ${correlationId}`);
      return;
    }

    // Find the step and update it
    const step = context.steps.find(s => s.step === stepName && s.status === 'started');
    if (step) {
      step.status = 'completed';
      step.duration = Date.now() - step.timestamp;
      if (details) {
        step.details = { ...step.details, ...details };
      }
    }

    // Log the step completion
    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId: emailId || '',
      step: stepName,
      status: 'completed',
      details: {
        messageId: context.messageId,
        provider: context.provider,
        alias: context.alias,
        rawRef: context.rawRef,
        correlationId,
        duration: step?.duration,
        ...details,
      },
      processingTimeMs: step?.duration,
      correlationId,
    });
  }

  /**
   * Fail a processing step within a correlation context
   */
  async failStep(
    correlationId: string,
    stepName: string,
    error: Error,
    details?: any,
    emailId?: string
  ): Promise<void> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      console.warn(`Correlation context not found: ${correlationId}`);
      return;
    }

    // Find the step and update it
    const step = context.steps.find(s => s.step === stepName && s.status === 'started');
    if (step) {
      step.status = 'failed';
      step.duration = Date.now() - step.timestamp;
      if (details) {
        step.details = { ...step.details, ...details };
      }
    }

    // Log the step failure
    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId: emailId || '',
      step: stepName,
      status: 'failed',
      details: {
        messageId: context.messageId,
        provider: context.provider,
        alias: context.alias,
        rawRef: context.rawRef,
        correlationId,
        duration: step?.duration,
        error: error.message,
        ...details,
      },
      errorMessage: error.message,
      processingTimeMs: step?.duration,
      correlationId,
    });
  }

  /**
   * Link correlation context with idempotency record
   */
  async linkWithIdempotencyRecord(
    correlationId: string,
    idempotencyRecordId: string
  ): Promise<void> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      console.warn(`Correlation context not found: ${correlationId}`);
      return;
    }

    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId: '',
      step: 'idempotency_record_linked',
      status: 'completed',
      details: {
        messageId: context.messageId,
        provider: context.provider,
        alias: context.alias,
        rawRef: context.rawRef,
        correlationId,
        idempotencyRecordId,
      },
      correlationId,
    });
  }

  /**
   * Link correlation context with email record
   */
  async linkWithEmailRecord(
    correlationId: string,
    emailId: string
  ): Promise<void> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      console.warn(`Correlation context not found: ${correlationId}`);
      return;
    }

    // Update all previous steps to include the email ID
    for (const step of context.steps) {
      await loggingService.logProcessingStep({
        orgId: context.orgId,
        emailId,
        step: `${step.step}_email_linked`,
        status: 'completed',
        details: {
          messageId: context.messageId,
          provider: context.provider,
          alias: context.alias,
          rawRef: context.rawRef,
          correlationId,
          originalStep: step.step,
          originalStatus: step.status,
          originalTimestamp: step.timestamp,
          originalDuration: step.duration,
        },
        correlationId,
      });
    }
  }

  /**
   * Link correlation context with transaction record
   */
  async linkWithTransactionRecord(
    correlationId: string,
    transactionId: string,
    emailId: string
  ): Promise<void> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      console.warn(`Correlation context not found: ${correlationId}`);
      return;
    }

    const totalProcessingTime = Date.now() - context.startTime;

    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId,
      step: 'transaction_created',
      status: 'completed',
      details: {
        messageId: context.messageId,
        provider: context.provider,
        alias: context.alias,
        rawRef: context.rawRef,
        correlationId,
        transactionId,
        totalProcessingTime,
        stepsCompleted: context.steps.length,
      },
      processingTimeMs: totalProcessingTime,
      correlationId,
    });
  }

  /**
   * Complete correlation context and generate audit trail summary
   */
  async completeCorrelation(
    correlationId: string,
    success: boolean,
    finalDetails?: any
  ): Promise<{
    correlationId: string;
    totalProcessingTime: number;
    stepsCompleted: number;
    success: boolean;
    auditTrail: Array<{
      step: string;
      status: string;
      timestamp: number;
      duration?: number;
    }>;
  }> {
    const context = this.activeCorrelations.get(correlationId);
    if (!context) {
      throw new Error(`Correlation context not found: ${correlationId}`);
    }

    const totalProcessingTime = Date.now() - context.startTime;

    // Log correlation completion
    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId: '',
      step: 'correlation_completed',
      status: success ? 'completed' : 'failed',
      details: {
        messageId: context.messageId,
        provider: context.provider,
        alias: context.alias,
        rawRef: context.rawRef,
        correlationId,
        totalProcessingTime,
        stepsCompleted: context.steps.length,
        success,
        ...finalDetails,
      },
      processingTimeMs: totalProcessingTime,
      correlationId,
    });

    // Create audit trail summary
    const auditTrail = context.steps.map(step => ({
      step: step.step,
      status: step.status,
      timestamp: step.timestamp,
      duration: step.duration,
    }));

    // Clean up active correlation
    this.activeCorrelations.delete(correlationId);

    return {
      correlationId,
      totalProcessingTime,
      stepsCompleted: context.steps.length,
      success,
      auditTrail,
    };
  }

  /**
   * Get processing statistics for correlation tracking
   */
  async getCorrelationStatistics(
    orgId?: string,
    hoursBack = 24
  ): Promise<{
    totalCorrelations: number;
    completedCorrelations: number;
    failedCorrelations: number;
    averageProcessingTime: number;
    stepBreakdown: Array<{
      step: string;
      count: number;
      averageDuration: number;
      successRate: number;
    }>;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      // Get correlation completion logs
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let query = supabase
        .from('processing_logs')
        .select('details, processing_time_ms, status')
        .eq('step', 'correlation_completed')
        .gte('created_at', cutoffTime.toISOString());

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data: correlationLogs, error: correlationError } = await query;

      if (correlationError) {
        throw new Error(`Failed to get correlation logs: ${correlationError.message}`);
      }

      // Get all processing steps for step breakdown
      let stepQuery = supabase
        .from('processing_logs')
        .select('step, processing_time_ms, status, details')
        .gte('created_at', cutoffTime.toISOString())
        .not('step', 'eq', 'correlation_completed');

      if (orgId) {
        stepQuery = stepQuery.eq('org_id', orgId);
      }

      const { data: stepLogs, error: stepError } = await stepQuery;

      if (stepError) {
        console.error('Failed to get step logs for statistics:', stepError);
      }

      // Calculate statistics
      const totalCorrelations = correlationLogs?.length || 0;
      const completedCorrelations = correlationLogs?.filter(log => 
        log.details?.success === true
      ).length || 0;
      const failedCorrelations = totalCorrelations - completedCorrelations;

      const averageProcessingTime = totalCorrelations > 0
        ? (correlationLogs?.reduce((sum, log) => 
            sum + (log.processing_time_ms || 0), 0
          ) || 0) / totalCorrelations
        : 0;

      // Calculate step breakdown
      const stepStats = new Map<string, {
        count: number;
        totalDuration: number;
        successCount: number;
      }>();

      stepLogs?.forEach(log => {
        const step = log.step;
        const current = stepStats.get(step) || { count: 0, totalDuration: 0, successCount: 0 };
        current.count++;
        current.totalDuration += log.processing_time_ms || 0;
        if (log.status === 'completed') {
          current.successCount++;
        }
        stepStats.set(step, current);
      });

      const stepBreakdown = Array.from(stepStats.entries()).map(([step, stats]) => ({
        step,
        count: stats.count,
        averageDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
        successRate: stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0,
      }));

      return {
        totalCorrelations,
        completedCorrelations,
        failedCorrelations,
        averageProcessingTime,
        stepBreakdown,
      };

    } catch (error) {
      console.error('Error getting correlation statistics:', error);
      return {
        totalCorrelations: 0,
        completedCorrelations: 0,
        failedCorrelations: 0,
        averageProcessingTime: 0,
        stepBreakdown: [],
      };
    }
  }

  /**
   * Clean up old active correlations that may have been orphaned
   */
  cleanupOrphanedCorrelations(maxAgeMinutes = 60): number {
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
    let cleanedCount = 0;

    for (const [correlationId, context] of this.activeCorrelations.entries()) {
      if (context.startTime < cutoffTime) {
        this.activeCorrelations.delete(correlationId);
        cleanedCount++;
        console.warn(`Cleaned up orphaned correlation: ${correlationId}`);
      }
    }

    return cleanedCount;
  }

  /**
   * Get active correlation count for monitoring
   */
  getActiveCorrelationCount(): number {
    return this.activeCorrelations.size;
  }
}

// Export singleton instance
export const correlationService = new CorrelationService();