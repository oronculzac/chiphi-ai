import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth, dbPool } from '@/lib/database/connection-pool';
import { config } from '@/lib/config';

// Health check response interface
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency: number;
      error?: string;
    };
    memory: {
      status: 'healthy' | 'unhealthy';
      usage: {
        used: number;
        total: number;
        percentage: number;
      };
    };
    connections: {
      status: 'healthy' | 'unhealthy';
      active: number;
      max: number;
      percentage: number;
    };
  };
  uptime: number;
}

// Memory usage check
function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const percentage = (usedMemory / totalMemory) * 100;
  
  return {
    status: percentage > 90 ? 'unhealthy' as const : 'healthy' as const,
    usage: {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round(percentage * 100) / 100,
    },
  };
}

// Connection pool check
function getConnectionStatus() {
  const stats = dbPool.getConnectionStats();
  const percentage = (stats.activeConnections / stats.maxConnections) * 100;
  
  return {
    status: percentage > 90 ? 'unhealthy' as const : 'healthy' as const,
    active: stats.activeConnections,
    max: stats.maxConnections,
    percentage: Math.round(percentage * 100) / 100,
  };
}

// Process start time for uptime calculation
const startTime = Date.now();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const healthCheckStart = Date.now();
  
  try {
    // Timeout for health check
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), config.healthCheck.timeoutMs);
    });
    
    // Perform health checks
    const healthCheckPromise = async (): Promise<HealthCheckResponse> => {
      const [dbHealth, memoryStatus, connectionStatus] = await Promise.all([
        checkDatabaseHealth(),
        Promise.resolve(getMemoryUsage()),
        Promise.resolve(getConnectionStatus()),
      ]);
      
      // Determine overall status
      const allChecks = [dbHealth.healthy, memoryStatus.status === 'healthy', connectionStatus.status === 'healthy'];
      const healthyCount = allChecks.filter(Boolean).length;
      
      let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
      if (healthyCount === allChecks.length) {
        overallStatus = 'healthy';
      } else if (healthyCount === 0) {
        overallStatus = 'unhealthy';
      } else {
        overallStatus = 'degraded';
      }
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.app.nodeEnv,
        checks: {
          database: {
            status: dbHealth.healthy ? 'healthy' : 'unhealthy',
            latency: dbHealth.latency,
            error: dbHealth.error,
          },
          memory: memoryStatus,
          connections: connectionStatus,
        },
        uptime: Date.now() - startTime,
      };
    };
    
    const result = await Promise.race([healthCheckPromise(), timeoutPromise]);
    
    // Set appropriate HTTP status code
    const httpStatus = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 207 : 503;
    
    return NextResponse.json(result, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
  } catch (error) {
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.app.nodeEnv,
      checks: {
        database: {
          status: 'unhealthy',
          latency: Date.now() - healthCheckStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        memory: {
          status: 'unhealthy',
          usage: { used: 0, total: 0, percentage: 0 },
        },
        connections: {
          status: 'unhealthy',
          active: 0,
          max: 0,
          percentage: 0,
        },
      },
      uptime: Date.now() - startTime,
    };
    
    return NextResponse.json(errorResponse, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}

// HEAD request for simple health check
export async function HEAD(): Promise<NextResponse> {
  try {
    const dbHealth = await checkDatabaseHealth();
    return new NextResponse(null, { 
      status: dbHealth.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}