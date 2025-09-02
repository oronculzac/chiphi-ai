import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { 
  Transaction, 
  InsertTransaction, 
  UpdateTransaction,
  ReceiptData,
  TranslationResult,
  ProcessingError,
  ProcessingErrorType
} from '@/lib/types';
import { aiProcessingPipeline, ProcessingResult } from './ai-processing-pipeline';
import { logProcessingStep } from '@/lib/database/utils';
import { transactionDb } from '@/lib/database/transaction-operations';

/**
 * Transaction Processing and Storage Service
 * 
 * This service handles the creation, validation, and storage of transactions
 * by combining AI extraction with merchant mapping, implementing PII redaction,
 * and providing confidence threshold handling.
 * 
 * Requirements covered:
 * - 3.1: Extract data into structured JSON format
 * - 3.2: Include confidence score and explanation
 * - 3.3: Store only last4 digits and redact full PANs
 * - 7.3: Encrypt sensitive data at rest
 * - 7.4: Redact PAN numbers and 2FA codes
 */
export class TransactionProcessor {
  private supabase;
  private adminSupabase;

  // Confidence thresholds
  private readonly MIN_CONFIDENCE_THRESHOLD = 30;
  private readonly HIGH_CONFIDENCE_THRESHOLD = 80;

  // PII patterns for redaction
  private readonly PAN_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  private readonly PARTIAL_PAN_PATTERN = /\b\d{4}[-\s]?\*{4,8}[-\s]?\*{4,8}[-\s]?\d{4}\b/g;
  private readonly CVV_PATTERN = /\b\d{3,4}\b/g;
  private readonly SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;
  private readonly PHONE_PATTERN = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

  constructor() {
    this.supabase = createClient();
    this.adminSupabase = createAdminClient();
  }

  /**
   * Process email content and create transaction
   * Requirements: 3.1, 3.2, 3.3, 7.3, 7.4
   */
  async processEmailToTransaction(
    emailId: string,
    orgId: string,
    emailContent: string,
    userId?: string
  ): Promise<Transaction> {
    const startTime = Date.now();

    try {
      // Log processing start
      await logProcessingStep(
        orgId,
        emailId,
        'transaction_processing',
        'started',
        { emailContentLength: emailContent.length }
      );

      // Step 1: Redact PII from email content before AI processing
      const redactedContent = this.redactPII(emailContent);

      // Step 2: Process through AI pipeline
      const processingResult = await aiProcessingPipeline.processReceiptText(
        redactedContent,
        orgId
      );

      // Step 3: Validate processing result
      this.validateProcessingResult(processingResult);

      // Step 4: Create transaction from processing result
      const transaction = await this.createTransactionFromResult(
        emailId,
        orgId,
        processingResult,
        userId
      );

      const processingTime = Date.now() - startTime;

      // Log successful processing
      await logProcessingStep(
        orgId,
        emailId,
        'transaction_processing',
        'completed',
        {
          transactionId: transaction.id,
          confidence: transaction.confidence,
          processingTimeMs: processingTime,
          appliedMapping: processingResult.appliedMapping
        },
        undefined,
        processingTime
      );

      return transaction;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log processing failure
      await logProcessingStep(
        orgId,
        emailId,
        'transaction_processing',
        'failed',
        { error: errorMessage },
        errorMessage,
        processingTime
      );

      // Create processing error
      const processingError: ProcessingError = {
        type: ProcessingErrorType.EXTRACTION_FAILED,
        message: `Transaction processing failed: ${errorMessage}`,
        details: { emailId, orgId, processingTime },
        retryable: this.isRetryableError(error)
      };

      throw processingError;
    }
  }

  /**
   * Create transaction record from AI processing result
   * Requirements: 3.1, 3.2, 3.3
   */
  private async createTransactionFromResult(
    emailId: string,
    orgId: string,
    result: ProcessingResult,
    userId?: string
  ): Promise<Transaction> {
    const { receiptData, translationResult } = result;

    // Prepare transaction data with additional PII redaction
    const transactionData: InsertTransaction = {
      org_id: orgId,
      email_id: emailId,
      date: receiptData.date,
      amount: receiptData.amount,
      currency: receiptData.currency,
      merchant: receiptData.merchant,
      last4: this.extractLast4(receiptData.last4),
      category: receiptData.category,
      subcategory: receiptData.subcategory,
      notes: this.redactPII(receiptData.notes || ''),
      confidence: receiptData.confidence,
      explanation: receiptData.explanation,
      original_text: this.redactPII(translationResult.originalText),
      translated_text: translationResult.sourceLanguage.toLowerCase() !== 'english' 
        ? this.redactPII(translationResult.translatedText) 
        : null,
      source_language: translationResult.sourceLanguage.toLowerCase() !== 'english' 
        ? translationResult.sourceLanguage 
        : null
    };

    // Insert transaction using admin client for RLS bypass
    const { data, error } = await this.adminSupabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return data;
  }

