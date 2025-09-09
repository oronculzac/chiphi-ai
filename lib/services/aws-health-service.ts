import { execSync } from 'child_process';
import { config } from '@/lib/config';

export interface SESHealthStatus {
  status: 'healthy' | 'unhealthy';
  receiptRuleActive: boolean;
  domainVerified: boolean;
  error?: string;
  details?: {
    ruleSetName?: string;
    ruleName?: string;
    domainStatus?: string;
  };
}

export interface S3HealthStatus {
  status: 'healthy' | 'unhealthy';
  bucketAccessible: boolean;
  permissionsValid: boolean;
  error?: string;
  details?: {
    bucketName?: string;
    region?: string;
    lastModified?: string;
  };
}

export interface LambdaHealthStatus {
  status: 'healthy' | 'unhealthy';
  functionActive: boolean;
  recentExecutions: boolean;
  error?: string;
  details?: {
    functionName?: string;
    lastInvocation?: string;
    state?: string;
    runtime?: string;
  };
}

export interface AWSHealthStatus {
  ses_receive: boolean;
  s3: boolean;
  lambda: boolean;
  details: {
    ses: SESHealthStatus;
    s3: S3HealthStatus;
    lambda: LambdaHealthStatus;
  };
}

class AWSHealthService {
  private readonly region = 'ap-southeast-1';
  private readonly ruleSetName = 'SESReceiptRuleSet';
  private readonly ruleName = 'chiphi-inbound-rule';
  private readonly bucketName = 'chiphi-raw-emails';
  private readonly lambdaFunctionName = 'chiphi-email-processor';
  private readonly domain = 'chiphi.oronculzac.com';

  /**
   * Execute AWS CLI command with timeout and error handling
   */
  private async executeAWSCommand(command: string, timeoutMs: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`AWS CLI command timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = execSync(command, {
          encoding: 'utf8',
          timeout: timeoutMs,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        clearTimeout(timeout);
        resolve(result.trim());
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Check SES receipt rule configuration and domain verification
   */
  async checkSESHealth(): Promise<SESHealthStatus> {
    try {
      // Check receipt rule status
      const ruleCommand = `aws ses describe-receipt-rule --rule-set-name ${this.ruleSetName} --rule-name ${this.ruleName} --region ${this.region}`;
      const ruleResult = await this.executeAWSCommand(ruleCommand);
      const ruleData = JSON.parse(ruleResult);
      
      const receiptRuleActive = ruleData.Rule?.Enabled === true;

      // Check domain verification status
      const domainCommand = `aws ses get-identity-verification-attributes --identities ${this.domain} --region ${this.region}`;
      const domainResult = await this.executeAWSCommand(domainCommand);
      const domainData = JSON.parse(domainResult);
      
      const domainVerified = domainData.VerificationAttributes?.[this.domain]?.VerificationStatus === 'Success';

      const isHealthy = receiptRuleActive && domainVerified;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        receiptRuleActive,
        domainVerified,
        details: {
          ruleSetName: this.ruleSetName,
          ruleName: this.ruleName,
          domainStatus: domainData.VerificationAttributes?.[this.domain]?.VerificationStatus,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        receiptRuleActive: false,
        domainVerified: false,
        error: error instanceof Error ? error.message : 'Unknown SES health check error',
      };
    }
  }

  /**
   * Check S3 bucket accessibility and permissions
   */
  async checkS3Health(): Promise<S3HealthStatus> {
    try {
      // Check bucket accessibility
      const bucketCommand = `aws s3api head-bucket --bucket ${this.bucketName} --region ${this.region}`;
      await this.executeAWSCommand(bucketCommand);

      // Check bucket policy (verify SES can write)
      const policyCommand = `aws s3api get-bucket-policy --bucket ${this.bucketName} --region ${this.region}`;
      const policyResult = await this.executeAWSCommand(policyCommand);
      const policyData = JSON.parse(policyResult);
      
      // Verify policy allows SES access
      const policy = JSON.parse(policyData.Policy);
      const sesStatements = policy.Statement?.filter((stmt: any) => 
        stmt.Principal?.Service === 'ses.amazonaws.com' && 
        stmt.Action === 's3:PutObject'
      );
      const permissionsValid = sesStatements && sesStatements.length > 0;

      // Get recent objects to verify activity
      const listCommand = `aws s3 ls s3://${this.bucketName}/inbound/ --recursive --human-readable | tail -1`;
      let lastModified: string | undefined;
      try {
        const listResult = await this.executeAWSCommand(listCommand);
        const parts = listResult.split(/\s+/);
        if (parts.length >= 2) {
          lastModified = `${parts[0]} ${parts[1]}`;
        }
      } catch {
        // Ignore list errors - bucket might be empty
      }

      return {
        status: permissionsValid ? 'healthy' : 'unhealthy',
        bucketAccessible: true,
        permissionsValid,
        details: {
          bucketName: this.bucketName,
          region: this.region,
          lastModified,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        bucketAccessible: false,
        permissionsValid: false,
        error: error instanceof Error ? error.message : 'Unknown S3 health check error',
      };
    }
  }

