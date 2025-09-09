# Security and Monitoring Guidelines

## Multi-tenant Security

### Row Level Security (RLS)
- All database tables must have RLS policies enabled
- Users can only access data belonging to their organization
- Test cross-tenant isolation in all database operations
- Verify RLS policies in automated tests

### Data Isolation Patterns
```sql
-- Example RLS policy pattern
CREATE POLICY "Users can only access their org's data"
  ON table_name
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid()
    )
  );
```

### Reports-Specific Security Patterns
- **Database Function Security**: All fn_report_* functions must use SECURITY DEFINER with RLS enforcement
- **Export Rate Limiting**: Implement per-organization limits on CSV/YNAB exports
- **Filter Validation**: Validate all filter parameters to prevent SQL injection in search queries
- **Data Aggregation Security**: Ensure aggregated data doesn't leak cross-tenant information

### Email Processing Security
- HMAC signature verification for all inbound emails
- PAN redaction for credit card numbers
- 2FA code sanitization in email content
- Rate limiting per organization
- Input validation using Zod schemas

## Error Handling and Logging

### Correlation ID Tracking
- Generate unique correlation IDs for all requests
- Include correlation IDs in all log entries
- Use correlation IDs for request tracing across services
- Return correlation IDs in error responses for debugging

### Security Event Logging
```typescript
await loggingService.logSecurityEvent(
  'hmac_verification_failed',
  'high',
  {
    description: 'HMAC signature verification failed',
    metadata: {
      messageId,
      recipient,
      sender,
      ipAddress,
      userAgent,
    },
  }
);
```

### Error Classification and Handling
- **User errors**: Return 400-level status codes with sanitized messages
- **System errors**: Return 500-level status codes, log full details internally
- **Security errors**: Log with high severity, return minimal information
- **Processing errors**: Implement retry mechanisms with exponential backoff

## Monitoring and Observability

### Performance Monitoring
- Track email processing latency and throughput
- Monitor AI service response times and costs
- Alert on performance degradation or error rate spikes
- Use structured logging for better observability

### Health Checks
- Database connectivity verification
- External service availability checks
- Queue system health monitoring
- Storage system accessibility tests

### Rate Limiting
- Implement per-organization rate limits
- Log rate limit violations for monitoring
- Use sliding window rate limiting algorithms
- Provide clear error messages when limits are exceeded

## Data Protection

### PII Handling
- Redact credit card numbers (store only last 4 digits)
- Sanitize 2FA codes and sensitive authentication data
- Encrypt sensitive data at rest using database defaults
- Implement data retention policies

### Audit Logging
- Log all sensitive operations with user context
- Track data access patterns for anomaly detection
- Maintain audit trails for compliance requirements
- Implement log retention and archival policies

## Incident Response

### Error Recovery
- Implement idempotency for all critical operations
- Use database transactions for multi-step operations
- Provide manual retry mechanisms for failed operations
- Implement graceful degradation when services are unavailable

### Alerting and Notifications
- Set up alerts for critical system failures
- Monitor error rates and performance metrics
- Implement escalation procedures for security incidents
- Provide clear runbooks for common issues