  /**
   * Update existing transaction
   * Requirements: 3.1, 3.2, 3.3, 7.4
   */
  async updateTransaction(
    transactionId: string,
    updates: Partial<UpdateTransaction>,
    orgId: string,
    userId: string
  ): Promise<Transaction> {
    try {
      // Redact PII from any text fields being updated
      const sanitizedUpdates: Partial<UpdateTransaction> = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      if (updates.notes) {
        sanitizedUpdates.notes = this.redactPII(updates.notes);
      }

      if (updates.last4) {
        sanitizedUpdates.last4 = this.extractLast4(updates.last4);
      }

      // Update using regular client to enforce RLS
      const { data, error } = await this.supabase
        .from('transactions')
        .update(sanitizedUpdates)
        .eq('id', transactionId)
        .eq('org_id', orgId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Transaction update failed: ${errorMessage}`);
    }
  }

  /**
   * Update transaction with merchant mapping learning
   * This method updates a transaction and also updates the merchant mapping
   * for future learning when category is changed.
   * Requirements: 4.2, 4.3, 3.1, 3.2
   */
  async updateTransactionWithLearning(
    transactionId: string,
    updates: Partial<UpdateTransaction>,
    orgId: string,
    userId: string
  ): Promise<Transaction> {
    try {
      // First update the transaction
      const updatedTransaction = await this.updateTransaction(
        transactionId, 
        updates, 
        orgId, 
        userId
      );

      // If category was updated, update merchant mapping for learning
      if (updates.category) {
        const { merchantMapService } = await import('./merchant-map');
        
        await merchantMapService.updateMapping(
          updatedTransaction.merchant,
          updates.category,
          updates.subcategory || null,
          orgId,
          userId
        );

        // Log the learning event
        await logProcessingStep(
          orgId,
          updatedTransaction.email_id,
          'merchant_mapping_update',
          'completed',
          {
            merchant: updatedTransaction.merchant,
            old_category: updatedTransaction.category,
            new_category: updates.category,
            subcategory: updates.subcategory
          }
        );
      }

      return updatedTransaction;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Transaction update with learning failed: ${errorMessage}`);
    }
  }

