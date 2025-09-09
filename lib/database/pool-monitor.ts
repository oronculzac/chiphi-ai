import { dbPool, type ConnectionPoolMetrics, type PoolAlert } from './connection-pool';
import { config } from '@/lib/config';

// Pool monitoring service for alerts and logging
export class ConnectionPoolMonitor {
  private static instance: ConnectionPoolMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(alert: PoolAlert) => void> = [];
  private metricsHistory: Array<{ timestamp: Date; metrics: ConnectionPoolMetrics }> = [];
  private lastAlertCheck = Date.now();

  private constructor() {}

  static getInstance(): ConnectionPoolMonitor {
    if (!ConnectionPoolMonitor.instance) {
      ConnectionPoolMonitor.instance = new ConnectionPoolMonitor();
    }
    return ConnectionPoolMonitor.instance;
  }

  // Start monitoring with configurable interval
  startMonitoring(intervalMs: number = config.healthCheck.intervalMs): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.checkPoolHealth();
    }, intervalMs);

    console.info(`Connection pool monitoring started with ${intervalMs}ms interval`);
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.info('Connection pool monitoring stopped');
    }
  }

  // Register callback for alert notifications
  onAlert(callback: (alert: PoolAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  // Remove alert callback
  removeAlertCallback(callback: (alert: PoolAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  // Get metrics history for trend analysis
  getMetricsHistory(hours: number = 1): Array<{ timestamp: Date; metrics: ConnectionPoolMetrics }> {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.metricsHistory.filter(entry => entry.timestamp >= cutoff);
  }

  // Get current pool status with trend analysis
  getPoolStatus(): {
    current: ConnectionPoolMetrics;
    trends: {
      utilizationTrend: 'increasing' | 'decreasing' | 'stable';
      errorTrend: 'increasing' | 'decreasing' | 'stable';
      connectionTimeTrend: 'increasing' | 'decreasing' | 'stable';
    };
    recommendations: string[];
  } {
    const current = dbPool.getConnectionStats();
    const trends = this.analyzeTrends();
    const recommendations = this.generateRecommendations(current, trends);

    return {
      current,
      trends,
      recommendations,
    };
  }

  // Check pool health and trigger alerts
  private checkPoolHealth(): void {
    const metrics = dbPool.getConnectionStats();
    
    // Store metrics for history
    this.metricsHistory.push({
      timestamp: new Date(),
      metrics,
    });

    // Keep only last 24 hours of metrics
    const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
    this.metricsHistory = this.metricsHistory.filter(entry => entry.timestamp >= cutoff);

    // Check for new alerts
    const newAlerts = metrics.alerts.filter(alert => 
      alert.timestamp.getTime() > this.lastAlertCheck
    );

    // Notify callbacks of new alerts
    newAlerts.forEach(alert => {
      this.alertCallbacks.forEach(callback => {
        try {
          callback(alert);
        } catch (error) {
          console.error('Error in alert callback:', error);
        }
      });
    });

    this.lastAlertCheck = Date.now();

    // Log critical metrics
    if (metrics.healthStatus === 'critical') {
      console.error('[Pool Monitor] Critical pool status:', {
        utilization: metrics.poolUtilization,
        errors: metrics.connectionErrors,
        activeAlerts: metrics.alerts.length,
      });
    } else if (metrics.healthStatus === 'warning') {
      console.warn('[Pool Monitor] Pool warning status:', {
        utilization: metrics.poolUtilization,
        errors: metrics.connectionErrors,
      });
    }
  }

  // Analyze trends from metrics history
  private analyzeTrends(): {
    utilizationTrend: 'increasing' | 'decreasing' | 'stable';
    errorTrend: 'increasing' | 'decreasing' | 'stable';
    connectionTimeTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    const recentMetrics = this.getMetricsHistory(0.5); // Last 30 minutes
    
    if (recentMetrics.length < 2) {
      return {
        utilizationTrend: 'stable',
        errorTrend: 'stable',
        connectionTimeTrend: 'stable',
      };
    }

    const first = recentMetrics[0].metrics;
    const last = recentMetrics[recentMetrics.length - 1].metrics;

    return {
      utilizationTrend: this.getTrend(first.poolUtilization, last.poolUtilization),
      errorTrend: this.getTrend(first.connectionErrors, last.connectionErrors),
      connectionTimeTrend: this.getTrend(first.averageConnectionTime, last.averageConnectionTime),
    };
  }

  private getTrend(oldValue: number, newValue: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.1; // 10% change threshold
    const change = (newValue - oldValue) / (oldValue || 1);
    
    if (change > threshold) return 'increasing';
    if (change < -threshold) return 'decreasing';
    return 'stable';
  }

  private generateRecommendations(
    metrics: ConnectionPoolMetrics,
    trends: ReturnType<ConnectionPoolMonitor['analyzeTrends']>
  ): string[] {
    const recommendations: string[] = [];

    // High utilization recommendations
    if (metrics.poolUtilization > 80) {
      if (trends.utilizationTrend === 'increasing') {
        recommendations.push('Pool utilization is high and increasing - consider scaling up immediately');
      } else {
        recommendations.push('Pool utilization is high - monitor closely and consider increasing max connections');
      }
    }

    // Error trend recommendations
    if (metrics.connectionErrors > 0) {
      if (trends.errorTrend === 'increasing') {
        recommendations.push('Connection errors are increasing - investigate database connectivity issues');
      } else {
        recommendations.push('Connection errors detected - review recent error logs');
      }
    }

    // Connection time recommendations
    if (metrics.averageConnectionTime > 1000) {
      if (trends.connectionTimeTrend === 'increasing') {
        recommendations.push('Connection times are increasing - check database performance and network latency');
      } else {
        recommendations.push('High connection times detected - investigate database performance');
      }
    }

    // Idle connection optimization
    if (metrics.idleConnections > metrics.maxConnections * 0.5) {
      recommendations.push('Many idle connections - consider reducing idle timeout or max connections');
    }

    // Alert management
    if (metrics.alerts.length > 3) {
      recommendations.push('Multiple active alerts - review and resolve connection pool issues');
    }

    return recommendations;
  }
}

// Export singleton instance
export const poolMonitor = ConnectionPoolMonitor.getInstance();

// Utility function to set up basic monitoring with console logging
export function setupBasicPoolMonitoring(): void {
  poolMonitor.onAlert((alert) => {
    const logLevel = alert.severity === 'critical' ? 'error' : 
                    alert.severity === 'high' ? 'warn' : 'info';
    
    console[logLevel](`[Pool Alert] ${alert.type}: ${alert.message}`);
  });

  poolMonitor.startMonitoring();
}

// Utility function to get pool health summary
export function getPoolHealthSummary(): {
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  metrics: ConnectionPoolMetrics;
} {
  const metrics = dbPool.getConnectionStats();
  
  let summary: string;
  switch (metrics.healthStatus) {
    case 'healthy':
      summary = `Pool operating normally (${metrics.poolUtilization}% utilization)`;
      break;
    case 'warning':
      summary = `Pool under stress (${metrics.poolUtilization}% utilization, ${metrics.connectionErrors} errors)`;
      break;
    case 'critical':
      summary = `Pool in critical state (${metrics.poolUtilization}% utilization, ${metrics.connectionErrors} errors, ${metrics.alerts.length} alerts)`;
      break;
  }

  return {
    status: metrics.healthStatus,
    summary,
    metrics,
  };
}