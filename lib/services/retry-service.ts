import { ProcessingError, ProcessingErrorType } from '@/lib/types';
import { loggingService } from './logging-service';
import { errorHandler } from './error-handler';

/**
 * Retry Service for Transient Failures
 * 
 * This service provides intelligent retry mechanisms for transient AI service failures
 * and other recoverable errors in the email processing pipeline.
 * 
 * Requirements covered:
 * - 10.2: Create retry mechanisms for transient AI service failures
 * - 10.1: Log all processing steps with timestamps
 * - 10.3: Log detailed error information for debugging
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs?: number;
  retryableErrors?: ProcessingErrorType[];
}

export interface RetryContext {
  orgId: string;
  emailId?: string;
  operationName: string;
  step: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: ProcessingError;
  attemptsUsed: number;
  totalTimeMs: number;
}

export class RetryService {
  // Default retry configurations for different operation types
  private readonly DEFAULT_CONFIGS: Record<string, RetryConfig> = {
    ai_service: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterMs: 500,
      retryableErrors: [
        ProcessingErrorType.TRANSLATION_FAILED,
        ProcessingErrorType.EXTRACTION_FAILED,
      ],
    },
    database: {
      maxRetries: 2,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterMs: 200,
      retryableErrors: [
        ProcessingErrorType.DATABASE_ERROR,
      ],
    },
    email_processing: {
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5,
      jitterMs: 1000,
      retryableErrors: [
        ProcessingErrorType.EMAIL_PARSE_FAILED,
      ],
    },
    rate_limit: {
      maxRetries: 5,
      baseDelayMs: 60000, // 1 minute
      maxDelayMs: 300000, // 5 minutes
      backoffMultiplier: 1.2,
      jitterMs: 5000,
      retryableErrors: [
        ProcessingErrorType.RATE_LIMIT_EXCEEDED,
      ],
    },
  };

  // Circuit breaker state for different services
  private circuitBreakers = new Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
  }>();

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    configType: keyof typeof this.DEFAULT_CONFIGS = 'ai_service',
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const config = { ...this.DEFAULT_CONFIGS[configType], ...customConfig };
    const correlationId = context.correlationId || loggingService.generateCorrelationId();
    
    let lastError: Error | ProcessingError | null = null;
    let attempt = 0;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(context.operationName)) {
      const error: ProcessingError = {
        type: ProcessingErrorType.DATABASE_ERROR,
        message: `Circuit breaker is open for ${context.operationName}`,
        details: { circuitBreakerState: 'open' },
        retryable: false,
      };

      await this.logRetryAttempt(context, correlationId, attempt, 'circuit_breaker_open', error);
      
      return {
        success: false,
        error,
        attemptsUsed: 0,
        totalTimeMs: Date.now() - startTime,
      };
    }

    while (attempt <= config.maxRetries) {
      try {
        // Log retry attempt (skip for first attempt)
        if (attempt > 0) {
          await this.logRetryAttempt(context, correlationId, attempt, 'started');
        }

        // Execute the operation
        const result = await operation();

        // Success - reset circuit breaker and log
        this.resetCircuitBreaker(context.operationName);
        
        if (attempt > 0) {
          await this.logRetryAttempt(context, correlationId, attempt, 'succeeded', undefined, {
            totalAttempts: attempt + 1,
            totalTimeMs: Date.now() - startTime,
          });
        }

        return {
          success: true,
          result,
          attemptsUsed: attempt + 1,
          totalTimeMs: Date.now() - startTime,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Convert to ProcessingError if needed
        const processingError = await this.normalizeError(lastError, context);
        
        // Check if error is retryable
        const isRetryable = this.isErrorRetryable(processingError, config);
        
        // Log the failed attempt
        await this.logRetryAttempt(context, correlationId, attempt, 'failed', processingError, {
          retryable: isRetryable,
          remainingAttempts: config.maxRetries - attempt,
        });

        // If not retryable or max retries reached, break
        if (!isRetryable || attempt >= config.maxRetries) {
          this.recordCircuitBreakerFailure(context.operationName);
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        
        // Log delay information
        await loggingService.logProcessingStep({
          orgId: context.orgId,
          emailId: context.emailId || '',
          step: `${context.step}_retry_delay`,
          status: 'started',
          details: {
            attempt: attempt + 1,
            delayMs: delay,
            operationName: context.operationName,
            correlationId,
          },
          correlationId,
        });

        // Wait before retry
        await this.sleep(delay);
        attempt++;
      }
    }

    // All retries exhausted
    const finalError = lastError ? await this.normalizeError(lastError, context) : {
      type: ProcessingErrorType.DATABASE_ERROR,
      message: 'Unknown error occurred',
      details: {},
      retryable: false,
    };

    // Log final failure
    await this.logRetryAttempt(context, correlationId, attempt, 'exhausted', finalError, {
      totalAttempts: attempt + 1,
      totalTimeMs: Date.now() - startTime,
    });

    return {
      success: false,
      error: finalError,
      attemptsUsed: attempt + 1,
      totalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Execute with exponential backoff for rate limits
   */
  async executeWithBackoff<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    maxRetries = 5
  ): Promise<T> {
    const result = await this.executeWithRetry(
      operation,
      context,
      'rate_limit',
      { maxRetries }
    );

    if (result.success && result.result !== undefined) {
      return result.result;
    }

    throw result.error || new Error('Operation failed after retries');
  }

  /**
   * Batch retry operations with concurrency control
   */
  async batchExecuteWithRetry<T>(
    operations: Array<{
      operation: () => Promise<T>;
      context: RetryContext;
      configType?: keyof typeof this.DEFAULT_CONFIGS;
    }>,
    concurrency = 3
  ): Promise<Array<RetryResult<T>>> {
    const results: Array<RetryResult<T>> = [];
    
    // Process operations in batches to control concurrency
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(({ operation, context, configType }) =>
          this.executeWithRetry(operation, context, configType)
        )
      );

      // Convert PromiseSettledResult to RetryResult
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: {
              type: ProcessingErrorType.DATABASE_ERROR,
              message: result.reason?.message || 'Batch operation failed',
              details: { batchError: true },
              retryable: false,
            },
            attemptsUsed: 0,
            totalTimeMs: 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if error is retryable based on configuration
   */
  private isErrorRetryable(error: ProcessingError, config: RetryConfig): boolean {
    // Check if error type is in retryable list
    if (config.retryableErrors && !config.retryableErrors.includes(error.type)) {
      return false;
    }

    // Check error message patterns for retryable conditions
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /too many requests/i,
      /service unavailable/i,
      /internal server error/i,
      /502|503|504/,
      /econnreset/i,
      /enotfound/i,
      /etimedout/i,
    ];

    return retryablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Normalize error to ProcessingError format
   */
  private async normalizeError(error: Error, context: RetryContext): Promise<ProcessingError> {
    return await errorHandler.handleProcessingError(error, {
      orgId: context.orgId,
      emailId: context.emailId,
      step: context.step,
      metadata: context.metadata,
    });
  }

  /**
   * Log retry attempt with detailed information
   */
  private async logRetryAttempt(
    context: RetryContext,
    correlationId: string,
    attempt: number,
    status: 'started' | 'succeeded' | 'failed' | 'exhausted' | 'circuit_breaker_open',
    error?: ProcessingError,
    metadata?: Record<string, any>
  ): Promise<void> {
    await loggingService.logProcessingStep({
      orgId: context.orgId,
      emailId: context.emailId || '',
      step: `${context.step}_retry`,
      status: status === 'succeeded' ? 'completed' : 'failed',
      details: {
        attempt: attempt + 1,
        operationName: context.operationName,
        retryStatus: status,
        errorType: error?.type,
        correlationId,
        ...context.metadata,
        ...metadata,
      },
      errorMessage: error?.message,
      correlationId,
    });
  }

  /**
   * Circuit breaker implementation
   */
  private isCircuitBreakerOpen(operationName: string): boolean {
    const breaker = this.circuitBreakers.get(operationName);
    if (!breaker) return false;

    const now = Date.now();
    
    // If circuit is open, check if timeout has passed
    if (breaker.state === 'open') {
      if (now - breaker.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT_MS) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private recordCircuitBreakerFailure(operationName: string): void {
    const breaker = this.circuitBreakers.get(operationName) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const,
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      console.warn(`Circuit breaker opened for ${operationName} after ${breaker.failures} failures`);
    }

    this.circuitBreakers.set(operationName, breaker);
  }

  private resetCircuitBreaker(operationName: string): void {
    const breaker = this.circuitBreakers.get(operationName);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
      this.circuitBreakers.set(operationName, breaker);
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, {
    failures: number;
    lastFailure: number;
    state: string;
  }> {
    const status: Record<string, any> = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      status[name] = {
        failures: breaker.failures,
        lastFailure: new Date(breaker.lastFailure).toISOString(),
        state: breaker.state,
      };
    }
    return status;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create custom retry configuration
   */
  createCustomConfig(overrides: Partial<RetryConfig>): RetryConfig {
    return {
      ...this.DEFAULT_CONFIGS.ai_service,
      ...overrides,
    };
  }

  /**
   * Get retry statistics for monitoring
   */
  async getRetryStatistics(orgId: string, hoursBack = 24): Promise<{
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageAttempts: number;
    topFailureReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      // This would query the processing_logs table for retry statistics
      // Implementation would depend on the specific logging structure
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageAttempts: 0,
        topFailureReasons: [],
      };
    } catch (error) {
      console.error('Error getting retry statistics:', error);
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageAttempts: 0,
        topFailureReasons: [],
      };
    }
  }
}

// Export singleton instance
export const retryService = new RetryService();