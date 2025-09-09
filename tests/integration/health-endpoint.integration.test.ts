import { describe, it, expect } from 'vitest';

describe('Health Endpoint Integration', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  it('should return comprehensive health status with all required checks', async () => {
    const response = await fetch(`${baseURL}/api/health`);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('checks');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('correlationId');
    expect(data).toHaveProperty('details');

    // Verify checks structure - all required boolean fields
    expect(data.checks).toHaveProperty('ses_receive');
    expect(data.checks).toHaveProperty('s3');
    expect(data.checks).toHaveProperty('lambda');
    expect(data.checks).toHaveProperty('db');
    expect(data.checks).toHaveProperty('realtime');

    // Verify all checks are boolean values
    expect(typeof data.checks.ses_receive).toBe('boolean');
    expect(typeof data.checks.s3).toBe('boolean');
    expect(typeof data.checks.lambda).toBe('boolean');
    expect(typeof data.checks.db).toBe('boolean');
    expect(typeof data.checks.realtime).toBe('boolean');

    // Verify details structure
    expect(data.details).toHaveProperty('database');
    expect(data.details).toHaveProperty('realtime');

    // Verify database details
    expect(data.details.database).toHaveProperty('status');
    expect(data.details.database).toHaveProperty('connectionActive');

    // Verify realtime details
    expect(data.details.realtime).toHaveProperty('status');
    expect(data.details.realtime).toHaveProperty('connectionActive');

    // Verify AWS checks are included when SES provider is configured
    if (process.env.INBOUND_PROVIDER === 'ses' || data.details.aws) {
      expect(data.details).toHaveProperty('aws');
      expect(data.details.aws).toHaveProperty('ses_receive');
      expect(data.details.aws).toHaveProperty('s3');
      expect(data.details.aws).toHaveProperty('lambda');
      expect(data.details.aws).toHaveProperty('details');
      
      // Verify AWS details structure
      expect(data.details.aws.details).toHaveProperty('ses');
      expect(data.details.aws.details).toHaveProperty('s3');
      expect(data.details.aws.details).toHaveProperty('lambda');
      
      // Verify SES details
      expect(data.details.aws.details.ses).toHaveProperty('status');
      expect(data.details.aws.details.ses).toHaveProperty('receiptRuleActive');
      expect(data.details.aws.details.ses).toHaveProperty('domainVerified');
      
      // Verify S3 details
      expect(data.details.aws.details.s3).toHaveProperty('status');
      expect(data.details.aws.details.s3).toHaveProperty('bucketAccessible');
      expect(data.details.aws.details.s3).toHaveProperty('permissionsValid');
      
      // Verify Lambda details
      expect(data.details.aws.details.lambda).toHaveProperty('status');
      expect(data.details.aws.details.lambda).toHaveProperty('functionActive');
      expect(data.details.aws.details.lambda).toHaveProperty('recentExecutions');
    }

    // Verify status is one of expected values
    expect(['healthy', 'unhealthy', 'degraded']).toContain(data.status);
    
    // Verify timestamp is valid ISO string
    expect(() => new Date(data.timestamp)).not.toThrow();
    
    // Verify uptime is a positive number
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThan(0);

    // Verify correlation ID format
    expect(data.correlationId).toMatch(/^health_\d+_[a-z0-9]+$/);
  });

  it('should return appropriate HTTP status codes', async () => {
    const response = await fetch(`${baseURL}/api/health`);
    
    // Should return 200 (healthy), 207 (degraded), or 503 (unhealthy)
    expect([200, 207, 503]).toContain(response.status);
    
    // Should have appropriate headers
    expect(response.headers.get('cache-control')).toContain('no-cache');
    expect(response.headers.get('x-health-status')).toBeTruthy();
    expect(response.headers.get('x-health-timestamp')).toBeTruthy();
    expect(response.headers.get('x-health-correlation-id')).toBeTruthy();
    expect(response.headers.get('x-health-processing-time')).toMatch(/\d+ms/);
    expect(response.headers.get('x-health-uptime')).toMatch(/\d+s/);
  });

  it('should handle HEAD requests for simple health checks', async () => {
    const response = await fetch(`${baseURL}/api/health`, { method: 'HEAD' });
    
    // Should return 200 or 503
    expect([200, 503]).toContain(response.status);
    
    // Should have no body
    expect(response.body).toBeNull();
    
    // Should have health status header
    expect(response.headers.get('x-health-status')).toBeTruthy();
    expect(response.headers.get('x-health-correlation-id')).toBeTruthy();
  });

  it('should complete health check within reasonable time', async () => {
    const startTime = Date.now();
    const response = await fetch(`${baseURL}/api/health`);
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    
    // Health check should complete within 10 seconds
    expect(processingTime).toBeLessThan(10000);
    
    // Should have processing time header
    const headerProcessingTime = response.headers.get('x-health-processing-time');
    expect(headerProcessingTime).toMatch(/\d+ms/);
  });

  it('should return consistent structure across multiple requests', async () => {
    const responses = await Promise.all([
      fetch(`${baseURL}/api/health`),
      fetch(`${baseURL}/api/health`),
      fetch(`${baseURL}/api/health`),
    ]);

    const dataArray = await Promise.all(responses.map(r => r.json()));

    // All responses should have the same structure
    for (const data of dataArray) {
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('checks');
      expect(data.checks).toHaveProperty('ses_receive');
      expect(data.checks).toHaveProperty('s3');
      expect(data.checks).toHaveProperty('lambda');
      expect(data.checks).toHaveProperty('db');
      expect(data.checks).toHaveProperty('realtime');
    }

    // Correlation IDs should be unique
    const correlationIds = dataArray.map(d => d.correlationId);
    const uniqueIds = new Set(correlationIds);
    expect(uniqueIds.size).toBe(correlationIds.length);
  });
});