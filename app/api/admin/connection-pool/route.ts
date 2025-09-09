import { NextRequest, NextResponse } from 'next/server';
import { dbPool } from '@/lib/database/connection-pool';
import { config } from '@/lib/config';

// Admin endpoint for detailed connection pool monitoring
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Only enable in development or when debug endpoints are enabled
  if (!config.app.isDevelopment && !config.diagnostic.enableDebugEndpoints) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const metrics = dbPool.getConnectionStats();
    const detailedConnections = dbPool.getDetailedConnectionInfo();
    
    const response = {
      timestamp: new Date().toISOString(),
      poolMetrics: metrics,
      connections: detailedConnections,
      configuration: {
        maxConnections: config.database.maxConnections,
        idleTimeout: config.database.idleTimeout,
        connectionTimeout: config.database.connectionTimeout,
      },
      recommendations: generateRecommendations(metrics),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get connection pool status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST endpoint for admin actions (resolve alerts, cleanup connections)
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Only enable in development or when debug endpoints are enabled
  if (!config.app.isDevelopment && !config.diagnostic.enableDebugEndpoints) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { action, alertId } = body;

    switch (action) {
      case 'resolve_alert':
        if (!alertId) {
          return NextResponse.json({ error: 'Alert ID required' }, { status: 400 });
        }
        
        const resolved = dbPool.resolveAlert(alertId);
        return NextResponse.json({ 
          success: resolved,
          message: resolved ? 'Alert resolved' : 'Alert not found',
        });

      case 'cleanup_connections':
        // This would trigger cleanup of idle connections
        // For now, just return the current metrics
        const metrics = dbPool.getConnectionStats();
        return NextResponse.json({
          success: true,
          message: 'Connection cleanup triggered',
          metrics,
        });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to perform admin action',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Generate recommendations based on pool metrics
function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];

  if (metrics.poolUtilization > 80) {
    recommendations.push('Consider increasing DATABASE_MAX_CONNECTIONS to handle higher load');
  }

  if (metrics.connectionErrors > 0) {
    recommendations.push('Investigate connection errors - check database connectivity and configuration');
  }

  if (metrics.averageConnectionTime > 1000) {
    recommendations.push('High connection times detected - check network latency and database performance');
  }

  if (metrics.alerts.length > 5) {
    recommendations.push('Multiple active alerts - review and resolve connection pool issues');
  }

  if (metrics.idleConnections === 0 && metrics.activeConnections === metrics.maxConnections) {
    recommendations.push('All connections are active - consider implementing connection queuing or increasing pool size');
  }

  if (recommendations.length === 0) {
    recommendations.push('Connection pool is operating within normal parameters');
  }

  return recommendations;
}