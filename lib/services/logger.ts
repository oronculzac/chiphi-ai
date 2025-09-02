import { config } from '@/lib/config';
import { randomUUID } from 'crypto';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  orgId?: string;
  component?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Logger class with structured logging support
class Logger {
  private correlationId?: string;
  private userId?: string;
  private orgId?: string;
  private component?: string;

  constructor(options?: {
    correlationId?: string;
    userId?: string;
    orgId?: string;
    component?: string;
  }) {
    this.correlationId = options?.correlationId;
    this.userId = options?.userId;
    this.orgId = options?.orgId;
    this.component = options?.component;
  }

  // Create child logger with additional context
  child(context: {
    correlationId?: string;
    userId?: string;
    orgId?: string;
    component?: string;
  }): Logger {
    return new Logger({
      correlationId: context.correlationId || this.correlationId,
      userId: context.userId || this.userId,
      orgId: context.orgId || this.orgId,
      component: context.component || this.component,
    });
  }

  // Set correlation ID for request tracking
  setCorrelationId(correlationId: string): Logger {
    return this.child({ correlationId });
  }

  // Set user context
  setUser(userId: string, orgId?: string): Logger {
    return this.child({ userId, orgId });
  }

  // Set component context
  setComponent(component: string): Logger {
    return this.child({ component });
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    
    return levels[level] >= levels[config.logging.level];
  }

  private formatLog(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): string {
    const entry: LogEntry = {
      timestamp: config.logging.timestamp ? new Date().toISOString() : '',
      level,
      message,
      ...(config.logging.correlationId && this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.orgId && { orgId: this.orgId }),
      ...(this.component && { component: this.component }),
      ...(metadata && { metadata }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    if (config.logging.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const parts = [];
    if (entry.timestamp) parts.push(`[${entry.timestamp}]`);
    parts.push(`${level.toUpperCase()}`);
    if (entry.correlationId) parts.push(`[${entry.correlationId}]`);
    if (entry.component) parts.push(`[${entry.component}]`);
    if (entry.userId) parts.push(`[user:${entry.userId}]`);
    if (entry.orgId) parts.push(`[org:${entry.orgId}]`);
    parts.push(message);
    
    if (metadata) {
      parts.push(`metadata=${JSON.stringify(metadata)}`);
    }
    
    if (error) {
      parts.push(`error=${error.message}`);
      if (error.stack && level === 'error') {
        parts.push(`\nStack: ${error.stack}`);
      }
    }

    return parts.join(' ');
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatLog('debug', message, metadata));
  }

  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatLog('info', message, metadata));
  }

  warn(message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatLog('warn', message, metadata, error));
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    console.error(this.formatLog('error', message, metadata, error));
  }

  // Email processing specific logging
  emailReceived(messageId: string, from: string, to: string): void {
    this.info('Email received for processing', {
      messageId,
      from,
      to,
      stage: 'received',
    });
  }

  emailProcessingStarted(messageId: string, stage: string): void {
    this.info('Email processing stage started', {
      messageId,
      stage,
    });
  }

  emailProcessingCompleted(messageId: string, transactionId: string, processingTime: number): void {
    this.info('Email processing completed successfully', {
      messageId,
      transactionId,
      processingTimeMs: processingTime,
      stage: 'completed',
    });
  }

  emailProcessingFailed(messageId: string, stage: string, error: Error): void {
    this.error('Email processing failed', error, {
      messageId,
      stage,
    });
  }

  // AI service logging
  aiServiceCall(service: string, model: string, tokens?: number, cost?: number): void {
    this.info('AI service called', {
      service,
      model,
      tokens,
      cost,
    });
  }

  aiServiceError(service: string, error: Error, retryCount?: number): void {
    this.error('AI service error', error, {
      service,
      retryCount,
    });
  }

  // Security logging
  securityEvent(event: string, details: Record<string, any>): void {
    this.warn('Security event detected', {
      event,
      ...details,
    });
  }

  // Performance logging
  slowQuery(queryName: string, duration: number, threshold: number): void {
    this.warn('Slow query detected', {
      queryName,
      durationMs: duration,
      thresholdMs: threshold,
    });
  }

  // Rate limiting logging
  rateLimitExceeded(orgId: string, endpoint: string, limit: number): void {
    this.warn('Rate limit exceeded', {
      orgId,
      endpoint,
      limit,
    });
  }
}

// Create default logger instance
export const logger = new Logger();

// Middleware to add correlation ID to requests
export function withCorrelationId(): string {
  return randomUUID();
}

// Express/Next.js middleware to add correlation ID to request
export function correlationIdMiddleware(req: any, res: any, next: any): void {
  const correlationId = req.headers['x-correlation-id'] || withCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

// Utility to create logger with request context
export function createRequestLogger(
  correlationId?: string,
  userId?: string,
  orgId?: string,
  component?: string
): Logger {
  return logger.child({
    correlationId,
    userId,
    orgId,
    component,
  });
}

// Error reporting integration (for Sentry or similar)
export function reportError(error: Error, context?: Record<string, any>): void {
  // Log the error
  logger.error('Unhandled error reported', error, context);
  
  // Send to error tracking service if configured
  if (config.monitoring.sentryDsn && typeof window === 'undefined') {
    // Server-side error reporting
    try {
      // This would integrate with Sentry or similar service
      // For now, just log it
      console.error('Error reported to monitoring service:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
      });
    } catch (reportingError) {
      logger.error('Failed to report error to monitoring service', reportingError);
    }
  }
}

// Performance monitoring utility
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  logger?: Logger
): Promise<T> {
  const startTime = Date.now();
  const log = logger || createRequestLogger();
  
  return fn().then(
    (result) => {
      const duration = Date.now() - startTime;
      log.info('Operation completed', {
        operation,
        durationMs: duration,
      });
      
      if (duration > config.performance.slowQueryThreshold) {
        log.slowQuery(operation, duration, config.performance.slowQueryThreshold);
      }
      
      return result;
    },
    (error) => {
      const duration = Date.now() - startTime;
      log.error('Operation failed', error, {
        operation,
        durationMs: duration,
      });
      throw error;
    }
  );
}