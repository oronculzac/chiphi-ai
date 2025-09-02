import { ProcessingError, ProcessingErrorType } from '@/lib/types';
import { logProcessingStep } from '@/lib/database/utils';
import { notificationService } from './notification-service';

/**
 * Comprehensive Error Handler Service
 * 
 * This service provides centralized error handling for the email processing pipeline,
 * including error classification, retry logic, logging, and user notifications.
 * 
 * Requirements covered:
 * - 10.1: Log all processing steps with timestamps
 * - 10.2: Log usage and costs per organization
 * - 10.3: Log detailed error information for debugging
 * - 10.4: Log security events
 * - 10.5: Alert administrators on system performance degradation
 */
export class ErrorHandler {
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 30000;

  // Error classification patterns
  private readonly RETRYABLE_ERROR_PATTERNS = [
    /timeout/i,
    /network/i,
    /connection/i,
    /rate limit/i,
    /too many requests/i,
    /service unavailable/i,
    /internal server error/i,
    /502|503|504/,
    /ECONNRESET/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i,
  ];

  private readonly SECURITY_ERROR_PATTERNS = [
    /unauthorized/i,
    /forbidden/i,
    /invalid signature/i,
    /authentication failed/i,
    /access denied/i,
    /suspicious activity/i,
  ];

  private readonly CRITICAL_ERROR_PATTERNS = [
    /database connection/i,
    /out of memory/i,
    /disk full/i,
    /service down/i,
    /critical system/i,
  ];

