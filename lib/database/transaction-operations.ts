import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { 
  Transaction, 
  InsertTransaction,
  UpdateTransaction
} from '@/lib/types';

/**
 * Database operations for transactions with RLS enforcement
 * 
 * This service provides a clean interface to transaction database operations
 * while ensuring proper security through RLS policies and database functions.
 * 
 * Requirements covered:
 * - 3.1: Structured data storage with validation
 * - 3.2: Confidence scoring and explanation storage
 * - 3.3: PII redaction and last4 handling
 * - 7.3: RLS enforcement for multi-tenant isolation
 * - 7.4: Secure data handling
 */
export class TransactionDatabaseOperations {
  private supabase;
  private adminSupabase;

  constructor() {
    this.supabase = createClient();
    this.adminSupabase = createAdminClient();
  }

  /**
   * Create transaction using database function with validation
   * Requirements: 3.1, 3.2, 3.3, 7.3, 7.4
   */
  async createTransaction(
    orgId: string,
    emailId: string,
    transactionData: {
      date: string;
      amount: number;
      currency: string;
      merchant: string;
      last4?: string | null;
      category: string;
      subcategory?: string | null;
      notes?: string | null;
      confidence: number;
      explanation: string;
      originalText?: string | null;
      translatedText?: string | null;
      sourceLanguage?: string | null;
    }
  ): Promise<string> {
    try {
      const { data, error } = await this.adminSupabase.rpc('create_transaction', {
        org_uuid: orgId,
        email_uuid: emailId,
        transaction_date: transactionData.date,
        amount_param: transactionData.amount,
        currency_param: transactionData.currency,
        merchant_param: transactionData.merchant,
        last4_param: transactionData.last4,
        category_param: transactionData.category,
        subcategory_param: transactionData.subcategory,
        notes_param: transactionData.notes,
        confidence_param: transactionData.confidence,
        explanation_param: transactionData.explanation,
        original_text_param: transactionData.originalText,
        translated_text_param: transactionData.translatedText,
        source_language_param: transactionData.sourceLanguage
      });

      if (error) {
        throw new Error(`Database function error: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error(`Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update transaction using database function with validation
   * Requirements: 3.1, 3.2, 3.3, 7.3
   */
  async updateTransaction(
    transactionId: string,
    orgId: string,
    userId: string,
    updates: Partial<{
      amount: number;
      currency: string;
      merchant: string;
      last4: string | null;
      category: string;
      subcategory: string | null;
      notes: string | null;
      confidence: number;
      explanation: string;
    }>
  ): Promise<boolean> {
    try {
      const { data, error } = await this.adminSupabase.rpc('update_transaction_safe', {
        transaction_uuid: transactionId,
        org_uuid: orgId,
        user_uuid: userId,
        amount_param: updates.amount,
        currency_param: updates.currency,
        merchant_param: updates.merchant,
        last4_param: updates.last4,
        category_param: updates.category,
        subcategory_param: updates.subcategory,
        notes_param: updates.notes,
        confidence_param: updates.confidence,
        explanation_param: updates.explanation
      });

      if (error) {
        throw new Error(`Database function error: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error updating transaction:', error);
      throw new Error(`Failed to update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction by ID with RLS enforcement
   * Requirements: 7.3
   */
  async getTransaction(transactionId: string): Promise<Transaction | null> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
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
   * Get transactions with filtering and pagination using database function
   * Requirements: 7.3
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

      const { data, error } = await this.supabase.rpc('get_transactions_filtered', {
        org_uuid: orgId,
        limit_param: limit,
        offset_param: offset,
        start_date: startDate,
        end_date: endDate,
        category_filter: category,
        min_confidence: minConfidence,
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (error) {
        throw error;
      }

      const transactions = data || [];
      const total = transactions.length > 0 ? transactions[0].total_count : 0;

      // Remove total_count from transaction objects
      const cleanTransactions = transactions.map(({ total_count, ...transaction }) => transaction);

      return {
        transactions: cleanTransactions,
        total: Number(total)
      };

    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(`Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete transaction with audit logging
   * Requirements: 7.3
   */
  async deleteTransaction(
    transactionId: string,
    orgId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.adminSupabase.rpc('delete_transaction_safe', {
        transaction_uuid: transactionId,
        org_uuid: orgId,
        user_uuid: userId
      });

      if (error) {
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transaction statistics using database function
   * Requirements: Analytics support
   */
  async getTransactionStats(
    orgId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalTransactions: number;
    totalAmount: number;
    averageConfidence: number;
    lowConfidenceCount: number;
    categoryBreakdown: Array<{ category: string; count: number; amount: number }>;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('get_transaction_stats', {
        org_uuid: orgId,
        start_date: dateRange?.start,
        end_date: dateRange?.end
      });

      if (error) {
        throw error;
      }

      const stats = data[0] || {
        total_transactions: 0,
        total_amount: 0,
        average_confidence: 0,
        low_confidence_count: 0,
        category_breakdown: []
      };

      return {
        totalTransactions: Number(stats.total_transactions),
        totalAmount: Number(stats.total_amount),
        averageConfidence: Number(stats.average_confidence),
        lowConfidenceCount: Number(stats.low_confidence_count),
        categoryBreakdown: stats.category_breakdown || []
      };

    } catch (error) {
      console.error('Error fetching transaction statistics:', error);
      throw new Error(`Failed to fetch transaction statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update transaction categories for merchant mapping corrections
   * Requirements: 4.2, 4.3
   */
  async bulkUpdateTransactionCategories(
    orgId: string,
    merchantName: string,
    newCategory: string,
    newSubcategory?: string | null,
    userId?: string
  ): Promise<number> {
    try {
      const { data, error } = await this.adminSupabase.rpc('bulk_update_transaction_categories', {
        org_uuid: orgId,
        merchant_name_param: merchantName,
        new_category: newCategory,
        new_subcategory: newSubcategory,
        user_uuid: userId
      });

      if (error) {
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error bulk updating transaction categories:', error);
      throw new Error(`Failed to bulk update transaction categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate transaction data integrity for organization
   * Requirements: Data validation and monitoring
   */
  async validateTransactionIntegrity(orgId: string): Promise<Array<{
    issueType: string;
    issueCount: number;
    sampleIds: string[];
  }>> {
    try {
      const { data, error } = await this.supabase.rpc('validate_transaction_integrity', {
        org_uuid: orgId
      });

      if (error) {
        throw error;
      }

      return (data || []).map((issue: any) => ({
        issueType: issue.issue_type,
        issueCount: Number(issue.issue_count),
        sampleIds: issue.sample_ids || []
      }));

    } catch (error) {
      console.error('Error validating transaction integrity:', error);
      throw new Error(`Failed to validate transaction integrity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent transactions for dashboard
   * Requirements: Dashboard support
   */
  async getRecentTransactions(
    orgId: string,
    limit: number = 10
  ): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw new Error(`Failed to fetch recent transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transactions by date range for analytics
   * Requirements: Analytics support
   */
  async getTransactionsByDateRange(
    orgId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Error fetching transactions by date range:', error);
      throw new Error(`Failed to fetch transactions by date range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get transactions by category for analytics
   * Requirements: Analytics support
   */
  async getTransactionsByCategory(
    orgId: string,
    category: string,
    limit?: number
  ): Promise<Transaction[]> {
    try {
      let query = this.supabase
        .from('transactions')
        .select('*')
        .eq('org_id', orgId)
        .eq('category', category)
        .order('date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Error fetching transactions by category:', error);
      throw new Error(`Failed to fetch transactions by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const transactionDb = new TransactionDatabaseOperations();