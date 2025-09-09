import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CorrelationService } from '../correlation-service';
import { loggingService } from '../logging-service';

// Mock dependencies
vi.mock('../logging-service');

describe('CorrelationService', () => {
  let correlationService: CorrelationService;

  beforeEach(() => {
    (loggingService.generateCorrelationId as any) = vi.fn().mockReturnValue('test-correlation-id');
    (loggingService.logProcessingStep as any) = vi.fn();
    
    correlationService = new CorrelationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createCorrelationContext', () => {
    it('should create a new correlation context', () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai',
        'chiphi-raw-emails/inbound/test.eml'
      );

      expect(context).toEqual({
        correlationId: 'test-correlation-id',
        orgId: 'test-org-id',
        messageId: 'test-message-id',
        provider: 'ses',
        alias: 'u_test@inbox.chiphi.ai',
        rawRef: 'chiphi-raw-emails/inbound/test.eml',
        startTime: expect.any(Number),
        steps: [],
      });

      expect(loggingService.generateCorrelationId).toHaveBeenCalled();
    });

    it('should store the context for retrieval', () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      const retrieved = correlationService.getCorrelationContext(context.correlationId);
      expect(retrieved).toEqual(context);
    });
  });

  describe('startStep', () => {
    it('should start a processing step', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      await correlationService.startStep(
        context.correlationId,
        'test-step',
        { testDetail: 'value' }
      );

      expect(context.steps).toHaveLength(1);
      expect(context.steps[0]).toEqual({
        step: 'test-step',
        status: 'started',
        timestamp: expect.any(Number),
        details: { testDetail: 'value' },
      });

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        emailId: '',
        step: 'test-step',
        status: 'started',
        details: {
          messageId: 'test-message-id',
          provider: 'ses',
          alias: 'u_test@inbox.chiphi.ai',
          rawRef: undefined,
          correlationId: context.correlationId,
          testDetail: 'value',
        },
        correlationId: context.correlationId,
      });
    });

    it('should handle missing correlation context gracefully', async () => {
      await correlationService.startStep(
        'nonexistent-correlation-id',
        'test-step'
      );

      expect(loggingService.logProcessingStep).not.toHaveBeenCalled();
    });
  });

  describe('completeStep', () => {
    it('should complete a processing step', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      // Start a step first
      await correlationService.startStep(context.correlationId, 'test-step');
      
      // Complete the step
      await correlationService.completeStep(
        context.correlationId,
        'test-step',
        { result: 'success' },
        'test-email-id'
      );

      const step = context.steps.find(s => s.step === 'test-step');
      expect(step).toEqual({
        step: 'test-step',
        status: 'completed',
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        details: { result: 'success' },
      });

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        emailId: 'test-email-id',
        step: 'test-step',
        status: 'completed',
        details: {
          messageId: 'test-message-id',
          provider: 'ses',
          alias: 'u_test@inbox.chiphi.ai',
          rawRef: undefined,
          correlationId: context.correlationId,
          duration: expect.any(Number),
          result: 'success',
        },
        processingTimeMs: expect.any(Number),
        correlationId: context.correlationId,
      });
    });

    it('should handle step not found gracefully', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      await correlationService.completeStep(
        context.correlationId,
        'nonexistent-step'
      );

      // Should still log the completion
      expect(loggingService.logProcessingStep).toHaveBeenCalled();
    });
  });

  describe('failStep', () => {
    it('should fail a processing step', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      // Start a step first
      await correlationService.startStep(context.correlationId, 'test-step');
      
      // Fail the step
      const error = new Error('Test error');
      await correlationService.failStep(
        context.correlationId,
        'test-step',
        error,
        { errorCode: 'TEST_ERROR' },
        'test-email-id'
      );

      const step = context.steps.find(s => s.step === 'test-step');
      expect(step).toEqual({
        step: 'test-step',
        status: 'failed',
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        details: { errorCode: 'TEST_ERROR' },
      });

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        emailId: 'test-email-id',
        step: 'test-step',
        status: 'failed',
        details: {
          messageId: 'test-message-id',
          provider: 'ses',
          alias: 'u_test@inbox.chiphi.ai',
          rawRef: undefined,
          correlationId: context.correlationId,
          duration: expect.any(Number),
          error: 'Test error',
          errorCode: 'TEST_ERROR',
        },
        errorMessage: 'Test error',
        processingTimeMs: expect.any(Number),
        correlationId: context.correlationId,
      });
    });
  });

  describe('linkWithIdempotencyRecord', () => {
    it('should link correlation with idempotency record', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      await correlationService.linkWithIdempotencyRecord(
        context.correlationId,
        'idempotency-record-id'
      );

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        emailId: '',
        step: 'idempotency_record_linked',
        status: 'completed',
        details: {
          messageId: 'test-message-id',
          provider: 'ses',
          alias: 'u_test@inbox.chiphi.ai',
          rawRef: undefined,
          correlationId: context.correlationId,
          idempotencyRecordId: 'idempotency-record-id',
        },
        correlationId: context.correlationId,
      });
    });
  });

  describe('linkWithEmailRecord', () => {
    it('should link correlation with email record', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      // Add some steps first
      await correlationService.startStep(context.correlationId, 'step1');
      await correlationService.completeStep(context.correlationId, 'step1');

      await correlationService.linkWithEmailRecord(
        context.correlationId,
        'test-email-id'
      );

      // Should log linking for each step
      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'step1_email_linked',
          status: 'completed',
          details: expect.objectContaining({
            originalStep: 'step1',
            originalStatus: 'completed',
          }),
        })
      );
    });
  });

  describe('linkWithTransactionRecord', () => {
    it('should link correlation with transaction record', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      await correlationService.linkWithTransactionRecord(
        context.correlationId,
        'transaction-id',
        'email-id'
      );

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        emailId: 'email-id',
        step: 'transaction_created',
        status: 'completed',
        details: {
          messageId: 'test-message-id',
          provider: 'ses',
          alias: 'u_test@inbox.chiphi.ai',
          rawRef: undefined,
          correlationId: context.correlationId,
          transactionId: 'transaction-id',
          totalProcessingTime: expect.any(Number),
          stepsCompleted: 0,
        },
        processingTimeMs: expect.any(Number),
        correlationId: context.correlationId,
      });
    });
  });

  describe('completeCorrelation', () => {
    it('should complete correlation successfully', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      // Add some steps
      await correlationService.startStep(context.correlationId, 'step1');
      await correlationService.completeStep(context.correlationId, 'step1');

      const result = await correlationService.completeCorrelation(
        context.correlationId,
        true,
        { finalResult: 'success' }
      );

      expect(result).toEqual({
        correlationId: context.correlationId,
        totalProcessingTime: expect.any(Number),
        stepsCompleted: 1,
        success: true,
        auditTrail: [
          {
            step: 'step1',
            status: 'completed',
            timestamp: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
      });

      expect(loggingService.logProcessingStep).toHaveBeenCalledWith({
        orgId: 'test-org-id',
        emailId: '',
        step: 'correlation_completed',
        status: 'completed',
        details: {
          messageId: 'test-message-id',
          provider: 'ses',
          alias: 'u_test@inbox.chiphi.ai',
          rawRef: undefined,
          correlationId: context.correlationId,
          totalProcessingTime: expect.any(Number),
          stepsCompleted: 1,
          success: true,
          finalResult: 'success',
        },
        processingTimeMs: expect.any(Number),
        correlationId: context.correlationId,
      });

      // Context should be cleaned up
      expect(correlationService.getCorrelationContext(context.correlationId)).toBeUndefined();
    });

    it('should complete correlation with failure', async () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      const result = await correlationService.completeCorrelation(
        context.correlationId,
        false,
        { error: 'Processing failed' }
      );

      expect(result.success).toBe(false);
      expect(loggingService.logProcessingStep).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'correlation_completed',
          status: 'failed',
        })
      );
    });

    it('should throw error for nonexistent correlation', async () => {
      await expect(
        correlationService.completeCorrelation('nonexistent-id', true)
      ).rejects.toThrow('Correlation context not found');
    });
  });

  describe('cleanupOrphanedCorrelations', () => {
    it('should clean up old correlations', () => {
      // Create an old correlation by mocking the start time
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      // Manually set old start time
      context.startTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago

      const cleanedCount = correlationService.cleanupOrphanedCorrelations(60); // 60 minutes

      expect(cleanedCount).toBe(1);
      expect(correlationService.getCorrelationContext(context.correlationId)).toBeUndefined();
    });

    it('should not clean up recent correlations', () => {
      const context = correlationService.createCorrelationContext(
        'test-org-id',
        'test-message-id',
        'ses',
        'u_test@inbox.chiphi.ai'
      );

      const cleanedCount = correlationService.cleanupOrphanedCorrelations(60);

      expect(cleanedCount).toBe(0);
      expect(correlationService.getCorrelationContext(context.correlationId)).toBeDefined();
    });
  });

  describe('getActiveCorrelationCount', () => {
    it('should return correct active correlation count', () => {
      // Create a fresh service instance to avoid interference from other tests
      const freshService = new CorrelationService();
      
      // Mock different correlation IDs for each call
      (loggingService.generateCorrelationId as any)
        .mockReturnValueOnce('test-correlation-id-1')
        .mockReturnValueOnce('test-correlation-id-2');
      
      expect(freshService.getActiveCorrelationCount()).toBe(0);

      freshService.createCorrelationContext(
        'test-org-id-1',
        'test-message-id-1',
        'ses',
        'u_test1@inbox.chiphi.ai'
      );

      freshService.createCorrelationContext(
        'test-org-id-2',
        'test-message-id-2',
        'ses',
        'u_test2@inbox.chiphi.ai'
      );

      expect(freshService.getActiveCorrelationCount()).toBe(2);
    });
  });
});