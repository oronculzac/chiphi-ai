import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import type { Database } from '@/lib/types/database';

// Connection pool metrics interface
export interface ConnectionPoolMetrics {
  activeConnections: number;
  maxConnections: number;
  idleConnections: number;
  totalConnectionsCreated: number;
  totalConnectionsDestroyed: number;
  connectionErrors: number;
  averageConnectionTime: number;
  lastConnectionTime: number;
  poolUtilization: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  alerts: PoolAlert[];
}

// Pool alert interface
export interface PoolAlert {
  id: string;
  type: 'connection_exhaustion' | 'high_utilization' | 'connection_errors' | 'slow_connections';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

// Connection wrapper interface
interface PooledConnection {
  client: ReturnType<typeof createOptimizedSupabaseClient>;
  createdAt: Date;
  lastUsed: Date;
  isIdle: boolean;
  connectionTime: number;
}

// Production-optimized Supabase client with connection pooling
export const createOptimizedSupabaseClient = () => {
  const supabaseUrl = config.supabase.url;
  const supabaseKey = config.app.isProduction 
    ? config.supabase.serviceRoleKey 
    : config.supabase.anonKey;

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, // Disable session persistence for server-side
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'chiphi-ai',
      },
    },
    // Connection pooling configuration for production
    ...(config.app.isProduction && {
      realtime: {
        params: {
          eventsPerSecond: 10, // Limit real-time events
        },
      },
    }),
  });
};

