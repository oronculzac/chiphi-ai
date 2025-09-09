import { describe, it, expect, vi, beforeEach } from 'vitest';
import { awsHealthService } from '../aws-health-service';
import { execSync } from 'child_process';

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

const mockExecSync = vi.mocked(execSync);

describe('AWSHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSESHealth', () => {
    it('should return healthy status when SES is properly configured', async () => {
      // Mock successful SES rule check
      mockExecSync
        .mockReturnValueOnce(JSON.stringify({
          Rule: { Enabled: true }
        }))
        .mockReturnValueOnce(JSON.stringify({
          VerificationAttributes: {
            'chiphi.oronculzac.com': { VerificationStatus: 'Success' }
          }
        }));

      const result = await awsHealthService.checkSESHealth();

      expect(result.status).toBe('healthy');
      expect(result.receiptRuleActive).toBe(true);
      expect(result.domainVerified).toBe(true);
      expect(result.details?.ruleSetName).toBe('SESReceiptRuleSet');
    });

    it('should return unhealthy status when SES rule is disabled', async () => {
      mockExecSync
        .mockReturnValueOnce(JSON.stringify({
          Rule: { Enabled: false }
        }))
        .mockReturnValueOnce(JSON.stringify({
          VerificationAttributes: {
            'chiphi.oronculzac.com': { VerificationStatus: 'Success' }
          }
        }));

      const result = await awsHealthService.checkSESHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.receiptRuleActive).toBe(false);
      expect(result.domainVerified).toBe(true);
    });

    it('should handle AWS CLI errors gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('AWS CLI not found');
      });

      const result = await awsHealthService.checkSESHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.receiptRuleActive).toBe(false);
      expect(result.domainVerified).toBe(false);
      expect(result.error).toContain('AWS CLI not found');
    });
  });

  describe('checkS3Health', () => {
    it('should return healthy status when S3 is accessible with proper permissions', async () => {
      // Mock successful S3 head-bucket check
      mockExecSync
        .mockReturnValueOnce('') // head-bucket returns empty on success
        .mockReturnValueOnce(JSON.stringify({
          Policy: JSON.stringify({
            Statement: [{
              Principal: { Service: 'ses.amazonaws.com' },
              Action: 's3:PutObject'
            }]
          })
        }))
        .mockReturnValueOnce('2024-01-15 10:30:00 test-email.txt');

      const result = await awsHealthService.checkS3Health();

      expect(result.status).toBe('healthy');
      expect(result.bucketAccessible).toBe(true);
      expect(result.permissionsValid).toBe(true);
      expect(result.details?.bucketName).toBe('chiphi-raw-emails');
    });

    it('should return unhealthy status when bucket is not accessible', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('NoSuchBucket');
      });

      const result = await awsHealthService.checkS3Health();

      expect(result.status).toBe('unhealthy');
      expect(result.bucketAccessible).toBe(false);
      expect(result.permissionsValid).toBe(false);
      expect(result.error).toContain('NoSuchBucket');
    });
  });

  describe('checkLambdaHealth', () => {
    it('should return healthy status when Lambda function is active', async () => {
      mockExecSync
        .mockReturnValueOnce(JSON.stringify({
          Configuration: {
            State: 'Active',
            Runtime: 'nodejs20.x'
          }
        }))
        .mockReturnValueOnce(JSON.stringify({
          events: [{ timestamp: Date.now() - 60000 }]
        }));

      const result = await awsHealthService.checkLambdaHealth();

      expect(result.status).toBe('healthy');
      expect(result.functionActive).toBe(true);
      expect(result.recentExecutions).toBe(true);
      expect(result.details?.functionName).toBe('chiphi-email-processor');
    });

    it('should return unhealthy status when Lambda function is not active', async () => {
      mockExecSync.mockReturnValueOnce(JSON.stringify({
        Configuration: {
          State: 'Inactive',
          Runtime: 'nodejs20.x'
        }
      }));

      const result = await awsHealthService.checkLambdaHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.functionActive).toBe(false);
      expect(result.details?.state).toBe('Inactive');
    });
  });

  describe('checkAWSHealth', () => {
    it('should return comprehensive health status', async () => {
      // Mock all successful checks
      mockExecSync
        // SES checks
        .mockReturnValueOnce(JSON.stringify({ Rule: { Enabled: true } }))
        .mockReturnValueOnce(JSON.stringify({
          VerificationAttributes: {
            'chiphi.oronculzac.com': { VerificationStatus: 'Success' }
          }
        }))
        // S3 checks
        .mockReturnValueOnce('')
        .mockReturnValueOnce(JSON.stringify({
          Policy: JSON.stringify({
            Statement: [{
              Principal: { Service: 'ses.amazonaws.com' },
              Action: 's3:PutObject'
            }]
          })
        }))
        .mockReturnValueOnce('2024-01-15 10:30:00 test-email.txt')
        // Lambda checks
        .mockReturnValueOnce(JSON.stringify({
          Configuration: { State: 'Active', Runtime: 'nodejs20.x' }
        }))
        .mockReturnValueOnce(JSON.stringify({
          events: [{ timestamp: Date.now() - 60000 }]
        }));

      const result = await awsHealthService.checkAWSHealth();

      expect(result.ses_receive).toBe(true);
      expect(result.s3).toBe(true);
      expect(result.lambda).toBe(true);
      expect(result.details.ses.status).toBe('healthy');
      expect(result.details.s3.status).toBe('healthy');
      expect(result.details.lambda.status).toBe('healthy');
    });

    it('should handle timeout gracefully', async () => {
      // Mock a slow response that will timeout
      mockExecSync.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 15000));
      });

      const result = await awsHealthService.checkAWSHealth(1000); // 1 second timeout

      expect(result.ses_receive).toBe(false);
      expect(result.s3).toBe(false);
      expect(result.lambda).toBe(false);
      expect(result.details.ses.error).toContain('timeout');
    });
  });
});