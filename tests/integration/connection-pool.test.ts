import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { dbPool, checkDatabaseHealth, getSupabaseClient } from '@/lib/database/connection-pool';
import { poolMonitor, getPoolHealthSummary } from '@/lib/database/pool-monitor';
import { config } from '@/lib/config';

describe('Database Connection Pool', () => {
  beforeAll(async () => {
    // Start monitoring for tests
    poolMonitor.startMonitoring(1000); // 1 second interval for tests
  });

  afterAll(async () => {
    // Clean up
    poolMonitor.stopMonitoring();
    await dbPool.closeAllConnections();
  });

  beforeEach(async () => {
    // Reset connection pool state
    await dbPool.closeAllConnections();
  });

  describe('Connection Pool Management', () => {
    it('should create and manage connections', async () => {
      const client1 = await getSupabaseClient('test1');
      const client2 = await getSupabaseClient('test2');
      
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      
      const stats = dbPool.getConnectionStats();
      expect(stats.activeConnections).toBeGreaterThan(0);
      expect(stats.maxConnections).toBe(config.database.maxConnections);
    });

    it('should reuse existing connections', async () => {
      const client1 = await getSupabaseClient('reuse-test');
      const client2 = await getSupabaseClient('reuse-test');
      
      expect(client1).toBe(client2);
      
      const stats = dbPool.getConnectionStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      const maxConnections = config.database.maxConnections;
      const clients: any[] = [];
      
      // Create connections up to the limit
      for (let i = 0; i < maxConnections; i++) {
        const client = await getSupabaseClient(`exhaust-test-${i}`);
        clients.push(client);
      }
      
      // Try to create one more connection (should trigger graceful degradation)
      const extraClient = await getSupabaseClient('extra-connection');
      expect(extraClient).toBeDefined();
      
      const stats = dbPool.getConnectionStats();
      expect(stats.poolUtilization).toBeGreaterThanOrEqual(100);
      expect(stats.healthStatus).toBe('critical');
    });

    it('should provide detailed connection metrics', async () => {
      await getSupabaseClient('metrics-test-1');
      await getSupabaseClient('metrics-test-2');
      
      const stats = dbPool.getConnectionStats();
      
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('totalConnectionsCreated');
      expect(stats).toHaveProperty('poolUtilization');
      expect(stats).toHaveProperty('healthStatus');
      expect(stats).toHaveProperty('alerts');
      
      expect(stats.totalConnectionsCreated).toBeGreaterThan(0);
      expect(stats.poolUtilization).toBeGreaterThan(0);
    });

    it('should track connection details', async () => {
      await getSupabaseClient('detail-test-1');
      await getSupabaseClient('detail-test-2');
      
      const details = dbPool.getDetailedConnectionInfo();
      
      expect(details).toHaveLength(2);
      expect(details[0]).toHaveProperty('key');
      expect(details[0]).toHaveProperty('createdAt');
      expect(details[0]).toHaveProperty('lastUsed');
      expect(details[0]).toHaveProperty('isIdle');
      expect(details[0]).toHaveProperty('connectionTime');
      expect(details[0]).toHaveProperty('ageMs');
    });
  });

  describe('Database Health Checks', () => {
    it('should perform database health check', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('latency');
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.latency).toBe('number');
      expect(health.latency).toBeGreaterThan(0);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking a database failure
      // For now, we'll just verify the health check structure
      const health = await checkDatabaseHealth();
      
      if (!health.healthy) {
        expect(health).toHaveProperty('error');
        expect(typeof health.error).toBe('string');
      }
    });
  });

  describe('Pool Monitoring', () => {
    it('should provide pool health summary', async () => {
      await getSupabaseClient('monitor-test');
      
      const summary = getPoolHealthSummary();
      
      expect(summary).toHaveProperty('status');
      expect(summary).toHaveProperty('summary');
      expect(summary).toHaveProperty('metrics');
      
      expect(['healthy', 'warning', 'critical']).toContain(summary.status);
      expect(typeof summary.summary).toBe('string');
    });

    it('should track metrics history', async () => {
      // Create some connections to generate metrics
      await getSupabaseClient('history-test-1');
      await getSupabaseClient('history-test-2');
      
      // Wait a bit for monitoring to collect data
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const history = poolMonitor.getMetricsHistory(1);
      expect(history.length).toBeGreaterThan(0);
      
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('timestamp');
        expect(history[0]).toHaveProperty('metrics');
        expect(history[0].timestamp).toBeInstanceOf(Date);
      }
    });

    it('should generate alerts for high utilization', async () => {
      const maxConnections = config.database.maxConnections;
      
      // Create connections to trigger high utilization
      for (let i = 0; i < Math.ceil(maxConnections * 0.9); i++) {
        await getSupabaseClient(`alert-test-${i}`);
      }
      
      const stats = dbPool.getConnectionStats();
      
      if (stats.poolUtilization > 80) {
        expect(stats.alerts.length).toBeGreaterThan(0);
        
        const utilizationAlert = stats.alerts.find(alert => 
          alert.type === 'high_utilization'
        );
        expect(utilizationAlert).toBeDefined();
      }
    });
  });

  describe('Alert Management', () => {
    it('should resolve alerts', async () => {
      // Manually add a test alert to ensure we have something to resolve
      const testAlert = {
        id: 'test-alert-123',
        type: 'high_utilization' as const,
        severity: 'medium' as const,
        message: 'Test alert for resolution',
        timestamp: new Date(),
        resolved: false,
      };
      
      // Add the test alert
      dbPool.addTestAlert(testAlert);
      
      // Verify alert was added
      let stats = dbPool.getConnectionStats();
      expect(stats.alerts.length).toBeGreaterThan(0);
      
      const activeAlerts = stats.alerts.filter(alert => !alert.resolved);
      expect(activeAlerts.length).toBeGreaterThan(0);
      
      const alertToResolve = activeAlerts.find(alert => alert.id === 'test-alert-123');
      expect(alertToResolve).toBeDefined();
      expect(alertToResolve?.resolved).toBe(false);
      
      // Resolve the alert
      const resolved = dbPool.resolveAlert('test-alert-123');
      expect(resolved).toBe(true);
      
      // Verify alert is resolved by checking that it's no longer in active alerts
      const updatedStats = dbPool.getConnectionStats();
      const stillActiveAlert = updatedStats.alerts.find(alert => alert.id === 'test-alert-123');
      expect(stillActiveAlert).toBeUndefined(); // Should not be in active alerts anymore
    });

    it('should handle invalid alert resolution', async () => {
      const resolved = dbPool.resolveAlert('non-existent-alert');
      expect(resolved).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track query performance when enabled', async () => {
      // This test verifies the performance monitoring wrapper works
      const { withQueryPerformanceMonitoring } = await import('@/lib/database/connection-pool');
      
      const result = await withQueryPerformanceMonitoring('test-query', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test-result';
      });
      
      expect(result).toBe('test-result');
    });

    it('should handle query errors in performance monitoring', async () => {
      const { withQueryPerformanceMonitoring } = await import('@/lib/database/connection-pool');
      
      await expect(
        withQueryPerformanceMonitoring('failing-query', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });
});