import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSession } from '@/lib/database/utils';
import { loggingService } from '@/lib/services/logging-service';
import { retryService } from '@/lib/services/retry-service';
import { enhancedEmailProcessor } from '@/lib/services/enhanced-email-processor';

/**
 * Monitoring API Endpoint
 * 
 * Provides comprehensive monitoring data for error handling, logging,
 * and system performance metrics.
 * 
 * Requirements covered:
 * - 10.1: Log all processing steps with timestamps
 * - 10.2: Log usage and costs per organization
 * - 10.3: Log detailed error information for debugging
 * - 10.5: Alert administrators on system performance degradation
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric');
    const hoursBack = parseInt(searchParams.get('hours') || '24');
    const daysBack = parseInt(searchParams.get('days') || '7');

    switch (metric) {
      case 'error_statistics':
        return await getErrorStatistics(session.org.id, hoursBack);
      
      case 'ai_usage_costs':
        return await getAIUsageCosts(session.org.id, daysBack);
      
      case 'system_health':
        return await getSystemHealth();
      
      case 'processing_statistics':
        return await getProcessingStatistics(session.org.id, hoursBack);
      
      case 'retry_statistics':
        return await getRetryStatistics(session.org.id, hoursBack);
      
      case 'circuit_breaker_status':
        return await getCircuitBreakerStatus();
      
      case 'performance_metrics':
        return await getPerformanceMetrics(session.org.id, hoursBack);
      
      default:
        return await getOverallMonitoringData(session.org.id, hoursBack, daysBack);
    }

  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getErrorStatistics(orgId: string, hoursBack: number) {
  try {
    const errorStats = await loggingService.getErrorStatistics(orgId, hoursBack);
    
    return NextResponse.json({
      success: true,
      data: {
        timeRange: `${hoursBack} hours`,
        statistics: errorStats,
        summary: {
          totalErrors: errorStats.reduce((sum, stat) => sum + stat.errorCount, 0),
          averageResolutionRate: errorStats.length > 0 
            ? errorStats.reduce((sum, stat) => sum + stat.resolutionRate, 0) / errorStats.length 
            : 0,
          mostCommonError: errorStats.length > 0 ? errorStats[0].errorType : null,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get error statistics' },
      { status: 500 }
    );
  }
}

async function getAIUsageCosts(orgId: string, daysBack: number) {
  try {
    const costStats = await loggingService.getAIUsageCosts(orgId, daysBack);
    
    const totalCost = costStats.reduce((sum, stat) => sum + stat.totalCostUsd, 0);
    const totalRequests = costStats.reduce((sum, stat) => sum + stat.requestCount, 0);
    const averageSuccessRate = costStats.length > 0 
      ? costStats.reduce((sum, stat) => sum + stat.successRate, 0) / costStats.length 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        timeRange: `${daysBack} days`,
        costBreakdown: costStats,
        summary: {
          totalCostUsd: totalCost,
          totalRequests,
          averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
          averageSuccessRate,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get AI usage costs' },
      { status: 500 }
    );
  }
}

async function getSystemHealth() {
  try {
    const healthSummary = await loggingService.getSystemHealthSummary();
    
    const criticalIssues = healthSummary.filter(metric => metric.status === 'critical');
    const warningIssues = healthSummary.filter(metric => metric.status === 'warning');
    const healthyMetrics = healthSummary.filter(metric => metric.status === 'healthy');

    return NextResponse.json({
      success: true,
      data: {
        overall_status: criticalIssues.length > 0 ? 'critical' : 
                      warningIssues.length > 0 ? 'warning' : 'healthy',
        metrics: healthSummary,
        summary: {
          total_metrics: healthSummary.length,
          critical_issues: criticalIssues.length,
          warning_issues: warningIssues.length,
          healthy_metrics: healthyMetrics.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get system health' },
      { status: 500 }
    );
  }
}

async function getProcessingStatistics(orgId: string, hoursBack: number) {
  try {
    const processingStats = await enhancedEmailProcessor.getProcessingStatistics(orgId, hoursBack);
    
    return NextResponse.json({
      success: true,
      data: {
        timeRange: `${hoursBack} hours`,
        ...processingStats,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get processing statistics' },
      { status: 500 }
    );
  }
}

async function getRetryStatistics(orgId: string, hoursBack: number) {
  try {
    const retryStats = await retryService.getRetryStatistics(orgId, hoursBack);
    
    return NextResponse.json({
      success: true,
      data: {
        timeRange: `${hoursBack} hours`,
        ...retryStats,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get retry statistics' },
      { status: 500 }
    );
  }
}

async function getCircuitBreakerStatus() {
  try {
    const circuitBreakerStatus = retryService.getCircuitBreakerStatus();
    
    const openBreakers = Object.entries(circuitBreakerStatus)
      .filter(([_, status]) => status.state === 'open');
    
    const halfOpenBreakers = Object.entries(circuitBreakerStatus)
      .filter(([_, status]) => status.state === 'half-open');

    return NextResponse.json({
      success: true,
      data: {
        circuit_breakers: circuitBreakerStatus,
        summary: {
          total_breakers: Object.keys(circuitBreakerStatus).length,
          open_breakers: openBreakers.length,
          half_open_breakers: halfOpenBreakers.length,
          healthy_breakers: Object.keys(circuitBreakerStatus).length - openBreakers.length - halfOpenBreakers.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get circuit breaker status' },
      { status: 500 }
    );
  }
}

async function getPerformanceMetrics(orgId: string, hoursBack: number) {
  try {
    const supabase = createClient();
    
    // Get performance metrics from database
    const { data: metrics, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Group metrics by type
    const metricsByType = (metrics || []).reduce((acc, metric) => {
      if (!acc[metric.metric_type]) {
        acc[metric.metric_type] = [];
      }
      acc[metric.metric_type].push(metric);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate averages for each metric type
    const averages = Object.entries(metricsByType).map(([type, typeMetrics]) => ({
      metric_type: type,
      average_value: typeMetrics.reduce((sum, m) => sum + m.metric_value, 0) / typeMetrics.length,
      metric_unit: typeMetrics[0]?.metric_unit || '',
      sample_count: typeMetrics.length,
      min_value: Math.min(...typeMetrics.map(m => m.metric_value)),
      max_value: Math.max(...typeMetrics.map(m => m.metric_value)),
    }));

    return NextResponse.json({
      success: true,
      data: {
        timeRange: `${hoursBack} hours`,
        metrics_by_type: metricsByType,
        averages,
        total_metrics: metrics?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    );
  }
}

async function getOverallMonitoringData(orgId: string, hoursBack: number, daysBack: number) {
  try {
    // Get all monitoring data in parallel
    const [
      errorStats,
      costStats,
      healthSummary,
      processingStats,
      retryStats,
      circuitBreakerStatus,
    ] = await Promise.allSettled([
      loggingService.getErrorStatistics(orgId, hoursBack),
      loggingService.getAIUsageCosts(orgId, daysBack),
      loggingService.getSystemHealthSummary(),
      enhancedEmailProcessor.getProcessingStatistics(orgId, hoursBack),
      retryService.getRetryStatistics(orgId, hoursBack),
      retryService.getCircuitBreakerStatus(),
    ]);

    // Extract successful results
    const data = {
      error_statistics: errorStats.status === 'fulfilled' ? errorStats.value : [],
      ai_usage_costs: costStats.status === 'fulfilled' ? costStats.value : [],
      system_health: healthSummary.status === 'fulfilled' ? healthSummary.value : [],
      processing_statistics: processingStats.status === 'fulfilled' ? processingStats.value : null,
      retry_statistics: retryStats.status === 'fulfilled' ? retryStats.value : null,
      circuit_breaker_status: circuitBreakerStatus.status === 'fulfilled' ? circuitBreakerStatus.value : {},
    };

    // Calculate overall health score
    const healthScore = calculateOverallHealthScore(data);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        overall_health_score: healthScore,
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get overall monitoring data' },
      { status: 500 }
    );
  }
}

function calculateOverallHealthScore(data: any): {
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  factors: Array<{ factor: string; score: number; weight: number }>;
} {
  const factors = [];
  let totalScore = 0;
  let totalWeight = 0;

  // Error rate factor (30% weight)
  const errorRate = data.processing_statistics?.successRate || 100;
  const errorScore = Math.max(0, Math.min(100, errorRate));
  factors.push({ factor: 'error_rate', score: errorScore, weight: 30 });
  totalScore += errorScore * 30;
  totalWeight += 30;

  // System health factor (25% weight)
  const criticalIssues = data.system_health.filter((m: any) => m.status === 'critical').length;
  const warningIssues = data.system_health.filter((m: any) => m.status === 'warning').length;
  const healthScore = criticalIssues > 0 ? 0 : warningIssues > 0 ? 50 : 100;
  factors.push({ factor: 'system_health', score: healthScore, weight: 25 });
  totalScore += healthScore * 25;
  totalWeight += 25;

  // Performance factor (25% weight)
  const avgProcessingTime = data.processing_statistics?.averageProcessingTime || 0;
  const performanceScore = avgProcessingTime > 60000 ? 0 : avgProcessingTime > 30000 ? 50 : 100;
  factors.push({ factor: 'performance', score: performanceScore, weight: 25 });
  totalScore += performanceScore * 25;
  totalWeight += 25;

  // Circuit breaker factor (20% weight)
  const openBreakers = Object.values(data.circuit_breaker_status)
    .filter((status: any) => status.state === 'open').length;
  const circuitScore = openBreakers > 0 ? 0 : 100;
  factors.push({ factor: 'circuit_breakers', score: circuitScore, weight: 20 });
  totalScore += circuitScore * 20;
  totalWeight += 20;

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const status = finalScore >= 80 ? 'healthy' : finalScore >= 60 ? 'warning' : 'critical';

  return {
    score: Math.round(finalScore),
    status,
    factors,
  };
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}