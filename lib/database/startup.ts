import { setupBasicPoolMonitoring, poolMonitor } from './pool-monitor';
import { config } from '@/lib/config';

// Initialize database connection pool monitoring
export function initializeDatabaseMonitoring(): void {
  // Only start monitoring in production or when explicitly enabled
  if (config.app.isProduction || config.performance.enableMonitoring) {
    setupBasicPoolMonitoring();
    
    console.info('Database connection pool monitoring initialized');
    
    // Set up additional alert handlers for production
    if (config.app.isProduction) {
      poolMonitor.onAlert((alert) => {
        // In production, you might want to send alerts to external monitoring
        // For now, we'll just ensure critical alerts are logged
        if (alert.severity === 'critical') {
          console.error(`[CRITICAL POOL ALERT] ${alert.type}: ${alert.message}`, {
            alertId: alert.id,
            timestamp: alert.timestamp,
          });
          
          // TODO: Integrate with external alerting system (e.g., Sentry, PagerDuty)
          // sendCriticalAlert(alert);
        }
      });
    }
  } else {
    console.info('Database connection pool monitoring disabled (development mode)');
  }
}

// Graceful shutdown handler
export function shutdownDatabaseMonitoring(): void {
  poolMonitor.stopMonitoring();
  console.info('Database connection pool monitoring stopped');
}

// Health check function for startup verification
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    const { checkDatabaseHealth } = await import('./connection-pool');
    const health = await checkDatabaseHealth();
    
    if (health.healthy) {
      console.info(`Database connection verified (${health.latency}ms latency)`);
      return true;
    } else {
      console.error(`Database connection failed: ${health.error}`);
      return false;
    }
  } catch (error) {
    console.error('Database connection verification failed:', error);
    return false;
  }
}

// Initialize monitoring on module load in production
if (typeof window === 'undefined' && config.app.isProduction) {
  // Only auto-initialize in server-side production environment
  initializeDatabaseMonitoring();
}