  /**
   * Check Lambda function status and recent execution logs
   */
  async checkLambdaHealth(): Promise<LambdaHealthStatus> {
    try {
      // Check Lambda function configuration
      const functionCommand = `aws lambda get-function --function-name ${this.lambdaFunctionName} --region ${this.region}`;
      const functionResult = await this.executeAWSCommand(functionCommand);
      const functionData = JSON.parse(functionResult);
      
      const functionActive = functionData.Configuration?.State === 'Active';
      const runtime = functionData.Configuration?.Runtime;

      // Check recent invocations (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const logsCommand = `aws logs filter-log-events --log-group-name /aws/lambda/${this.lambdaFunctionName} --start-time ${Date.now() - 5 * 60 * 1000} --region ${this.region} --limit 1`;
      
      let recentExecutions = false;
      let lastInvocation: string | undefined;
      
      try {
        const logsResult = await this.executeAWSCommand(logsCommand);
        const logsData = JSON.parse(logsResult);
        recentExecutions = logsData.events && logsData.events.length > 0;
        
        if (logsData.events && logsData.events.length > 0) {
          lastInvocation = new Date(logsData.events[0].timestamp).toISOString();
        }
      } catch {
        // Recent executions check is optional - function might not have been invoked recently
      }

      return {
        status: functionActive ? 'healthy' : 'unhealthy',
        functionActive,
        recentExecutions,
        details: {
          functionName: this.lambdaFunctionName,
          lastInvocation,
          state: functionData.Configuration?.State,
          runtime,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        functionActive: false,
        recentExecutions: false,
        error: error instanceof Error ? error.message : 'Unknown Lambda health check error',
      };
    }
  }

  /**
   * Perform comprehensive AWS infrastructure health check with timeout
   */
  async checkAWSHealth(timeoutMs: number = 10000): Promise<AWSHealthStatus> {
    const healthCheckPromise = Promise.allSettled([
      this.checkSESHealth(),
      this.checkS3Health(),
      this.checkLambdaHealth(),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`AWS health check timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const [sesHealth, s3Health, lambdaHealth] = await Promise.race([
        healthCheckPromise,
        timeoutPromise,
      ]);

      const sesResult = sesHealth.status === 'fulfilled' ? sesHealth.value : {
        status: 'unhealthy' as const,
        receiptRuleActive: false,
        domainVerified: false,
        error: sesHealth.status === 'rejected' ? 
          `SES health check failed: ${sesHealth.reason?.message || 'Unknown error'}` : 
          'SES health check failed',
      };

      const s3Result = s3Health.status === 'fulfilled' ? s3Health.value : {
        status: 'unhealthy' as const,
        bucketAccessible: false,
        permissionsValid: false,
        error: s3Health.status === 'rejected' ? 
          `S3 health check failed: ${s3Health.reason?.message || 'Unknown error'}` : 
          'S3 health check failed',
      };

      const lambdaResult = lambdaHealth.status === 'fulfilled' ? lambdaHealth.value : {
        status: 'unhealthy' as const,
        functionActive: false,
        recentExecutions: false,
        error: lambdaHealth.status === 'rejected' ? 
          `Lambda health check failed: ${lambdaHealth.reason?.message || 'Unknown error'}` : 
          'Lambda health check failed',
      };

      return {
        ses_receive: sesResult.status === 'healthy',
        s3: s3Result.status === 'healthy',
        lambda: lambdaResult.status === 'healthy',
        details: {
          ses: sesResult,
          s3: s3Result,
          lambda: lambdaResult,
        },
      };
    } catch (error) {
      // Handle timeout or other errors
      const errorMessage = error instanceof Error ? error.message : 'AWS health check failed';
      
      return {
        ses_receive: false,
        s3: false,
        lambda: false,
        details: {
          ses: {
            status: 'unhealthy',
            receiptRuleActive: false,
            domainVerified: false,
            error: errorMessage,
          },
          s3: {
            status: 'unhealthy',
            bucketAccessible: false,
            permissionsValid: false,
            error: errorMessage,
          },
          lambda: {
            status: 'unhealthy',
            functionActive: false,
            recentExecutions: false,
            error: errorMessage,
          },
        },
      };
    }
  }

  /**
   * Check if AWS CLI is available and configured
   */
  async checkAWSCLIAvailability(): Promise<boolean> {
    try {
      await this.executeAWSCommand('aws --version', 2000);
      return true;
    } catch (error) {
      console.warn('AWS CLI not available or not configured:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
}

export const awsHealthService = new AWSHealthService();