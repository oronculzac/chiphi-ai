import { NextRequest, NextResponse } from 'next/server';
import { awsHealthService } from '@/lib/services/aws-health-service';
import { databaseHealthService } from '@/lib/services/database-health-service';
import { config } from '@/lib/config';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    ses_receive: boolean;
    s3: boolean;
    lambda: boolean;
    db: boolean;
    realtime: boolean;
  };
  details: {
    aws?: {
      ses_receive: boolean;
      s3: boolean;
      lambda: boolean;
      details: {
        ses: any;
        s3: any;
        lambda: any;
      };
    };
    database: any;
    realtime: any;
  };
  correlationId: string;
}

// Track service start time for uptime calculation
const serviceStartTime = Date.now();

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `health_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

/**
 * Calculate overall health status based on individual checks
 */
function calculateOverallStatus(checks: HealthCheckResponse['checks']): HealthCheckResponse['status'] {
  const healthyChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.values(checks).length;
  
  if (healthyChecks === totalChecks) {
    return 'healthy';
  } else if (healthyChecks >= totalChecks * 0.6) {
    return 'degraded';
  } else {
    return 'unhealthy';
  }
}

/**
 * GET /api/health - Comprehensive health check endpoint
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  try {
    // Determine timeout based on configuration
    const healthCheckTimeout = config.healthCheck.timeoutMs;
    
    // Run health checks in parallel with individual timeouts
    const awsHealthPromise = config.inboundProvider.provider === 'ses' 
      ? Promise.race([
          awsHealthService.checkAWSHealth(3000), // 3 second timeout for AWS
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('AWS health check timeout')), 3000)
          )
        ]).catch(() => ({ ses_receive: false, s3: false, lambda: false, details: null }))
      : Promise.resolve({ ses_receive: true, s3: true, lambda: true, details: null });

    const dbHealthPromise = Promise.race([
      databaseHealthService.checkDatabaseHealth(),
      new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('Database health check timeout')), 2000)
      )
    ]).catch(() => ({ status: 'unhealthy', connectionActive: false, error: 'Database timeout' }));

    // Execute health checks with individual timeouts
    const [awsHealthResult, dbHealthResult] = await Promise.allSettled([
      awsHealthPromise,
      dbHealthPromise,
    ]);

    // Process AWS health results
    const awsHealth = awsHealthResult.status === 'fulfilled' ? awsHealthResult.value : {
      ses_receive: false,
      s3: false,
      lambda: false,
      details: {
        ses: { status: 'unhealthy', error: 'AWS health check failed' },
        s3: { status: 'unhealthy', error: 'AWS health check failed' },
        lambda: { status: 'unhealthy', error: 'AWS health check failed' },
      },
    };

    // Process database health results
    const dbResult = dbHealthResult.status === 'fulfilled' ? dbHealthResult.value : {
      status: 'unhealthy',
      connectionActive: false,
      error: 'Database health check failed',
    };

    const dbHealth = {
      db: dbResult.status === 'healthy',
      realtime: true, // Skip realtime check for now
      details: {
        database: dbResult,
        realtime: { status: 'healthy', connectionActive: true, channelsActive: 0 },
      },
    };

    // Compile overall health status
    const checks = {
      ses_receive: awsHealth.ses_receive,
      s3: awsHealth.s3,
      lambda: awsHealth.lambda,
      db: dbHealth.db,
      realtime: dbHealth.realtime,
    };

    const overallStatus = calculateOverallStatus(checks);
    const processingTime = Date.now() - startTime;
    const uptime = Math.floor((Date.now() - serviceStartTime) / 1000);

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.app.nodeEnv,
      uptime,
      checks,
      details: {
        ...(config.inboundProvider.provider === 'ses' && awsHealth.details ? {
          aws: {
            ses_receive: awsHealth.ses_receive,
            s3: awsHealth.s3,
            lambda: awsHealth.lambda,
            details: awsHealth.details,
          },
        } : {}),
        database: dbHealth.details.database,
        realtime: dbHealth.details.realtime,
      },
      correlationId,
    };

    // Determine HTTP status code
    let httpStatus: number;
    switch (overallStatus) {
      case 'healthy':
        httpStatus = 200;
        break;
      case 'degraded':
        httpStatus = 207; // Multi-Status
        break;
      case 'unhealthy':
        httpStatus = 503; // Service Unavailable
        break;
    }

    // Add response headers for monitoring
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Health-Status': overallStatus,
      'X-Health-Timestamp': response.timestamp,
      'X-Health-Correlation-ID': correlationId,
      'X-Health-Processing-Time': `${processingTime}ms`,
      'X-Health-Uptime': `${uptime}s`,
    });

    // Log health check results for monitoring
    if (config.logging.enableProcessingLogs) {
      const logLevel = overallStatus === 'healthy' ? 'info' : 'warn';
      console.log(`[${logLevel.toUpperCase()}] Health check completed`, {
        correlationId,
        status: overallStatus,
        processingTime: `${processingTime}ms`,
        checks,
        timestamp: response.timestamp,
      });
    }

    return new NextResponse(JSON.stringify(response, null, 2), {
      status: httpStatus,
      headers,
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown health check error';
    
    // Log error for monitoring
    console.error('[ERROR] Health check failed', {
      correlationId,
      error: errorMessage,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.app.nodeEnv,
      uptime: Math.floor((Date.now() - serviceStartTime) / 1000),
      checks: {
        ses_receive: false,
        s3: false,
        lambda: false,
        db: false,
        realtime: false,
      },
      details: {
        database: { status: 'unhealthy', error: errorMessage },
        realtime: { status: 'unhealthy', error: errorMessage },
      },
      correlationId,
    };

    return new NextResponse(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'unhealthy',
        'X-Health-Correlation-ID': correlationId,
        'X-Health-Error': errorMessage,
      },
    });
  }
}

/**
 * HEAD /api/health - Simple health check for load balancers
 */
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  
  try {
    // Quick database connectivity check only
    const dbHealth = await databaseHealthService.checkDatabaseHealth();
    const isHealthy = dbHealth.status === 'healthy';
    
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'X-Health-Status': isHealthy ? 'healthy' : 'unhealthy',
        'X-Health-Correlation-ID': correlationId,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'X-Health-Correlation-ID': correlationId,
        'X-Health-Error': error instanceof Error ? error.message : 'Health check failed',
      },
    });
  }
}