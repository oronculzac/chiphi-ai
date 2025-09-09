/**
 * Idempotency and Duplicate Message Handling Integration Tests
 * 
 * Tests for duplicate messageId handling and rejection as specified in task 9.2
 * Requirements: 8.4 - Confirm duplicate messageIds are properly handled
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { idempotencyService } from '@/lib/services/idempotency-service';
import { enhancedEmailProcessor } from '@/lib/services/enhanced-email-processor';
import { loggingService } from '@/lib/services/logging-service';
import { getTestOrg, getTestUser } from '../fixtures/test-organizations';
import { getEmailSample } from '../fixtures/email-samples';
import type { InboundEmailPayload } from '@/lib/inbound/types';

describe('Idempotency and Duplicate Message Handling', () => {
  const supabase = createAdminClient();
  const testOrg = getTestOrg('primary');
  const testUser = getTestUser('primaryOwner');
  const testAlias = 'u_test';

  beforeEach(async () => {
    // Clean up any existing test data
    await supabase
      .from('email_idempotency_records')
      .delete()
      .eq('org_id', testOrg.id);
    
    await supabase
      .from('transactions')
      .delete()
      .eq('org_id', testOrg.id);
    
    await supabase
      .from('emails')
      .delete()
      .eq('org_id', testOrg.id);
  });

  afterEach(async () => {
    // Clean up test data
    await supabase
      .from('email_idempotency_records')
      .delete()
      .eq('org_id', testOrg.id);
    
    await supabase
      .from('transactions')
      .delete()
      .eq('org_id', testOrg.id);
    
    await supabase
      .from('emails')
      .delete()
      .eq('org_id', testOrg.id);
  });

  describe('Duplicate MessageId Detection', () => {
    it('should detect duplicate messageId for same organization and alias', async () => {
      const messageId = 'test-duplicate-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-001.eml';
      const correlationId = loggingService.generateCorrelationId();

      // First check - should be new
      const firstCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(firstCheck.isDuplicate).toBe(false);
      expect(firstCheck.shouldProcess).toBe(true);
      expect(firstCheck.reason).toContain('New message');

      // Second check with same messageId - should be duplicate
      const secondCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(secondCheck.isDuplicate).toBe(true);
      expect(secondCheck.shouldProcess).toBe(false);
      expect(secondCheck.reason).toContain('already processed');
      expect(secondCheck.existingRecord).toBeDefined();
      expect(secondCheck.existingRecord?.messageId).toBe(messageId);
      expect(secondCheck.existingRecord?.rawRef).toBe(rawRef);
    });

    it('should allow same messageId for different organizations', async () => {
      const messageId = 'test-cross-org-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-cross-org.eml';
      const correlationId = loggingService.generateCorrelationId();

      // Create a second test org
      const { data: secondOrg } = await supabase
        .from('organizations')
        .insert({
          name: 'Test Org 2',
          slug: 'test-org-2',
          created_by: testUser.id,
        })
        .select()
        .single();

      expect(secondOrg).toBeDefined();

      // First org - should be new
      const firstOrgCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(firstOrgCheck.isDuplicate).toBe(false);
      expect(firstOrgCheck.shouldProcess).toBe(true);

      // Second org with same messageId - should also be new (different org)
      const secondOrgCheck = await idempotencyService.checkIdempotency(
        secondOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(secondOrgCheck.isDuplicate).toBe(false);
      expect(secondOrgCheck.shouldProcess).toBe(true);

      // Clean up second org
      await supabase
        .from('organizations')
        .delete()
        .eq('id', secondOrg.id);
    });

    it('should allow same messageId for different aliases within same org', async () => {
      const messageId = 'test-multi-alias-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-multi-alias.eml';
      const correlationId = loggingService.generateCorrelationId();

      // First alias - should be new
      const firstAliasCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        'u_test1',
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(firstAliasCheck.isDuplicate).toBe(false);
      expect(firstAliasCheck.shouldProcess).toBe(true);

      // Second alias with same messageId - should also be new (different alias)
      const secondAliasCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        'u_test2',
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(secondAliasCheck.isDuplicate).toBe(false);
      expect(secondAliasCheck.shouldProcess).toBe(true);
    });

    it('should include rawRef in audit trail for duplicates', async () => {
      const messageId = 'test-audit-trail-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-audit.eml';
      const correlationId = loggingService.generateCorrelationId();

      // First processing
      await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      // Second processing (duplicate)
      const duplicateCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(duplicateCheck.isDuplicate).toBe(true);
      expect(duplicateCheck.existingRecord?.rawRef).toBe(rawRef);

      // Verify audit trail
      const auditTrail = await idempotencyService.getAuditTrail(testOrg.id, messageId);
      expect(auditTrail.idempotencyRecord).toBeDefined();
      expect(auditTrail.rawRef).toBe(rawRef);
      expect(auditTrail.processingLogs.length).toBeGreaterThan(0);
      
      // Should have logs for both checks
      const idempotencyLogs = auditTrail.processingLogs.filter(log => 
        log.step === 'idempotency_check'
      );
      expect(idempotencyLogs.length).toBe(2);
      
      // First log should show not duplicate
      expect(idempotencyLogs[0].details?.isDuplicate).toBe(false);
      // Second log should show duplicate
      expect(idempotencyLogs[1].details?.isDuplicate).toBe(true);
    });
  });

  describe('Database Integration Tests', () => {
    it('should create and update idempotency records correctly', async () => {
      const messageId = 'test-db-integration-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-db-integration.eml';
      const correlationId = loggingService.generateCorrelationId();

      // First check - should create new record
      const firstCheck = await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      expect(firstCheck.isDuplicate).toBe(false);
      expect(firstCheck.shouldProcess).toBe(true);

      // Verify record was created in database
      const { data: createdRecord } = await supabase
        .from('email_idempotency_records')
        .select('*')
        .eq('org_id', testOrg.id)
        .eq('message_id', messageId)
        .single();

      expect(createdRecord).toBeDefined();
      expect(createdRecord.alias).toBe(testAlias);
      expect(createdRecord.raw_ref).toBe(rawRef);
      expect(createdRecord.provider).toBe('ses');

      // Update record with email ID
      const testEmailId = 'test-email-id-123';
      await idempotencyService.updateIdempotencyRecordWithEmailId(
        createdRecord.id,
        testEmailId,
        correlationId
      );

      // Verify record was updated
      const { data: updatedRecord } = await supabase
        .from('email_idempotency_records')
        .select('*')
        .eq('id', createdRecord.id)
        .single();

      expect(updatedRecord.email_id).toBe(testEmailId);
    });

    it('should handle concurrent idempotency checks correctly', async () => {
      const messageId = 'test-concurrent-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-concurrent.eml';
      const correlationId = loggingService.generateCorrelationId();

      // Run multiple concurrent checks
      const concurrentPromises = Array.from({ length: 5 }, () =>
        idempotencyService.checkIdempotency(
          testOrg.id,
          testAlias,
          messageId,
          'ses',
          rawRef,
          correlationId
        )
      );

      const results = await Promise.all(concurrentPromises);

      // Only one should be original, others should be duplicates
      const originalResults = results.filter(r => !r.isDuplicate);
      const duplicateResults = results.filter(r => r.isDuplicate);

      expect(originalResults).toHaveLength(1);
      expect(duplicateResults).toHaveLength(4);

      // Verify only one record was created
      const { data: allRecords } = await supabase
        .from('email_idempotency_records')
        .select('*')
        .eq('org_id', testOrg.id)
        .eq('message_id', messageId);

      expect(allRecords).toHaveLength(1);
    });

    it('should clean up old idempotency records', async () => {
      // Create some old records by manipulating the created_at timestamp
      const oldMessageIds = [
        'old-message-001@example.com',
        'old-message-002@example.com',
        'old-message-003@example.com',
      ];

      for (const messageId of oldMessageIds) {
        await idempotencyService.checkIdempotency(
          testOrg.id,
          testAlias,
          messageId,
          'ses',
          'old-raw-ref',
          loggingService.generateCorrelationId()
        );
      }

      // Manually update created_at to be old (simulate old records)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 100); // 100 days ago

      await supabase
        .from('email_idempotency_records')
        .update({ created_at: cutoffDate.toISOString() })
        .eq('org_id', testOrg.id)
        .in('message_id', oldMessageIds);

      // Clean up old records (90 day retention)
      const deletedCount = await idempotencyService.cleanupOldRecords(90);

      expect(deletedCount).toBe(3);

      // Verify records were deleted
      const { data: remainingRecords } = await supabase
        .from('email_idempotency_records')
        .select('*')
        .eq('org_id', testOrg.id)
        .in('message_id', oldMessageIds);

      expect(remainingRecords).toHaveLength(0);
    });
  });

  describe('Error Handling in Duplicate Detection', () => {
    it('should fail open when idempotency check encounters database error', async () => {
      const messageId = 'test-error-handling-001@example.com';
      const correlationId = loggingService.generateCorrelationId();

      // Mock database error by using invalid org ID
      const invalidOrgId = 'invalid-org-id-that-does-not-exist';

      const result = await idempotencyService.checkIdempotency(
        invalidOrgId,
        testAlias,
        messageId,
        'ses',
        'test-raw-ref',
        correlationId
      );

      // Should fail open - allow processing to continue
      expect(result.isDuplicate).toBe(false);
      expect(result.shouldProcess).toBe(true);
      expect(result.reason).toContain('failed');
    });

    it('should log security events for suspicious duplicate patterns', async () => {
      const baseMessageId = 'test-security-pattern';
      const correlationId = loggingService.generateCorrelationId();

      // Create multiple rapid duplicates (potential attack pattern)
      const duplicatePromises = Array.from({ length: 10 }, (_, index) =>
        idempotencyService.checkIdempotency(
          testOrg.id,
          testAlias,
          `${baseMessageId}-${index}@example.com`,
          'ses',
          `test-raw-ref-${index}`,
          correlationId
        )
      );

      const results = await Promise.all(duplicatePromises);

      // All should be processed (different messageIds)
      results.forEach(result => {
        expect(result.isDuplicate).toBe(false);
        expect(result.shouldProcess).toBe(true);
      });

      // Verify processing logs were created
      const { data: processingLogs } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('org_id', testOrg.id)
        .eq('step', 'idempotency_check');

      expect(processingLogs).toHaveLength(10);
    });
  });

  describe('Idempotency Statistics and Monitoring', () => {
    it('should track duplicate detection statistics', async () => {
      const baseMessageId = 'test-statistics';
      const correlationId = loggingService.generateCorrelationId();

      // Create some original and duplicate messages
      const messageIds = [
        'test-stats-001@example.com',
        'test-stats-002@example.com',
        'test-stats-001@example.com', // Duplicate of first
        'test-stats-003@example.com',
        'test-stats-002@example.com', // Duplicate of second
      ];

      for (const messageId of messageIds) {
        await idempotencyService.checkIdempotency(
          testOrg.id,
          testAlias,
          messageId,
          'ses',
          `raw-ref-${messageId}`,
          correlationId
        );
      }

      // Get statistics
      const stats = await idempotencyService.getIdempotencyStatistics(testOrg.id, 1);

      expect(stats.totalChecks).toBe(5);
      expect(stats.duplicatesFound).toBe(2);
      expect(stats.duplicateRate).toBeCloseTo(40, 1); // 2/5 = 40%
      expect(stats.providerBreakdown).toHaveLength(1);
      expect(stats.providerBreakdown[0].provider).toBe('ses');
      expect(stats.providerBreakdown[0].count).toBe(5);
      expect(stats.providerBreakdown[0].duplicates).toBe(2);
    });

    it('should provide complete audit trail for duplicate messages', async () => {
      const messageId = 'test-audit-complete-001@example.com';
      const rawRef = 'chiphi-raw-emails/inbound/test-audit-complete.eml';
      const correlationId = loggingService.generateCorrelationId();

      // First check
      await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      // Second check (duplicate)
      await idempotencyService.checkIdempotency(
        testOrg.id,
        testAlias,
        messageId,
        'ses',
        rawRef,
        correlationId
      );

      // Get complete audit trail
      const auditTrail = await idempotencyService.getAuditTrail(testOrg.id, messageId);

      expect(auditTrail.idempotencyRecord).toBeDefined();
      expect(auditTrail.idempotencyRecord?.messageId).toBe(messageId);
      expect(auditTrail.idempotencyRecord?.rawRef).toBe(rawRef);
      expect(auditTrail.rawRef).toBe(rawRef);

      expect(auditTrail.processingLogs.length).toBeGreaterThanOrEqual(2);
      
      // Verify log sequence
      const idempotencyLogs = auditTrail.processingLogs
        .filter(log => log.step === 'idempotency_check')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      expect(idempotencyLogs).toHaveLength(2);
      expect(idempotencyLogs[0].details?.isDuplicate).toBe(false);
      expect(idempotencyLogs[1].details?.isDuplicate).toBe(true);
      expect(idempotencyLogs[1].details?.existingRecordId).toBeDefined();
    });
  });
});