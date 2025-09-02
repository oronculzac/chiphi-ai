# Error Handling and Logging System

This document describes the comprehensive error handling and logging system implemented for the ChiPhi AI email receipt processor.

## Overview

The error handling and logging system provides:

- **Comprehensive Error Classification**: Automatic categorization of errors by type and severity
- **Intelligent Retry Mechanisms**: Exponential backoff with jitter for transient failures
- **Circuit Breaker Pattern**: Prevents cascading failures by temporarily disabling failing services
- **Detailed Logging**: Structured logging with correlation IDs for tracing requests
- **Performance Monitoring**: Real-time metrics collection and alerting
- **User Notifications**: Contextual notifications for processing events
- **Administrator Alerts**: Critical system alerts for operational issues

## Architecture

### Core Services

1. **ErrorHandler** (`lib/services/error-handler.ts`)
   - Centralizes error handling logic
   - Provides retry mechanisms with exponential backoff
   - Classifies errors by type and severity
   - Integrates with logging and notification services

2. **LoggingService** (`lib/services/logging-service.ts`)
   - Structured logging for all system operations
   - AI usage and cost tracking
   - Performance metrics collection
   - Security event logging

3. **RetryService** (`lib/services/retry-service.ts`)
   - Intelligent retry logic for transient failures
   - Circuit breaker implementation
   - Batch operation support with concurrency control

4. **NotificationService** (`lib/services/notification-service.ts`)
   - User notifications for processing events
   - Administrator alerts for system issues
   - Rate limiting to prevent notification spam

5. **EnhancedEmailProcessor** (`lib/services/enhanced-email-processor.ts`)
   - Orchestrates the complete email processing pipeline
   - Integrates all error handling and logging services
   - Provides comprehensive processing statistics

## Error Classification

Errors are automatically classified into the following types:

- **HMAC_VERIFICATION_FAILED**: Security-related authentication failures
- **EMAIL_PARSE_FAILED**: Issues parsing email content
- **TRANSLATION_FAILED**: AI translation service failures
- **EXTRACTION_FAILED**: AI data extraction failures
- **DATABASE_ERROR**: Database connection or query issues
- **RATE_LIMIT_EXCEEDED**: API rate limiting violations

Each error includes:
- **Type**: Categorization for handling logic
- **Message**: Human-readable description
- **Details**: Structured metadata for debugging
- **Retryable**: Whether the operation can be retried
- **Correlation ID**: For tracing related operations

## Retry Mechanisms

The system implements intelligent retry logic with:

### Exponential Backoff
- Base delay starts at 1 second
- Multiplier of 2x for each retry
- Maximum delay capped at 30 seconds
- Jitter added to prevent thundering herd

### Circuit Breaker
- Opens after 5 consecutive failures
- Remains open for 1 minute
- Half-open state allows single test request
- Automatically resets on success

### Retry Configurations
Different operation types have optimized retry settings:

```typescript
ai_service: {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

database: {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
}

rate_limit: {
  maxRetries: 5,
  baseDelayMs: 60000, // 1 minute
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 1.2,
}
```

## Logging and Monitoring

### Processing Step Logging
Every processing step is logged with:
- Timestamp and duration
- Organization and email context
- Step status (started/completed/failed)
- Detailed metadata
- Correlation ID for tracing

### AI Usage Tracking
AI service calls are logged with:
- Service type (detection/translation/extraction)
- Model name and token usage
- Cost in USD
- Success/failure status
- Processing time

### Performance Metrics
System performance is monitored with:
- Processing time per operation
- Error rates by type
- API latency measurements
- Cost per organization

### Security Event Logging
Security-related events are logged including:
- HMAC verification failures
- Invalid recipient attempts
- Suspicious activity patterns
- IP addresses and user agents

## Database Schema

The system uses several database tables for comprehensive logging:

### Core Logging Tables
- `processing_logs`: Step-by-step processing events
- `error_tracking`: Detailed error information
- `ai_usage_logs`: AI service usage and costs
- `performance_metrics`: System performance data

### Notification Tables
- `user_notifications`: User-facing notifications
- `admin_notifications`: Administrator alerts