  /**
   * Get transaction by ID with org access check
   * Requirements: 7.3 (RLS enforcement)
   */
  async getTransaction(transactionId: string, orgId: string): Promise<Transaction | null> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('org_id', orgId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows returned
        }
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw new Error(`Failed to fetch transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transactions for organization with pagination and filtering
   * Requirements: 7.3 (RLS enforcement)
   */
  async getTransactions(
    orgId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      category?: string;
      minConfidence?: number;
      sortBy?: 'date' | 'amount' | 'confidence' | 'created_at';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        category,
        minConfidence,
        sortBy = 'date',
        sortOrder = 'desc'
      } = options;

      let query = this.supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId);

      // Apply filters
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (minConfidence !== undefined) {
        query = query.gte('confidence', minConfidence);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        transactions: data || [],
        total: count || 0
      };

    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(`Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete transaction with org access check
   * Requirements: 7.3 (RLS enforcement)
   */
  async deleteTransaction(transactionId: string, orgId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('org_id', orgId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Redact PII from text content
   * Requirements: 7.4
   */
  private redactPII(text: string): string {
    if (!text) return text;

    return text
      // Redact full credit card numbers
      .replace(this.PAN_PATTERN, (match) => {
        // Extract last 4 digits if possible
        const digits = match.replace(/\D/g, '');
        if (digits.length >= 4) {
          return `****-****-****-${digits.slice(-4)}`;
        }
        return '****-****-****-****';
      })
      // Redact CVV codes (3-4 digits that might be CVV)
      .replace(/\bCVV:?\s*(\d{3,4})\b/gi, 'CVV: ***')
      .replace(/\bCVC:?\s*(\d{3,4})\b/gi, 'CVC: ***')
      // Redact SSN
      .replace(this.SSN_PATTERN, '***-**-****')
      // Redact phone numbers in certain contexts
      .replace(/(?:phone|tel|mobile|cell):?\s*(\d{3}[-.]?\d{3}[-.]?\d{4})/gi, 'Phone: ***-***-****')
      // Redact 2FA codes (6 digit codes)
      .replace(/\b\d{6}\b/g, '******')
      // Redact email addresses in sensitive contexts
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***');
  }

  /**
   * Extract and validate last 4 digits from card number
   * Requirements: 3.3
   */
  private extractLast4(cardInfo: string | null): string | null {
    if (!cardInfo) return null;

    // Extract digits only
    const digits = cardInfo.replace(/\D/g, '');
    
    // Return last 4 digits if we have at least 4 digits
    if (digits.length >= 4) {
      return digits.slice(-4);
    }

    return null;
  }

  /**
   * Validate processing result meets minimum requirements
   * Requirements: 3.1, 3.2
   */
  private validateProcessingResult(result: ProcessingResult): void {
    const { receiptData } = result;

    // Check required fields
    if (!receiptData.date) {
      throw new Error('Missing required field: date');
    }

    if (!receiptData.amount || receiptData.amount <= 0) {
      throw new Error('Invalid or missing amount');
    }

    if (!receiptData.currency) {
      throw new Error('Missing required field: currency');
    }

    if (!receiptData.merchant) {
      throw new Error('Missing required field: merchant');
    }

    if (!receiptData.category) {
      throw new Error('Missing required field: category');
    }

    if (!receiptData.explanation) {
      throw new Error('Missing required field: explanation');
    }

    // Validate confidence score
    if (receiptData.confidence < 0 || receiptData.confidence > 100) {
      throw new Error('Invalid confidence score: must be between 0 and 100');
    }

    // Check minimum confidence threshold
    if (receiptData.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      throw new Error(`Confidence score ${receiptData.confidence} below minimum threshold ${this.MIN_CONFIDENCE_THRESHOLD}`);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(receiptData.date)) {
      throw new Error('Invalid date format: must be YYYY-MM-DD');
    }

    // Validate currency code
    const currencyRegex = /^[A-Z]{3}$/;
    if (!currencyRegex.test(receiptData.currency)) {
      throw new Error('Invalid currency format: must be 3-letter ISO code');
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network/timeout errors are retryable
      if (message.includes('timeout') || 
          message.includes('network') || 
          message.includes('connection')) {
        return true;
      }

      // Rate limit errors are retryable
      if (message.includes('rate limit') || 
          message.includes('too many requests')) {
        return true;
      }

      // Temporary service errors are retryable
      if (message.includes('service unavailable') || 
          message.includes('internal server error')) {
        return true;
      }
    }

    return false;
  }



  /**
   * Get comprehensive transaction statistics for dashboard analytics
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  async getTransactionStats(
    orgId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    monthToDateTotal: number;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
      count: number;
    }>;
    spendingTrend: Array<{
      date: string;
      amount: number;
    }>;
    recentTransactions: Transaction[];
  }> {
    try {
      // Use the comprehensive analytics database function for better performance
      const { data, error } = await this.supabase.rpc('get_comprehensive_analytics', {
        org_uuid: orgId
      });

      if (error) {
        throw error;
      }

      const analytics = data[0];
      if (!analytics) {
        // Return empty analytics if no data
        return {
          monthToDateTotal: 0,
          categoryBreakdown: [],
          spendingTrend: [],
          recentTransactions: []
        };
      }

      // Get recent transactions separately for better control
      const recentTransactions = await transactionDb.getRecentTransactions(orgId, 10);

      return {
        monthToDateTotal: Number(analytics.month_to_date_total || 0),
        categoryBreakdown: analytics.category_breakdown || [],
        spendingTrend: analytics.spending_trend || [],
        recentTransactions
      };

    } catch (error) {
      console.error('Error fetching comprehensive transaction statistics:', error);
      throw new Error(`Failed to fetch comprehensive transaction statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const transactionProcessor = new TransactionProcessor();