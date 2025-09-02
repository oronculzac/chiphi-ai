import { ParsedEmail } from '@/lib/types';
import { createServiceClient } from '@/lib/supabase/server';
import { loggingService } from './logging-service';
import crypto from 'crypto';

/**
 * Service for detecting duplicate emails to prevent processing the same receipt twice
 * Uses multiple strategies: message ID, content hash, and similarity detection
 */
export class DuplicateDetector {
  
  /**
   * Checks if an email is a duplicate using multiple detection strategies
   */
  async isDuplicate(
    email: ParsedEmail,
    orgId: string,
    correlationId: string
  ): Promise<{
    isDuplicate: boolean;
    reason?: string;
    existingEmailId?: string;
    confidence: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Strategy 1: Message ID check (most reliable)
      const messageIdResult = await this.checkByMessageId(email.messageId, orgId);
      if (messageIdResult.isDuplicate) {
        await this.logDuplicateDetection(
          orgId,
          email.messageId,
          'message_id',
          messageIdResult.confidence,
          correlationId,
          Date.now() - startTime
        );
        return messageIdResult;
      }
      
      // Strategy 2: Content hash check
      const contentHashResult = await this.checkByContentHash(email, orgId);
      if (contentHashResult.isDuplicate) {
        await this.logDuplicateDetection(
          orgId,
          email.messageId,
          'content_hash',
          contentHashResult.confidence,
          correlationId,
          Date.now() - startTime
        );
        return contentHashResult;
      }
      
      // Strategy 3: Similarity detection (for forwarded/modified emails)
      const similarityResult = await this.checkBySimilarity(email, orgId);
      if (similarityResult.isDuplicate) {
        await this.logDuplicateDetection(
          orgId,
          email.messageId,
          'similarity',
          similarityResult.confidence,
          correlationId,
          Date.now() - startTime
        );
        return similarityResult;
      }
      
      // Not a duplicate
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'duplicate_detection',
        status: 'completed',
        details: {
          messageId: email.messageId,
          isDuplicate: false,
          strategiesChecked: ['message_id', 'content_hash', 'similarity'],
          processingTimeMs: Date.now() - startTime,
        },
        processingTimeMs: Date.now() - startTime,
        correlationId,
      });
      
      return {
        isDuplicate: false,
        confidence: 0,
      };
      
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'duplicate_detection',
        status: 'failed',
        details: {
          messageId: email.messageId,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: Date.now() - startTime,
        },
        processingTimeMs: Date.now() - startTime,
        correlationId,
      });
      
      // On error, assume not duplicate to avoid blocking processing
      return {
        isDuplicate: false,
        confidence: 0,
      };
    }
  }
  
  /**
   * Checks for duplicates by message ID (most reliable method)
   */
  private async checkByMessageId(
    messageId: string,
    orgId: string
  ): Promise<{
    isDuplicate: boolean;
    reason?: string;
    existingEmailId?: string;
    confidence: number;
  }> {
    const supabase = createServiceClient();
    
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('id, message_id')
        .eq('org_id', orgId)
        .eq('message_id', messageId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (data) {
        return {
          isDuplicate: true,
          reason: 'Exact message ID match found',
          existingEmailId: (data as any).id,
          confidence: 100,
        };
      }
      
      return {
        isDuplicate: false,
        confidence: 0,
      };
      
    } catch (error) {
      console.error('Message ID duplicate check failed:', error);
      throw error;
    }
  }
  
  /**
   * Checks for duplicates by content hash
   */
  private async checkByContentHash(
    email: ParsedEmail,
    orgId: string
  ): Promise<{
    isDuplicate: boolean;
    reason?: string;
    existingEmailId?: string;
    confidence: number;
  }> {
    const supabase = createServiceClient();
    
    try {
      // Generate content hash
      const contentHash = this.generateContentHash(email);
      
      // Check if we've stored this hash before
      const { data, error } = await supabase
        .from('email_content_hashes')
        .select('email_id, content_hash')
        .eq('org_id', orgId)
        .eq('content_hash', contentHash)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (data) {
        return {
          isDuplicate: true,
          reason: 'Identical content hash found',
          existingEmailId: (data as any).email_id,
          confidence: 95,
        };
      }
      
      // Store hash for future duplicate detection
      await this.storeContentHash(email.messageId, contentHash, orgId);
      
      return {
        isDuplicate: false,
        confidence: 0,
      };
      
    } catch (error) {
      console.error('Content hash duplicate check failed:', error);
      // Don't throw error here, continue with other strategies
      return {
        isDuplicate: false,
        confidence: 0,
      };
    }
  }
  
  /**
   * Checks for duplicates by content similarity (for forwarded/modified emails)
   */
  private async checkBySimilarity(
    email: ParsedEmail,
    orgId: string
  ): Promise<{
    isDuplicate: boolean;
    reason?: string;
    existingEmailId?: string;
    confidence: number;
  }> {
    const supabase = createServiceClient();
    
    try {
      // Get recent emails from the same sender (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentEmails, error } = await supabase
        .from('emails')
        .select('id, message_id, parsed_content, from_email, subject')
        .eq('org_id', orgId)
        .eq('from_email', email.from)
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(20); // Check last 20 emails from same sender
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!recentEmails || recentEmails.length === 0) {
        return {
          isDuplicate: false,
          confidence: 0,
        };
      }
      
      // Check similarity with each recent email
      for (const recentEmail of recentEmails) {
        const similarity = this.calculateContentSimilarity(
          email,
          (recentEmail as any).parsed_content
        );
        
        // Consider it a duplicate if similarity is very high
        if (similarity >= 0.9) {
          return {
            isDuplicate: true,
            reason: `High content similarity (${Math.round(similarity * 100)}%) with existing email`,
            existingEmailId: (recentEmail as any).id,
            confidence: Math.round(similarity * 100),
          };
        }
      }
      
      return {
        isDuplicate: false,
        confidence: 0,
      };
      
    } catch (error) {
      console.error('Similarity duplicate check failed:', error);
      // Don't throw error here, continue processing
      return {
        isDuplicate: false,
        confidence: 0,
      };
    }
  }
  
  /**
   * Generates a hash of the email content for duplicate detection
   */
  private generateContentHash(email: ParsedEmail): string {
    // Normalize content for hashing
    const normalizedContent = this.normalizeContentForHashing(email);
    
    // Create hash
    return crypto
      .createHash('sha256')
      .update(normalizedContent)
      .digest('hex');
  }
  
  /**
   * Normalizes email content for consistent hashing
   */
  private normalizeContentForHashing(email: ParsedEmail): string {
    // Combine key content fields
    const content = [
      email.subject || '',
      email.text || '',
      email.from || '',
    ].join('|');
    
    // Normalize whitespace and remove timestamps that might vary
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[Z\+\-\d:]+/g, 'TIMESTAMP') // Remove ISO timestamps
      .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi, 'DATETIME') // Remove date/time
      .replace(/message-id:\s*[^\s]+/gi, '') // Remove message IDs
      .replace(/received:\s*[^\n]+/gi, '') // Remove received headers
      .trim();
  }
  
  /**
   * Calculates content similarity between two emails
   */
  private calculateContentSimilarity(email1: ParsedEmail, email2: ParsedEmail): number {
    // Simple similarity calculation using Jaccard similarity
    const text1 = this.extractKeyContent(email1);
    const text2 = this.extractKeyContent(email2);
    
    if (!text1 || !text2) {
      return 0;
    }
    
    // Convert to word sets
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Extracts key content from email for similarity comparison
   */
  private extractKeyContent(email: ParsedEmail): string {
    // Focus on the main content, excluding headers and metadata
    const content = [
      email.subject || '',
      email.text || '',
    ].join(' ');
    
    // Remove common email artifacts that don't affect receipt content
    return content
      .replace(/^(from|to|subject|date):\s*[^\n]+/gim, '') // Remove headers
      .replace(/\b(unsubscribe|privacy|terms|conditions)\b[^\n]*/gi, '') // Remove legal text
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '') // Remove emails
      .trim();
  }
  
  /**
   * Stores content hash for future duplicate detection
   */
  private async storeContentHash(messageId: string, contentHash: string, orgId: string): Promise<void> {
    const supabase = createServiceClient();
    
    try {
      // First get the email ID
      const { data: emailData, error: emailError } = await supabase
        .from('emails')
        .select('id')
        .eq('message_id', messageId)
        .eq('org_id', orgId)
        .single();
      
      if (emailError || !emailData) {
        // Email might not be stored yet, skip hash storage
        return;
      }
      
      // Store the hash
      const { error } = await supabase
        .from('email_content_hashes')
        .insert({
          email_id: (emailData as any).id,
          org_id: orgId,
          content_hash: contentHash,
          created_at: new Date().toISOString(),
        } as any);
      
      if (error) {
        console.error('Failed to store content hash:', error);
        // Don't throw error, this is not critical
      }
      
    } catch (error) {
      console.error('Content hash storage failed:', error);
      // Don't throw error, this is not critical
    }
  }
  
  /**
   * Logs duplicate detection results
   */
  private async logDuplicateDetection(
    orgId: string,
    messageId: string,
    strategy: string,
    confidence: number,
    correlationId: string,
    processingTimeMs: number
  ): Promise<void> {
    await loggingService.logProcessingStep({
      orgId,
      emailId: '',
      step: 'duplicate_detection',
      status: 'completed',
      details: {
        messageId,
        isDuplicate: true,
        strategy,
        confidence,
        processingTimeMs,
      },
      processingTimeMs,
      correlationId,
    });
  }
  
  /**
   * Cleans up old content hashes to prevent database bloat
   */
  async cleanupOldHashes(orgId: string, retentionDays: number = 30): Promise<number> {
    const supabase = createServiceClient();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const { data, error } = await supabase
        .from('email_content_hashes')
        .delete()
        .eq('org_id', orgId)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');
      
      if (error) {
        console.error('Failed to cleanup old content hashes:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      
      const deletedCount = data?.length || 0;
      console.log('Old content hashes cleaned up', { orgId, deletedCount, retentionDays });
      
      return deletedCount;
      
    } catch (error) {
      console.error('Content hash cleanup failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const duplicateDetector = new DuplicateDetector();