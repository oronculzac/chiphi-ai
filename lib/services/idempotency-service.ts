import { createAdminClient } from '@/lib/supabase/admin';
import { loggingService } from './logging-service';

/**
 * Idempotency Service for Email Processing
 * 
 * This service ensures that emails are processed only once per organization
 * by checking (alias, messageId) uniqueness and maintaining audit trails
 * with S3 rawRef references.
 * 
 * Requirements covered:
 * - 4.1: Check (alias, messageId) uniqueness per organization
 * - 4.2: Return success without reprocessing for duplicates
 * - 4.3: Include rawRef pointing to S3 object for audit
 */

export interface IdempotencyRecord {
  id: string;
  orgId: string;
  alias: string;
  messageId: string;
  emailId?: string;
  rawRef?: string;
  provider: 'ses' | 'cloudflare';
  processedAt: string;
  correlationId?: string;
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingRecord?: IdempotencyRecord;
  shouldProcess: boolean;
  reason?: string;
}

export class IdempotencyService {
  private supabase;

  constructor() {
    this.supabase = createAdminClient();
  }

  /**
   * Check if an email should be processed based on (alias, messageId) uniqueness
   * per organization
   */
  async checkIdempotency(
    orgId: string,
    alias: string,
    messageId: string,
    provider: 'ses' | 'cloudflare' = 'ses',
    rawRef?: string,
    correlationId?: string
  ): Promise<IdempotencyCheckResult> {
    const startTime = Date.now();

    try {
      // Check for existing record by (org_id, alias, message_id)
      const { data: existingRecord, error } = await this.supabase
        .from('email_idempotency_records')
        .select('*')
        .eq('org_id', orgId)
        .eq('alias', alias)
        .eq('message_id', messageId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Database error checking idempotency: ${error.message}`);
      }

      const processingTimeMs = Date.now() - startTime;

      if (existingRecord) {
        // Duplicate found - log and return existing record
        await loggingService.logProcessingStep({
          orgId,
          emailId: existingRecord.email_id || '',
          step: 'idempotency_check',
          status: 'completed',
          details: {
            isDuplicate: true,
            alias,
            messageId,
            existingRecordId: existingRecord.id,
            existingProcessedAt: existingRecord.processed_at,
            existingRawRef: existingRecord.raw_ref,
            provider,
            processingTimeMs,
          },
          processingTimeMs,
          correlationId,
        });

        return {
          isDuplicate: true,
          existingRecord: {
            id: existingRecord.id,
            orgId: existingRecord.org_id,
            alias: existingRecord.alias,
            messageId: existingRecord.message_id,
            emailId: existingRecord.email_id,
            rawRef: existingRecord.raw_ref,
            provider: existingRecord.provider as 'ses' | 'cloudflare',
            processedAt: existingRecord.processed_at,
            correlationId: existingRecord.correlation_id,
          },
          shouldProcess: false,
          reason: 'Message already processed for this alias and organization',
        };
      }

      // No duplicate found - create new record
      const newRecord = await this.createIdempotencyRecord(
        orgId,
        alias,
        messageId,
        provider,
        rawRef,
        correlationId
      );

      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'idempotency_check',
        status: 'completed',
        details: {
          isDuplicate: false,
          alias,
          messageId,
          newRecordId: newRecord.id,
          provider,
          rawRef,
          processingTimeMs,
        },
        processingTimeMs,
        correlationId,
      });

      return {
        isDuplicate: false,
        shouldProcess: true,
        reason: 'New message, proceeding with processing',
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'idempotency_check',
        status: 'failed',
        details: {
          alias,
          messageId,
          provider,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs,
        },
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
        correlationId,
      });

      // On error, allow processing to continue (fail open)
      console.error('Idempotency check failed:', error);
      return {
        isDuplicate: false,
        shouldProcess: true,
        reason: 'Idempotency check failed, allowing processing to continue',
      };
    }
  }

  /**
   * Create a new idempotency record
   */
  private async createIdempotencyRecord(
    orgId: string,
    alias: string,
    messageId: string,
    provider: 'ses' | 'cloudflare',
    rawRef?: string,
    correlationId?: string
  ): Promise<IdempotencyRecord> {
    const { data, error } = await this.supabase
      .from('email_idempotency_records')
      .insert({
        org_id: orgId,
        alias,
        message_id: messageId,
        provider,
        raw_ref: rawRef,
        correlation_id: correlationId,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create idempotency record: ${error.message}`);
    }

    return {
      id: data.id,
      orgId: data.org_id,
      alias: data.alias,
      messageId: data.message_id,
      emailId: data.email_id,
      rawRef: data.raw_ref,
      provider: data.provider as 'ses' | 'cloudflare',
      processedAt: data.processed_at,
      correlationId: data.correlation_id,
    };
  }

