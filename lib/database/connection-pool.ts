import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import type { Database } from '@/lib/types/database';

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

// Database connection pool manager
class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private clients: Map<string, ReturnType<typeof createOptimizedSupabaseClient>> = new Map();
  private connectionCount = 0;
  private readonly maxConnections = config.database.maxConnections;

  private constructor() {}

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  getClient(key = 'default'): ReturnType<typeof createOptimizedSupabaseClient> {
    if (this.clients.has(key)) {
      return this.clients.get(key)!;
    }

    if (this.connectionCount >= this.maxConnections) {
      // Return existing client if at max connections
      const existingClient = this.clients.values().next().value;
      if (existingClient) {
        return existingClient;
      }
    }

    const client = createOptimizedSupabaseClient();
    this.clients.set(key, client);
    this.connectionCount++;

    return client;
  }

  async closeConnection(key: string): Promise<void> {
    const client = this.clients.get(key);
    if (client) {
      // Supabase client doesn't have explicit close method
      // but we can remove it from our pool
      this.clients.delete(key);
      this.connectionCount--;
    }
  }

  async closeAllConnections(): Promise<void> {
    this.clients.clear();
    this.connectionCount = 0;
  }

  getConnectionStats() {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      clientKeys: Array.from(this.clients.keys()),
    };
  }
}

// Export singleton instance
export const dbPool = DatabaseConnectionPool.getInstance();

// Utility function to get optimized client
export const getSupabaseClient = (key?: string) => {
  return dbPool.getClient(key);
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
    const { error } = await client
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