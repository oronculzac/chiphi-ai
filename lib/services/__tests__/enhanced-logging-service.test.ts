import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoggingService } from '../logging-service';
import { createAdminClient } from '@/lib/supabase/admin';

// Mock the Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Enhanced LoggingService', () => {
  let loggingService: LoggingService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
    };
    (createAdminClient as any).mockReturnValue(mockSupabase);
    loggingService = new LoggingService();
  });

  describe('logProcessingStep with audit trail', () => {
    it('should call log_processing_step with all audit trail parameters', async () => {
      const mockLog = {
        orgId: 'org-123',
        emailId: 'email-456',
        step: 'email_parsing',
        status: 'completed' as const,
        details: { parsed: true },
        errorMessage: undefined,
        processingTimeMs: 1500,
        correlationId: 'corr-789',
        rawRef: 'chiphi-raw-emails/inbound/message-123.eml',
        messageId: 'msg-abc-def',
      };

      mockSupabase.rpc.mockResolvedValue({ error: null });

      await loggingService.logProcessingStep(mockLog);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_processing_step', {
        org_uuid: 'org-123',
        email_uuid: 'email-456',
        step_name: 'email_parsing',
        step_status: 'completed',
        step_details: { parsed: true },
        error_msg: undefined,
        processing_time: 1500,
        correlation_id_param: 'corr-789',
        raw_ref_param: 'chiphi-raw-emails/inbound/message-123.eml',
        message_id_param: 'msg-abc-def',
      });
    });

    it('should handle optional audit trail parameters', async () => {
      const mockLog = {
        orgId: 'org-123',
        emailId: 'email-456',
        step: 'email_parsing',
        status: 'completed' as const,
        details: { parsed: true },
        processingTimeMs: 1500,
        // No correlationId, rawRef, or messageId
      };

      mockSupabase.rpc.mockResolvedValue({ error: null });

      await loggingService.logProcessingStep(mockLog);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_processing_step', {
        org_uuid: 'org-123',
        email_uuid: 'email-456',
        step_name: 'email_parsing',
        step_status: 'completed',
        step_details: { parsed: true },
        error_msg: undefined,
        processing_time: 1500,
        correlation_id_param: undefined,
        raw_ref_param: undefined,
        message_id_param: undefined,
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockLog = {
        orgId: 'org-123',
        emailId: 'email-456',
        step: 'email_parsing',
        status: 'failed' as const,
        errorMessage: 'Parsing failed',
        rawRef: 'chiphi-raw-emails/inbound/message-123.eml',
      };

      mockSupabase.rpc.mockResolvedValue({ 
        error: { message: 'Database connection failed' } 
      });

      // Should not throw error
      await expect(loggingService.logProcessingStep(mockLog)).resolves.not.toThrow();

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_processing_step', {
        org_uuid: 'org-123',
        email_uuid: 'email-456',
        step_name: 'email_parsing',
        step_status: 'failed',
        step_details: undefined,
        error_msg: 'Parsing failed',
        processing_time: undefined,
        correlation_id_param: undefined,
        raw_ref_param: 'chiphi-raw-emails/inbound/message-123.eml',
        message_id_param: undefined,
      });
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = loggingService.generateCorrelationId();
      const id2 = loggingService.generateCorrelationId();

      expect(id1).toMatch(/^corr_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^corr_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('batchLogProcessingSteps', () => {
    it('should process multiple logs with audit trail', async () => {
      const mockLogs = [
        {
          orgId: 'org-123',
          emailId: 'email-456',
          step: 'email_parsing',
          status: 'completed' as const,
          rawRef: 'chiphi-raw-emails/inbound/message-1.eml',
          messageId: 'msg-1',
        },
        {
          orgId: 'org-123',
          emailId: 'email-789',
          step: 'ai_processing',
          status: 'completed' as const,
          rawRef: 'chiphi-raw-emails/inbound/message-2.eml',
          messageId: 'msg-2',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({ error: null });

      await loggingService.batchLogProcessingSteps(mockLogs);

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, 'log_processing_step', expect.objectContaining({
        raw_ref_param: 'chiphi-raw-emails/inbound/message-1.eml',
        message_id_param: 'msg-1',
      }));
      expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, 'log_processing_step', expect.objectContaining({
        raw_ref_param: 'chiphi-raw-emails/inbound/message-2.eml',
        message_id_param: 'msg-2',
      }));
    });
  });
});