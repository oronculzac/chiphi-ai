import { createServiceClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy';
  connectionActive: boolean;
  poolStatus?: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  };
  queryPerformance?: {
    averageResponseTime: number;
    slowQueries: number;
  };
  error?: string;
  details?: {
    version?: string;
    uptime?: string;
    lastQuery?: string;
  };
}

export interface RealtimeHealthStatus {
  status: 'healthy' | 'unhealthy';
  connectionActive: boolean;
  channelsActive: number;
  error?: string;
  details?: {
    endpoint?: string;
    lastHeartbeat?: string;
    subscriptions?: number;
  };
}

class DatabaseHealthService {
  private readonly queryTimeout = 5000; // 5 seconds

  /**
   * Check database connection and basic query performance
   */
  async checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
    try {
      const supabase = createServiceClient();
      const startTime = Date.now();

      // Test basic connectivity with a simple query
      const { data: healthData, error: healthError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();

      const queryTime = Date.now() - startTime;

      if (healthError && healthError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine for health check
        throw new Error(`Database query failed: ${healthError.message}`);
      }

      // Get database version and stats
      const { data: versionData } = await supabase.rpc('version' as any);
      
      // Check for slow queries (simplified check)
      const slowQueryThreshold = config.performance.slowQueryThreshold;
      const slowQueries = queryTime > slowQueryThreshold ? 1 : 0;

      // Get connection pool information (if available)
      let poolStatus;
      try {
        const { data: poolData } = await supabase.rpc('pg_stat_activity' as any);
        if (poolData) {
          poolStatus = {
            activeConnections: Array.isArray(poolData) ? poolData.length : 0,
            idleConnections: 0, // Would need more complex query
            totalConnections: config.database.maxConnections,
          };
        }
      } catch {
        // Pool status is optional
      }

      return {
        status: 'healthy',
        connectionActive: true,
        poolStatus,
        queryPerformance: {
          averageResponseTime: queryTime,
          slowQueries,
        },
        details: {
          version: typeof versionData === 'string' ? versionData : 'Unknown',
          uptime: 'Available', // Would need specific query for actual uptime
          lastQuery: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connectionActive: false,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check Supabase realtime connection status
   */
  async checkRealtimeHealth(): Promise<RealtimeHealthStatus> {
    try {
      const supabase = createServiceClient();
      
      // Test realtime connection by attempting to create a channel
      const channel = supabase.channel('health-check', {
        config: {
          presence: { key: 'health-check' },
        },
      });

      return new Promise<RealtimeHealthStatus>((resolve) => {
        const timeout = setTimeout(() => {
          channel.unsubscribe();
          resolve({
            status: 'unhealthy',
            connectionActive: false,
            channelsActive: 0,
            error: 'Realtime connection timeout',
          });
        }, 3000);

        channel
          .on('presence', { event: 'sync' }, () => {
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve({
              status: 'healthy',
              connectionActive: true,
              channelsActive: 1,
              details: {
                endpoint: config.supabase.url.replace('https://', 'wss://') + '/realtime/v1/websocket',
                lastHeartbeat: new Date().toISOString(),
                subscriptions: 1,
              },
            });
          })
          .on('presence', { event: 'join' }, () => {
            // Connection established
          })
          .on('presence', { event: 'leave' }, () => {
            // Connection lost
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              // Successfully subscribed, connection is healthy
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({
                status: 'healthy',
                connectionActive: true,
                channelsActive: 1,
                details: {
                  endpoint: config.supabase.url.replace('https://', 'wss://') + '/realtime/v1/websocket',
                  lastHeartbeat: new Date().toISOString(),
                  subscriptions: 1,
                },
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({
                status: 'unhealthy',
                connectionActive: false,
                channelsActive: 0,
                error: `Realtime connection failed with status: ${status}`,
              });
            }
          });
      });
    } catch (error) {
      return {
        status: 'unhealthy',
        connectionActive: false,
        channelsActive: 0,
        error: error instanceof Error ? error.message : 'Unknown realtime error',
      };
    }
  }

  /**
   * Perform comprehensive database and realtime health check
   */
  async checkDatabaseAndRealtimeHealth(timeoutMs: number = 8000) {
    const healthCheckPromise = Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkRealtimeHealth(),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Database health check timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const [dbHealth, realtimeHealth] = await Promise.race([
        healthCheckPromise,
        timeoutPromise,
      ]);

      const dbResult = dbHealth.status === 'fulfilled' ? dbHealth.value : {
        status: 'unhealthy' as const,
        connectionActive: false,
        error: dbHealth.status === 'rejected' ? 
          `Database health check failed: ${dbHealth.reason?.message || 'Unknown error'}` : 
          'Database health check failed',
      };

      const realtimeResult = realtimeHealth.status === 'fulfilled' ? realtimeHealth.value : {
        status: 'unhealthy' as const,
        connectionActive: false,
        channelsActive: 0,
        error: realtimeHealth.status === 'rejected' ? 
          `Realtime health check failed: ${realtimeHealth.reason?.message || 'Unknown error'}` : 
          'Realtime health check failed',
      };

      return {
        db: dbResult.status === 'healthy',
        realtime: realtimeResult.status === 'healthy',
        details: {
          database: dbResult,
          realtime: realtimeResult,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database health check failed';
      
      return {
        db: false,
        realtime: false,
        details: {
          database: {
            status: 'unhealthy' as const,
            connectionActive: false,
            error: errorMessage,
          },
          realtime: {
            status: 'unhealthy' as const,
            connectionActive: false,
            channelsActive: 0,
            error: errorMessage,
          },
        },
      };
    }
  }
}

export const databaseHealthService = new DatabaseHealthService();