// Database connection pool manager with enhanced monitoring
class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private connections: Map<string, PooledConnection> = new Map();
  private readonly maxConnections = config.database.maxConnections;
  private readonly idleTimeout = config.database.idleTimeout;
  private readonly connectionTimeout = config.database.connectionTimeout;
  
  // Metrics tracking
  private totalConnectionsCreated = 0;
  private totalConnectionsDestroyed = 0;
  private connectionErrors = 0;
  private connectionTimes: number[] = [];
  private alerts: PoolAlert[] = [];
  private lastCleanup = Date.now();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start periodic cleanup of idle connections
    this.startCleanupInterval();
  }

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  async getClient(key = 'default'): Promise<ReturnType<typeof createOptimizedSupabaseClient>> {
    const startTime = Date.now();
    
    try {
      // Check for existing connection
      const existingConnection = this.connections.get(key);
      if (existingConnection && !this.isConnectionExpired(existingConnection)) {
        existingConnection.lastUsed = new Date();
        existingConnection.isIdle = false;
        return existingConnection.client;
      }

      // Remove expired connection if exists
      if (existingConnection) {
        await this.removeConnection(key);
      }

      // Check if we can create new connection
      if (this.connections.size >= this.maxConnections) {
        await this.handleConnectionExhaustion();
        
        // Try to reuse an existing connection
        const availableConnection = Array.from(this.connections.values())
          .find(conn => conn.isIdle);
        
        if (availableConnection) {
          availableConnection.lastUsed = new Date();
          availableConnection.isIdle = false;
          return availableConnection.client;
        }
        
        // If still no connection available, implement graceful degradation
        return this.createDegradedClient();
      }

      // Create new connection
      const connectionTime = Date.now() - startTime;
      const client = createOptimizedSupabaseClient();
      
      const connection: PooledConnection = {
        client,
        createdAt: new Date(),
        lastUsed: new Date(),
        isIdle: false,
        connectionTime,
      };

      this.connections.set(key, connection);
      this.totalConnectionsCreated++;
      this.connectionTimes.push(connectionTime);
      
      // Keep only last 100 connection times for average calculation
      if (this.connectionTimes.length > 100) {
        this.connectionTimes = this.connectionTimes.slice(-100);
      }

      return client;
      
    } catch (error) {
      this.connectionErrors++;
      this.addAlert({
        id: `conn_error_${Date.now()}`,
        type: 'connection_errors',
        severity: 'high',
        message: `Failed to create database connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        resolved: false,
      });
      
      // Return degraded client as fallback
      return this.createDegradedClient();
    }
  }

  private createDegradedClient(): ReturnType<typeof createOptimizedSupabaseClient> {
    // In degraded mode, create a basic client without pooling
    console.warn('Database connection pool exhausted, creating degraded client');
    return createOptimizedSupabaseClient();
  }

  private async handleConnectionExhaustion(): Promise<void> {
    // Try to clean up idle connections first
    await this.cleanupIdleConnections();
    
    // Add alert for connection exhaustion
    this.addAlert({
      id: `exhaustion_${Date.now()}`,
      type: 'connection_exhaustion',
      severity: 'critical',
      message: `Connection pool exhausted: ${this.connections.size}/${this.maxConnections} connections in use`,
      timestamp: new Date(),
      resolved: false,
    });
  }

  private isConnectionExpired(connection: PooledConnection): boolean {
    const now = Date.now();
    const lastUsedTime = connection.lastUsed.getTime();
    return (now - lastUsedTime) > this.idleTimeout;
  }

  private async removeConnection(key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      this.connections.delete(key);
      this.totalConnectionsDestroyed++;
    }
  }

  private async cleanupIdleConnections(): Promise<number> {
    const now = Date.now();
    let cleanedUp = 0;
    
    for (const [key, connection] of this.connections.entries()) {
      if (this.isConnectionExpired(connection)) {
        await this.removeConnection(key);
        cleanedUp++;
      } else if ((now - connection.lastUsed.getTime()) > (this.idleTimeout / 2)) {
        // Mark as idle if not used for half the idle timeout
        connection.isIdle = true;
      }
    }
    
    this.lastCleanup = now;
    return cleanedUp;
  }

  private startCleanupInterval(): void {
    // Clean up idle connections every 30 seconds
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupIdleConnections();
    }, 30000);
  }

  private addAlert(alert: PoolAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
    
    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`[DB Pool Alert] ${alert.message}`);
    } else if (alert.severity === 'high') {
      console.warn(`[DB Pool Alert] ${alert.message}`);
    }
  }

  async closeConnection(key: string): Promise<void> {
    await this.removeConnection(key);
  }

  async closeAllConnections(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.connections.clear();
    this.totalConnectionsDestroyed += this.connections.size;
  }

  getConnectionStats(): ConnectionPoolMetrics {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => !conn.isIdle).length;
    const idleConnections = this.connections.size - activeConnections;
    const poolUtilization = (this.connections.size / this.maxConnections) * 100;
    
    // Calculate average connection time
    const averageConnectionTime = this.connectionTimes.length > 0
      ? this.connectionTimes.reduce((sum, time) => sum + time, 0) / this.connectionTimes.length
      : 0;
    
    // Determine health status
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (poolUtilization > 90 || this.connectionErrors > 5) {
      healthStatus = 'critical';
    } else if (poolUtilization > 70 || this.connectionErrors > 2) {
      healthStatus = 'warning';
    }
    
    // Check for high utilization alert
    if (poolUtilization > 80) {
      const existingAlert = this.alerts.find(a => 
        a.type === 'high_utilization' && !a.resolved
      );
      
      if (!existingAlert) {
        this.addAlert({
          id: `high_util_${Date.now()}`,
          type: 'high_utilization',
          severity: poolUtilization > 90 ? 'critical' : 'medium',
          message: `High connection pool utilization: ${poolUtilization.toFixed(1)}%`,
          timestamp: new Date(),
          resolved: false,
        });
      }
    }
    
    return {
      activeConnections,
      maxConnections: this.maxConnections,
      idleConnections,
      totalConnectionsCreated: this.totalConnectionsCreated,
      totalConnectionsDestroyed: this.totalConnectionsDestroyed,
      connectionErrors: this.connectionErrors,
      averageConnectionTime,
      lastConnectionTime: this.connectionTimes[this.connectionTimes.length - 1] || 0,
      poolUtilization: Math.round(poolUtilization * 100) / 100,
      healthStatus,
      alerts: this.alerts.filter(alert => !alert.resolved),
    };
  }

  // Method to resolve alerts (for admin use)
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  // Method to get detailed connection information
  getDetailedConnectionInfo(): Array<{
    key: string;
    createdAt: Date;
    lastUsed: Date;
    isIdle: boolean;
    connectionTime: number;
    ageMs: number;
  }> {
    const now = Date.now();
    return Array.from(this.connections.entries()).map(([key, conn]) => ({
      key,
      createdAt: conn.createdAt,
      lastUsed: conn.lastUsed,
      isIdle: conn.isIdle,
      connectionTime: conn.connectionTime,
      ageMs: now - conn.createdAt.getTime(),
    }));
  }

  // Method to manually add alert (for testing purposes)
  addTestAlert(alert: PoolAlert): void {
    this.addAlert(alert);
  }
}

// Export singleton instance
export const dbPool = DatabaseConnectionPool.getInstance();

// Utility function to get optimized client
export const getSupabaseClient = async (key?: string) => {
  return await dbPool.getClient(key);
};

// Database health check utility
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const client = getSupabaseClient('health-check');
    
    // Simple query to test connection
    const { error } = await (await client)
      .from('orgs')
      .select('id')
      .limit(1)
      .single();
    
    const latency = Date.now() - startTime;
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return {
        healthy: false,
        latency,
        error: error.message,
      };
    }
    
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Query performance monitoring
export function withQueryPerformanceMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  if (!config.performance.enableMonitoring) {
    return queryFn();
  }

  const startTime = Date.now();
  
  return queryFn().then(
    (result) => {
      const duration = Date.now() - startTime;
      
      if (duration > config.performance.slowQueryThreshold) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }
      
      // Sample performance data
      if (Math.random() < config.performance.sampleRate) {
        console.info(`Query performance: ${queryName} - ${duration}ms`);
      }
      
      return result;
    },
    (error) => {
      const duration = Date.now() - startTime;
      console.error(`Query failed: ${queryName} after ${duration}ms`, error);
      throw error;
    }
  );
}