### Monitoring Tables
- `system_health`: System health metrics
- `rate_limits`: Rate limiting tracking

## API Endpoints

### Monitoring API (`/api/monitoring`)
Provides comprehensive monitoring data:

- `GET /api/monitoring?metric=error_statistics` - Error statistics
- `GET /api/monitoring?metric=ai_usage_costs` - AI usage costs
- `GET /api/monitoring?metric=system_health` - System health status
- `GET /api/monitoring?metric=processing_statistics` - Processing statistics
- `GET /api/monitoring` - Overall monitoring dashboard

## Usage Examples

### Basic Error Handling
```typescript
import { errorHandler } from '@/lib/services/error-handler';

try {
  const result = await someOperation();
} catch (error) {
  const processingError = await errorHandler.handleProcessingError(error, {
    orgId: 'org-123',
    emailId: 'email-456',
    step: 'data_extraction',
    userId: 'user-789',
  });
  
  // Error is automatically logged and classified
  throw processingError;
}
```

### Retry with Exponential Backoff
```typescript
import { retryService } from '@/lib/services/retry-service';

const result = await retryService.executeWithRetry(
  () => aiService.extractData(text),
  {
    orgId: 'org-123',
    operationName: 'ai_extraction',
    step: 'data_extraction',
  },
  'ai_service'
);

if (result.success) {
  console.log('Data extracted:', result.result);
} else {
  console.error('Extraction failed:', result.error);
}
```

### Comprehensive Logging
```typescript
import { loggingService } from '@/lib/services/logging-service';

const correlationId = loggingService.generateCorrelationId();

await loggingService.logProcessingStep({
  orgId: 'org-123',
  emailId: 'email-456',
  step: 'email_processing',
  status: 'started',
  correlationId,
});

// ... processing logic ...

await loggingService.logAIUsage({
  orgId: 'org-123',
  emailId: 'email-456',
  serviceType: 'data_extraction',
  modelName: 'gpt-4o-mini',
  inputTokens: 100,
  outputTokens: 50,
  costUsd: 0.01,
  processingTimeMs: 2000,
  success: true,
});
```

## Best Practices

### Error Handling
1. Always use the centralized error handler
2. Include relevant context in error metadata
3. Use correlation IDs to trace related operations
4. Classify errors appropriately for retry logic

### Logging
1. Log all significant processing steps
2. Include timing information for performance monitoring
3. Use structured logging with consistent metadata
4. Avoid logging sensitive information (PII)

### Monitoring
1. Set up alerts for critical error rates
2. Monitor AI usage costs regularly
3. Track performance metrics over time
4. Review security events for suspicious patterns

### Notifications
1. Notify users for actionable errors
2. Alert administrators for system issues
3. Implement rate limiting to prevent spam
4. Provide clear, actionable messages

## Troubleshooting

### Common Issues

1. **High Error Rates**
   - Check system health metrics
   - Review error statistics by type
   - Verify external service availability

2. **Performance Degradation**
   - Monitor processing time metrics
   - Check circuit breaker status
   - Review AI usage costs

3. **Missing Logs**
   - Verify database connectivity
   - Check RLS policies
   - Review error tracking table

4. **Failed Notifications**
   - Check notification service configuration
   - Verify user/admin notification tables
   - Review rate limiting settings

### Monitoring Queries

Get error statistics:
```sql
SELECT * FROM get_error_statistics('org-id', 24);
```

Get AI usage costs:
```sql
SELECT * FROM get_ai_usage_costs('org-id', 30);
```

Get system health:
```sql
SELECT * FROM get_system_health_summary();
```

## Future Enhancements

1. **Advanced Analytics**
   - Machine learning for error prediction
   - Anomaly detection for unusual patterns
   - Predictive cost modeling

2. **Enhanced Alerting**
   - Integration with PagerDuty/Slack
   - Smart alert grouping and deduplication
   - Escalation policies

3. **Performance Optimization**
   - Adaptive retry strategies
   - Dynamic circuit breaker thresholds
   - Intelligent load balancing

4. **Compliance and Auditing**
   - Audit trail for all operations
   - Compliance reporting
   - Data retention policies