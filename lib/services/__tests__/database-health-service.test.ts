import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { databaseHealthService } from '../database-health-service';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabaseClient,
}));

vi.mock('@/lib/config', () => ({
  config: {
    performance: {
      slowQueryThreshold: 1000,
    },
    database: {
      maxConnections: 10,
    },
    supabase: {
      url: 'https://test.supabase.co',
    },
    logging: {
      enableProcessingLogs: true,
    },
  },
}));

describe('DatabaseHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when database is accessible', async () => {
      // Mock successful database query
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-org-id' },
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'PostgreSQL 15.0',
      });

      const result = await databaseHealthService.checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.connectionActive).toBe(true);
      expect(result.queryPerformance).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.details?.version).toBe('PostgreSQL 15.0');
    });

    it('should return unhealthy status when database query fails', async () => {
      // Mock failed database query
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed', code: 'CONNECTION_ERROR' },
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await databaseHealthService.checkDatabaseHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.connectionActive).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('should handle PGRST116 error as healthy (no rows returned)', async () => {
      // Mock PGRST116 error (no rows returned, which is fine for health check)
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows returned', code: 'PGRST116' },
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'PostgreSQL 15.0',
      });

      const result = await databaseHealthService.checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.connectionActive).toBe(true);
    });

    it('should track query performance', async () => {
      // Mock slow query
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve({
                  data: { id: 'test-org-id' },
                  error: null,
                });
              }, 50); // 50ms delay
            });
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'PostgreSQL 15.0',
      });

      const result = await databaseHealthService.checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.queryPerformance).toBeDefined();
      expect(result.queryPerformance?.averageResponseTime).toBeGreaterThan(40);
    });
  });

  describe('checkRealtimeHealth', () => {
    it('should return healthy status when realtime connection succeeds', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          // Simulate successful subscription
          setTimeout(() => callback('SUBSCRIBED'), 10);
          return mockChannel;
        }),
        unsubscribe: vi.fn(),
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const result = await databaseHealthService.checkRealtimeHealth();

      expect(result.status).toBe('healthy');
      expect(result.connectionActive).toBe(true);
      expect(result.channelsActive).toBe(1);
      expect(result.details?.endpoint).toContain('wss://');
    });

    it('should return unhealthy status when realtime connection fails', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          // Simulate failed subscription
          setTimeout(() => callback('CHANNEL_ERROR'), 10);
          return mockChannel;
        }),
        unsubscribe: vi.fn(),
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const result = await databaseHealthService.checkRealtimeHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.connectionActive).toBe(false);
      expect(result.channelsActive).toBe(0);
      expect(result.error).toContain('CHANNEL_ERROR');
    });

    it('should timeout if realtime connection takes too long', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation(() => {
          // Never call the callback - simulate timeout
          return mockChannel;
        }),
        unsubscribe: vi.fn(),
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const result = await databaseHealthService.checkRealtimeHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.connectionActive).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('checkDatabaseAndRealtimeHealth', () => {
    it('should return combined health status', async () => {
      // Mock successful database query
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-org-id' },
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: 'PostgreSQL 15.0',
      });

      // Mock successful realtime connection
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          setTimeout(() => callback('SUBSCRIBED'), 10);
          return mockChannel;
        }),
        unsubscribe: vi.fn(),
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const result = await databaseHealthService.checkDatabaseAndRealtimeHealth();

      expect(result.db).toBe(true);
      expect(result.realtime).toBe(true);
      expect(result.details.database.status).toBe('healthy');
      expect(result.details.realtime.status).toBe('healthy');
    });

    it('should handle mixed health results', async () => {
      // Mock failed database query
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed', code: 'CONNECTION_ERROR' },
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      // Mock successful realtime connection
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation((callback) => {
          setTimeout(() => callback('SUBSCRIBED'), 10);
          return mockChannel;
        }),
        unsubscribe: vi.fn(),
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const result = await databaseHealthService.checkDatabaseAndRealtimeHealth();

      expect(result.db).toBe(false);
      expect(result.realtime).toBe(true);
      expect(result.details.database.status).toBe('unhealthy');
      expect(result.details.realtime.status).toBe('healthy');
    });

    it('should handle timeout gracefully', async () => {
      // Mock very slow operations
      const mockSelect = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            return new Promise(() => {
              // Never resolve - simulate timeout
            });
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await databaseHealthService.checkDatabaseAndRealtimeHealth(100); // 100ms timeout

      expect(result.db).toBe(false);
      expect(result.realtime).toBe(false);
      expect(result.details.database.error).toContain('timeout');
      expect(result.details.realtime.error).toContain('timeout');
    });
  });
});