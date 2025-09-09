import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logProcessingStep } from '../utils';
import { createAdminClient } from '@/lib/supabase/admin';

// Mock the Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Enhanced Database Utils', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
    };
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  describe('logProcessingStep with audit trail', () => {
    it('should call log_processing_step with all audit trail parameters', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await logProcessingStep(
        'org-123',
        'email-456',
        'email_parsing',
        'completed',
        { parsed: true },
        undefined,
        1500,
        'corr-789',
        'chiphi-raw-emails/inbound/message-123.eml',
        'msg-abc-def'
      );

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
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await logProcessingStep(
        'org-123',
        'email-456',
        'email_parsing',
        'completed',
        { parsed: true },
        undefined,
        1500
        // No correlationId, rawRef, or messageId
      );

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
      mockSupabase.rpc.mockResolvedValue({ 
        error: { message: 'Database connection failed' } 
      });

      // Should not throw error
      await expect(logProcessingStep(
        'org-123',
        'email-456',
        'email_parsing',
        'failed',
        undefined,
        'Parsing failed',
        undefined,
        undefined,
        'chiphi-raw-emails/inbound/message-123.eml'
      )).resolves.not.toThrow();

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
});