  /**
   * Update idempotency record with email ID after email is created
   */
  async updateIdempotencyRecordWithEmailId(
    recordId: string,
    emailId: string,
    correlationId?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_idempotency_records')
        .update({
          email_id: emailId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);

      if (error) {
        throw new Error(`Failed to update idempotency record: ${error.message}`);
      }

      console.log('Updated idempotency record with email ID', {
        recordId,
        emailId,
        correlationId,
      });

    } catch (error) {
      console.error('Failed to update idempotency record with email ID:', error);
      // Don't throw error as this is not critical for processing
    }
  }

  /**
   * Get idempotency statistics for monitoring
   */
  async getIdempotencyStatistics(
    orgId?: string,
    hoursBack = 24
  ): Promise<{
    totalChecks: number;
    duplicatesFound: number;
    duplicateRate: number;
    providerBreakdown: Array<{ provider: string; count: number; duplicates: number }>;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      let query = this.supabase
        .from('email_idempotency_records')
        .select('provider, created_at')
        .gte('created_at', cutoffTime.toISOString());

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data: records, error } = await query;

      if (error) {
        throw new Error(`Failed to get idempotency statistics: ${error.message}`);
      }

      // Get processing logs for duplicate detection
      let logQuery = this.supabase
        .from('processing_logs')
        .select('details')
        .eq('step', 'idempotency_check')
        .gte('created_at', cutoffTime.toISOString());

      if (orgId) {
        logQuery = logQuery.eq('org_id', orgId);
      }

      const { data: logs, error: logError } = await logQuery;

      if (logError) {
        console.error('Failed to get processing logs for statistics:', logError);
      }

      const totalChecks = logs?.length || 0;
      const duplicatesFound = logs?.filter(log => 
        log.details && log.details.isDuplicate === true
      ).length || 0;

      const duplicateRate = totalChecks > 0 ? (duplicatesFound / totalChecks) * 100 : 0;

      // Calculate provider breakdown
      const providerStats = new Map<string, { count: number; duplicates: number }>();
      
      logs?.forEach(log => {
        if (log.details && log.details.provider) {
          const provider = log.details.provider;
          const current = providerStats.get(provider) || { count: 0, duplicates: 0 };
          current.count++;
          if (log.details.isDuplicate) {
            current.duplicates++;
          }
          providerStats.set(provider, current);
        }
      });

      const providerBreakdown = Array.from(providerStats.entries()).map(([provider, stats]) => ({
        provider,
        count: stats.count,
        duplicates: stats.duplicates,
      }));

      return {
        totalChecks,
        duplicatesFound,
        duplicateRate,
        providerBreakdown,
      };

    } catch (error) {
      console.error('Error getting idempotency statistics:', error);
      return {
        totalChecks: 0,
        duplicatesFound: 0,
        duplicateRate: 0,
        providerBreakdown: [],
      };
    }
  }

  /**
   * Clean up old idempotency records to prevent database bloat
   */
  async cleanupOldRecords(retentionDays = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from('email_idempotency_records')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup old idempotency records: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      console.log('Old idempotency records cleaned up', { deletedCount, retentionDays });

      return deletedCount;

    } catch (error) {
      console.error('Idempotency records cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific message
   */
  async getAuditTrail(
    orgId: string,
    messageId: string
  ): Promise<{
    idempotencyRecord?: IdempotencyRecord;
    processingLogs: Array<{
      step: string;
      status: string;
      timestamp: string;
      details?: any;
      processingTimeMs?: number;
    }>;
    rawRef?: string;
  }> {
    try {
      // Get idempotency record
      const { data: idempotencyRecord, error: idempotencyError } = await this.supabase
        .from('email_idempotency_records')
        .select('*')
        .eq('org_id', orgId)
        .eq('message_id', messageId)
        .single();

      if (idempotencyError && idempotencyError.code !== 'PGRST116') {
        throw new Error(`Failed to get idempotency record: ${idempotencyError.message}`);
      }

      // Get processing logs
      const { data: processingLogs, error: logsError } = await this.supabase
        .from('processing_logs')
        .select('step, status, created_at, details, processing_time_ms')
        .eq('org_id', orgId)
        .or(`details->>messageId.eq.${messageId},email_id.eq.${idempotencyRecord?.email_id || 'none'}`)
        .order('created_at', { ascending: true });

      if (logsError) {
        console.error('Failed to get processing logs for audit trail:', logsError);
      }

      return {
        idempotencyRecord: idempotencyRecord ? {
          id: idempotencyRecord.id,
          orgId: idempotencyRecord.org_id,
          alias: idempotencyRecord.alias,
          messageId: idempotencyRecord.message_id,
          emailId: idempotencyRecord.email_id,
          rawRef: idempotencyRecord.raw_ref,
          provider: idempotencyRecord.provider as 'ses' | 'cloudflare',
          processedAt: idempotencyRecord.processed_at,
          correlationId: idempotencyRecord.correlation_id,
        } : undefined,
        processingLogs: (processingLogs || []).map(log => ({
          step: log.step,
          status: log.status,
          timestamp: log.created_at,
          details: log.details,
          processingTimeMs: log.processing_time_ms,
        })),
        rawRef: idempotencyRecord?.raw_ref,
      };

    } catch (error) {
      console.error('Error getting audit trail:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const idempotencyService = new IdempotencyService();