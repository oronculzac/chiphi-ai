import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, HEAD } from '../route';
import { NextRequest } from 'next/server';

// Mock the services
vi.mock('@/lib/services/aws-health-service', () => ({
  awsHealthService: {
    checkAWSHealth: vi.fn(),
  },
}));

vi.mock('@/lib/services/database-health-service', () => ({
  databaseHealthService: {
    checkDatabaseAndRealtimeHealth: vi.fn(),
    checkDatabaseHealth: vi.fn(),
  },
}));

vi.mock('@/lib/config', () => ({
  config: {
    inboundProvider: {
      provider: 'ses',
    },
    healthCheck: {
      timeoutMs: 5000,
    },
    app: {
      nodeEnv: 'test',
    },
    logging: {
      enableProcessingLogs: true,
    },
  },
}));

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all checks pass', async () => {
      const { awsHealthService } = await import('@/lib/services/aws-health-service');
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      // Mock successful health checks
      vi.mocked(awsHealthService.checkAWSHealth).mockResolvedValue({
        ses_receive: true,
        s3: true,
        lambda: true,
        details: {
          ses: { status: 'healthy', receiptRuleActive: true, domainVerified: true },
          s3: { status: 'healthy', bucketAccessible: true, permissionsValid: true },
          lambda: { status: 'healthy', functionActive: true, recentExecutions: true },
        },
      });

      vi.mocked(databaseHealthService.checkDatabaseAndRealtimeHealth).mockResolvedValue({
        db: true,
        realtime: true,
        details: {
          database: { status: 'healthy', connectionActive: true },
          realtime: { status: 'healthy', connectionActive: true, channelsActive: 1 },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.checks).toEqual({
        ses_receive: true,
        s3: true,
        lambda: true,
        db: true,
        realtime: true,
      });
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('correlationId');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('environment');
    });

    it('should return degraded status when some checks fail', async () => {
      const { awsHealthService } = await import('@/lib/services/aws-health-service');
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      // Mock mixed health check results
      vi.mocked(awsHealthService.checkAWSHealth).mockResolvedValue({
        ses_receive: true,
        s3: false, // S3 failing
        lambda: true,
        details: {
          ses: { status: 'healthy', receiptRuleActive: true, domainVerified: true },
          s3: { status: 'unhealthy', bucketAccessible: false, permissionsValid: false, error: 'Bucket not accessible' },
          lambda: { status: 'healthy', functionActive: true, recentExecutions: true },
        },
      });

      vi.mocked(databaseHealthService.checkDatabaseAndRealtimeHealth).mockResolvedValue({
        db: true,
        realtime: true,
        details: {
          database: { status: 'healthy', connectionActive: true },
          realtime: { status: 'healthy', connectionActive: true, channelsActive: 1 },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(207); // Multi-Status for degraded
      expect(data.status).toBe('degraded');
      expect(data.checks.s3).toBe(false);
      expect(data.details.aws.details.s3.error).toBe('Bucket not accessible');
    });

    it('should return unhealthy status when most checks fail', async () => {
      const { awsHealthService } = await import('@/lib/services/aws-health-service');
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      // Mock failed health checks
      vi.mocked(awsHealthService.checkAWSHealth).mockResolvedValue({
        ses_receive: false,
        s3: false,
        lambda: false,
        details: {
          ses: { status: 'unhealthy', receiptRuleActive: false, domainVerified: false, error: 'SES not configured' },
          s3: { status: 'unhealthy', bucketAccessible: false, permissionsValid: false, error: 'S3 not accessible' },
          lambda: { status: 'unhealthy', functionActive: false, recentExecutions: false, error: 'Lambda not found' },
        },
      });

      vi.mocked(databaseHealthService.checkDatabaseAndRealtimeHealth).mockResolvedValue({
        db: false,
        realtime: false,
        details: {
          database: { status: 'unhealthy', connectionActive: false, error: 'Database connection failed' },
          realtime: { status: 'unhealthy', connectionActive: false, channelsActive: 0, error: 'Realtime connection failed' },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503); // Service Unavailable
      expect(data.status).toBe('unhealthy');
      expect(data.checks).toEqual({
        ses_receive: false,
        s3: false,
        lambda: false,
        db: false,
        realtime: false,
      });
    });

    it('should handle timeout errors gracefully', async () => {
      const { awsHealthService } = await import('@/lib/services/aws-health-service');
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      // Mock timeout errors
      vi.mocked(awsHealthService.checkAWSHealth).mockRejectedValue(new Error('Health check timeout'));
      vi.mocked(databaseHealthService.checkDatabaseAndRealtimeHealth).mockRejectedValue(new Error('Database timeout'));

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data).toHaveProperty('correlationId');
    });

    it('should include proper response headers', async () => {
      const { awsHealthService } = await import('@/lib/services/aws-health-service');
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      vi.mocked(awsHealthService.checkAWSHealth).mockResolvedValue({
        ses_receive: true,
        s3: true,
        lambda: true,
        details: {
          ses: { status: 'healthy', receiptRuleActive: true, domainVerified: true },
          s3: { status: 'healthy', bucketAccessible: true, permissionsValid: true },
          lambda: { status: 'healthy', functionActive: true, recentExecutions: true },
        },
      });

      vi.mocked(databaseHealthService.checkDatabaseAndRealtimeHealth).mockResolvedValue({
        db: true,
        realtime: true,
        details: {
          database: { status: 'healthy', connectionActive: true },
          realtime: { status: 'healthy', connectionActive: true, channelsActive: 1 },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
      expect(response.headers.get('X-Health-Status')).toBe('healthy');
      expect(response.headers.get('X-Health-Timestamp')).toBeTruthy();
      expect(response.headers.get('X-Health-Correlation-ID')).toBeTruthy();
      expect(response.headers.get('X-Health-Processing-Time')).toMatch(/\d+ms/);
      expect(response.headers.get('X-Health-Uptime')).toMatch(/\d+s/);
    });
  });

  describe('HEAD /api/health', () => {
    it('should return 200 for healthy database', async () => {
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      vi.mocked(databaseHealthService.checkDatabaseHealth).mockResolvedValue({
        status: 'healthy',
        connectionActive: true,
      });

      const request = new NextRequest('http://localhost:3000/api/health', { method: 'HEAD' });
      const response = await HEAD(request);

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
      expect(response.headers.get('X-Health-Status')).toBe('healthy');
      expect(response.headers.get('X-Health-Correlation-ID')).toBeTruthy();
    });

    it('should return 503 for unhealthy database', async () => {
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      vi.mocked(databaseHealthService.checkDatabaseHealth).mockResolvedValue({
        status: 'unhealthy',
        connectionActive: false,
        error: 'Database connection failed',
      });

      const request = new NextRequest('http://localhost:3000/api/health', { method: 'HEAD' });
      const response = await HEAD(request);

      expect(response.status).toBe(503);
      expect(response.body).toBeNull();
      expect(response.headers.get('X-Health-Status')).toBe('unhealthy');
    });

    it('should handle errors in HEAD request', async () => {
      const { databaseHealthService } = await import('@/lib/services/database-health-service');

      vi.mocked(databaseHealthService.checkDatabaseHealth).mockRejectedValue(new Error('Connection timeout'));

      const request = new NextRequest('http://localhost:3000/api/health', { method: 'HEAD' });
      const response = await HEAD(request);

      expect(response.status).toBe(503);
      expect(response.headers.get('X-Health-Status')).toBe('unhealthy');
      expect(response.headers.get('X-Health-Error')).toBe('Connection timeout');
    });
  });
});