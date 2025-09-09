import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdempotencyService } from '../idempotency-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { loggingService } from '../logging-service';

// Mock dependencies
vi.mock('@/lib/supabase/admin');
vi.mock('../logging-service');

describe('IdempotencyService', () => {
  let idempotencyService: IdempotencyService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
    (loggingService.logProcessingStep as any) = vi.fn();
    (loggingService.generateCorrelationId as any) = vi.fn().mockReturnValue('test-correlation-id');

    idempotencyService = new IdempotencyService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkIdempotency', () => {
    const testOrgId = 'test-org-id';
    const testAlias = 'u_test';
    const testMessageId = 'test-message-id';
    const testRawRef = 'chiphi-raw-emails/inbound/test.eml';

    it('should return not duplicate for new message', async () => {
      // Mock no existing record found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      });

      // Mock successful insert
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'new-record-id',
          org_id: testOrgId,
          alias: testAlias,
          message_id: testMessageId,
          provider: 'ses',
          raw_ref: testRawRef,
          processed_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await idempotencyService.checkIdempotency(
        testOrgId,
        testAlias,
        testMessageId,
        'ses',
        testRawRef
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.shouldProcess).toBe(true);
      expect(result.reason).toContain('New message');
      expect(mockSupabase.from).toHaveBeenCalledWith('email_idempotency_records');
      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'idempotency_check',
          status: 'completed',
          details: expect.objectContaining({
            isDuplicate: false,
            alias: testAlias,
            messageId: testMessageId,
          }),
        })
      );
    });

    it('should return duplicate for existing message', async () => {
      const existingRecord = {
        id: 'existing-record-id',
        org_id: testOrgId,
        alias: testAlias,
        message_id: testMessageId,
        email_id: 'existing-email-id',
        raw_ref: testRawRef,
        provider: 'ses',
        processed_at: '2024-01-01T00:00:00Z',
        correlation_id: 'existing-correlation-id',
      };

      // Mock existing record found
      mockSupabase.single.mockResolvedValueOnce({
        data: existingRecord,
        error: null,
      });

      const result = await idempotencyService.checkIdempotency(
        testOrgId,
        testAlias,
        testMessageId,
        'ses',
        testRawRef
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.shouldProcess).toBe(false);
      expect(result.existingRecord).toEqual({
        id: existingRecord.id,
        orgId: existingRecord.org_id,
        alias: existingRecord.alias,
        messageId: existingRecord.message_id,
        emailId: existingRecord.email_id,
        rawRef: existingRecord.raw_ref,
        provider: existingRecord.provider,
        processedAt: existingRecord.processed_at,
        correlationId: existingRecord.correlation_id,
      });
      expect(result.reason).toContain('already processed');
      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'idempotency_check',
          status: 'completed',
          details: expect.objectContaining({
            isDuplicate: true,
            existingRecordId: existingRecord.id,
          }),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'SOME_ERROR', message: 'Database connection failed' },
      });

      const result = await idempotencyService.checkIdempotency(
        testOrgId,
        testAlias,
        testMessageId,
        'ses',
        testRawRef
      );

      // Should fail open - allow processing to continue
      expect(result.isDuplicate).toBe(false);
      expect(result.shouldProcess).toBe(true);
      expect(result.reason).toContain('failed');
      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'idempotency_check',
          status: 'failed',
          errorMessage: expect.stringContaining('Database error'),
        })
      );
    });

    it('should include rawRef in audit trail', async () => {
      // Mock no existing record
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock successful insert with rawRef
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'new-record-id',
          org_id: testOrgId,
          alias: testAlias,
          message_id: testMessageId,
          provider: 'ses',
          raw_ref: testRawRef,
          processed_at: new Date().toISOString(),
        },
        error: null,
      });

      await idempotencyService.checkIdempotency(
        testOrgId,
        testAlias,
        testMessageId,
        'ses',
        testRawRef
      );

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_ref: testRawRef,
        })
      );
    });
  });

  describe('updateIdempotencyRecordWithEmailId', () => {
    it('should update record with email ID', async () => {
      const recordId = 'test-record-id';
      const emailId = 'test-email-id';

      // Mock the chain properly
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValueOnce({
        error: null,
      });

      await idempotencyService.updateIdempotencyRecordWithEmailId(recordId, emailId);

      expect(mockSupabase.from).toHaveBeenCalledWith('email_idempotency_records');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        email_id: emailId,
        updated_at: expect.any(String),
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', recordId);
    });

    it('should handle update errors gracefully', async () => {
      const recordId = 'test-record-id';
      const emailId = 'test-email-id';

      mockSupabase.update.mockResolvedValueOnce({
        error: { message: 'Update failed' },
      });

      // Should not throw error
      await expect(
        idempotencyService.updateIdempotencyRecordWithEmailId(recordId, emailId)
      ).resolves.not.toThrow();
    });
  });

  describe('getIdempotencyStatistics', () => {
    it('should return statistics for organization', async () => {
      const testOrgId = 'test-org-id';
      const mockRecords = [
        { provider: 'ses', created_at: new Date().toISOString() },
        { provider: 'cloudflare', created_at: new Date().toISOString() },
      ];

      const mockLogs = [
        { details: { isDuplicate: false, provider: 'ses' } },
        { details: { isDuplicate: true, provider: 'ses' } },
        { details: { isDuplicate: false, provider: 'cloudflare' } },
      ];

      // Mock the first query (records)
      mockSupabase.from.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockReturnValueOnce(mockSupabase);
      mockSupabase.gte.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockResolvedValueOnce({
        data: mockRecords,
        error: null,
      });

      // Mock the second query (logs)
      mockSupabase.from.mockReturnValueOnce(mockSupabase);
      mockSupabase.select.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      mockSupabase.gte.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockResolvedValueOnce({
        data: mockLogs,
        error: null,
      });

      const result = await idempotencyService.getIdempotencyStatistics(testOrgId);

      expect(result.totalChecks).toBe(3);
      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicateRate).toBeCloseTo(33.33, 2);
      expect(result.providerBreakdown).toHaveLength(2);
      expect(result.providerBreakdown.find(p => p.provider === 'ses')).toEqual({
        provider: 'ses',
        count: 2,
        duplicates: 1,
      });
    });

    it('should handle empty results', async () => {
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await idempotencyService.getIdempotencyStatistics();

      expect(result.totalChecks).toBe(0);
      expect(result.duplicatesFound).toBe(0);
      expect(result.duplicateRate).toBe(0);
      expect(result.providerBreakdown).toEqual([]);
    });
  });

  describe('getAuditTrail', () => {
    it('should return complete audit trail', async () => {
      const testOrgId = 'test-org-id';
      const testMessageId = 'test-message-id';

      const mockIdempotencyRecord = {
        id: 'record-id',
        org_id: testOrgId,
        alias: 'u_test',
        message_id: testMessageId,
        email_id: 'email-id',
        raw_ref: 'chiphi-raw-emails/inbound/test.eml',
        provider: 'ses',
        processed_at: '2024-01-01T00:00:00Z',
        correlation_id: 'correlation-id',
      };

      const mockProcessingLogs = [
        {
          step: 'idempotency_check',
          status: 'completed',
          created_at: '2024-01-01T00:00:01Z',
          details: { isDuplicate: false },
          processing_time_ms: 100,
        },
        {
          step: 'email_processing',
          status: 'completed',
          created_at: '2024-01-01T00:00:02Z',
          details: { transactionId: 'transaction-id' },
          processing_time_ms: 5000,
        },
      ];

      mockSupabase.single.mockResolvedValueOnce({
        data: mockIdempotencyRecord,
        error: null,
      });

      mockSupabase.order.mockResolvedValueOnce({
        data: mockProcessingLogs,
        error: null,
      });

      const result = await idempotencyService.getAuditTrail(testOrgId, testMessageId);

      expect(result.idempotencyRecord).toEqual({
        id: mockIdempotencyRecord.id,
        orgId: mockIdempotencyRecord.org_id,
        alias: mockIdempotencyRecord.alias,
        messageId: mockIdempotencyRecord.message_id,
        emailId: mockIdempotencyRecord.email_id,
        rawRef: mockIdempotencyRecord.raw_ref,
        provider: mockIdempotencyRecord.provider,
        processedAt: mockIdempotencyRecord.processed_at,
        correlationId: mockIdempotencyRecord.correlation_id,
      });

      expect(result.processingLogs).toHaveLength(2);
      expect(result.processingLogs[0]).toEqual({
        step: 'idempotency_check',
        status: 'completed',
        timestamp: '2024-01-01T00:00:01Z',
        details: { isDuplicate: false },
        processingTimeMs: 100,
      });

      expect(result.rawRef).toBe('chiphi-raw-emails/inbound/test.eml');
    });

    it('should handle missing records', async () => {
      const testOrgId = 'test-org-id';
      const testMessageId = 'nonexistent-message-id';

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await idempotencyService.getAuditTrail(testOrgId, testMessageId);

      expect(result.idempotencyRecord).toBeUndefined();
      expect(result.processingLogs).toEqual([]);
      expect(result.rawRef).toBeUndefined();
    });
  });

  describe('cleanupOldRecords', () => {
    it('should clean up old records', async () => {
      const mockDeletedRecords = [
        { id: 'old-record-1' },
        { id: 'old-record-2' },
      ];

      mockSupabase.select.mockResolvedValueOnce({
        data: mockDeletedRecords,
        error: null,
      });

      const result = await idempotencyService.cleanupOldRecords(30);

      expect(result).toBe(2);
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.lt).toHaveBeenCalledWith(
        'created_at',
        expect.any(String)
      );
    });

    it('should handle cleanup errors', async () => {
      mockSupabase.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Cleanup failed' },
      });

      await expect(idempotencyService.cleanupOldRecords()).rejects.toThrow(
        'Failed to cleanup old idempotency records'
      );
    });
  });
});