  /**
   * Handle processing error with comprehensive logging and recovery
   */
  async handleProcessingError(
    error: Error | ProcessingError,
    context: {
      orgId: string;
      emailId?: string;
      step: string;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ProcessingError> {
    const startTime = Date.now();
    
    try {
      // Convert to ProcessingError if needed
      const processingError = this.normalizeError(error, context.step);
      
      // Log the error
      await this.logError(processingError, context);
      
      // Check if it's a security-related error
      if (this.isSecurityError(processingError)) {
        await this.handleSecurityError(processingError, context);
      }
      
      // Check if it's a critical error
      if (this.isCriticalError(processingError)) {
        await this.handleCriticalError(processingError, context);
      }
      
      // Send user notification if appropriate
      if (this.shouldNotifyUser(processingError)) {
        await this.notifyUser(processingError, context);
      }
      
      return processingError;
      
    } catch (handlingError) {
      // If error handling itself fails, log to console and return original error
      console.error('Error handling failed:', handlingError);
      
      return this.normalizeError(error, context.step);
    } finally {
      const handlingTime = Date.now() - startTime;
      console.log(`Error handling completed in ${handlingTime}ms`);
    }
  }

  /**
   * Execute function with retry logic for transient failures
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      orgId: string;
      emailId?: string;
      step: string;
      operationName: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.MAX_RETRIES) {
      try {
        // Log attempt if it's a retry
        if (attempt > 0) {
          await logProcessingStep(
            context.orgId,
            context.emailId || '',
            `${context.step}_retry`,
            'started',
            {
              attempt,
              operationName: context.operationName,
              ...context.metadata,
            }
          );
        }

        const result = await operation();
        
        // Log successful retry if applicable
        if (attempt > 0) {
          await logProcessingStep(
            context.orgId,
            context.emailId || '',
            `${context.step}_retry`,
            'completed',
            {
              attempt,
              operationName: context.operationName,
              retriesUsed: attempt,
            }
          );
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt >= this.MAX_RETRIES) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.BASE_DELAY_MS * Math.pow(2, attempt),
          this.MAX_DELAY_MS
        );

        // Log retry attempt
        await logProcessingStep(
          context.orgId,
          context.emailId || '',
          `${context.step}_retry`,
          'failed',
          {
            attempt,
            operationName: context.operationName,
            error: lastError.message,
            nextRetryInMs: delay,
          },
          lastError.message
        );

        // Wait before retry
        await this.sleep(delay);
        attempt++;
      }
    }

    // All retries exhausted, handle the final error
    const processingError = await this.handleProcessingError(lastError!, context);
    throw processingError;
  }

  /**
   * Normalize any error to ProcessingError format
   */
  private normalizeError(error: Error | ProcessingError, step: string): ProcessingError {
    if (this.isProcessingError(error)) {
      return error;
    }

    // Determine error type based on step and message
    let errorType = ProcessingErrorType.DATABASE_ERROR;
    const message = error.message.toLowerCase();

    if (step.includes('hmac') || step.includes('signature')) {
      errorType = ProcessingErrorType.HMAC_VERIFICATION_FAILED;
    } else if (step.includes('parse') || step.includes('email')) {
      errorType = ProcessingErrorType.EMAIL_PARSE_FAILED;
    } else if (step.includes('translation') || step.includes('language')) {
      errorType = ProcessingErrorType.TRANSLATION_FAILED;
    } else if (step.includes('extraction') || step.includes('ai')) {
      errorType = ProcessingErrorType.EXTRACTION_FAILED;
    } else if (message.includes('rate limit')) {
      errorType = ProcessingErrorType.RATE_LIMIT_EXCEEDED;
    }

    return {
      type: errorType,
      message: error.message,
      details: {
        step,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      retryable: this.isRetryableError(error),
    };
  }

  /**
   * Log error with comprehensive details
   */
  private async logError(
    error: ProcessingError,
    context: {
      orgId: string;
      emailId?: string;
      step: string;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const logDetails = {
        errorType: error.type,
        retryable: error.retryable,
        userId: context.userId,
        ...error.details,
        ...context.metadata,
      };

      await logProcessingStep(
        context.orgId,
        context.emailId || '',
        context.step,
        'failed',
        logDetails,
        error.message
      );

      // Also log to console for immediate visibility
      console.error(`Processing error in ${context.step}:`, {
        orgId: context.orgId,
        emailId: context.emailId,
        errorType: error.type,
        message: error.message,
        retryable: error.retryable,
        details: error.details,
      });

    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  /**
   * Handle security-related errors
   */
  private async handleSecurityError(
    error: ProcessingError,
    context: {
      orgId: string;
      emailId?: string;
      step: string;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Log as security event
      await logProcessingStep(
        context.orgId,
        context.emailId || '',
        'security_event',
        'failed',
        {
          securityEventType: error.type,
          step: context.step,
          userId: context.userId,
          ipAddress: context.metadata?.ipAddress,
          userAgent: context.metadata?.userAgent,
          ...error.details,
        },
        `Security event: ${error.message}`
      );

      // Notify administrators for critical security events
      if (this.isCriticalSecurityError(error)) {
        await notificationService.notifyAdministrators({
          type: 'security_alert',
          severity: 'high',
          title: 'Critical Security Event',
          message: `Security error in ${context.step}: ${error.message}`,
          details: {
            orgId: context.orgId,
            errorType: error.type,
            step: context.step,
          },
        });
      }

    } catch (handlingError) {
      console.error('Failed to handle security error:', handlingError);
    }
  }

  /**
   * Handle critical system errors
   */
  private async handleCriticalError(
    error: ProcessingError,
    context: {
      orgId: string;
      emailId?: string;
      step: string;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Log as critical system event
      await logProcessingStep(
        context.orgId,
        context.emailId || '',
        'critical_system_error',
        'failed',
        {
          criticalErrorType: error.type,
          step: context.step,
          systemHealth: await this.getSystemHealthMetrics(),
          ...error.details,
        },
        `Critical system error: ${error.message}`
      );

      // Notify administrators immediately
      await notificationService.notifyAdministrators({
        type: 'system_alert',
        severity: 'critical',
        title: 'Critical System Error',
        message: `Critical error in ${context.step}: ${error.message}`,
        details: {
          orgId: context.orgId,
          errorType: error.type,
          step: context.step,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (handlingError) {
      console.error('Failed to handle critical error:', handlingError);
    }
  }

  /**
   * Notify user about processing errors when appropriate
   */
  private async notifyUser(
    error: ProcessingError,
    context: {
      orgId: string;
      emailId?: string;
      step: string;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    if (!context.userId) return;

    try {
      let userMessage = 'We encountered an issue processing your receipt.';
      let actionRequired = false;

      switch (error.type) {
        case ProcessingErrorType.HMAC_VERIFICATION_FAILED:
          userMessage = 'We received an email that failed security verification. Please ensure you\'re forwarding from a trusted email address.';
          actionRequired = true;
          break;
        case ProcessingErrorType.EMAIL_PARSE_FAILED:
          userMessage = 'We had trouble reading your receipt email. Please try forwarding it again or contact support.';
          actionRequired = true;
          break;
        case ProcessingErrorType.TRANSLATION_FAILED:
          userMessage = 'We had trouble translating your receipt. The transaction may have been processed with the original text.';
          break;
        case ProcessingErrorType.EXTRACTION_FAILED:
          userMessage = 'We had trouble extracting data from your receipt. Please review the transaction details and make any necessary corrections.';
          actionRequired = true;
          break;
        case ProcessingErrorType.RATE_LIMIT_EXCEEDED:
          userMessage = 'You\'ve reached the processing limit for this hour. Please try again later.';
          actionRequired = true;
          break;
      }

      await notificationService.notifyUser(context.userId, {
        type: 'processing_error',
        severity: actionRequired ? 'medium' : 'low',
        title: 'Receipt Processing Issue',
        message: userMessage,
        details: {
          emailId: context.emailId,
          step: context.step,
          retryable: error.retryable,
        },
      });

    } catch (notificationError) {
      console.error('Failed to notify user:', notificationError);
    }
  }

  /**
   * Check if error is retryable based on patterns
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return this.RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Check if error is security-related
   */
  private isSecurityError(error: ProcessingError): boolean {
    const message = error.message.toLowerCase();
    return (
      error.type === ProcessingErrorType.HMAC_VERIFICATION_FAILED ||
      this.SECURITY_ERROR_PATTERNS.some(pattern => pattern.test(message))
    );
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error: ProcessingError): boolean {
    const message = error.message.toLowerCase();
    return this.CRITICAL_ERROR_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Check if security error is critical
   */
  private isCriticalSecurityError(error: ProcessingError): boolean {
    return (
      error.type === ProcessingErrorType.HMAC_VERIFICATION_FAILED ||
      error.message.toLowerCase().includes('suspicious activity')
    );
  }

  /**
   * Check if user should be notified about this error
   */
  private shouldNotifyUser(error: ProcessingError): boolean {
    // Don't notify for retryable errors that might resolve automatically
    if (error.retryable && !this.isCriticalError(error)) {
      return false;
    }

    // Always notify for non-retryable errors that affect user experience
    return [
      ProcessingErrorType.HMAC_VERIFICATION_FAILED,
      ProcessingErrorType.EMAIL_PARSE_FAILED,
      ProcessingErrorType.EXTRACTION_FAILED,
      ProcessingErrorType.RATE_LIMIT_EXCEEDED,
    ].includes(error.type);
  }

  /**
   * Type guard for ProcessingError
   */
  private isProcessingError(error: any): error is ProcessingError {
    return (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'message' in error &&
      'retryable' in error
    );
  }

  /**
   * Get basic system health metrics
   */
  private async getSystemHealthMetrics(): Promise<Record<string, any>> {
    try {
      return {
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
      };
    } catch (error) {
      return { error: 'Failed to collect system metrics' };
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();