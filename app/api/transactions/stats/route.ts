import { NextRequest, NextResponse } from 'next/server';
import { transactionProcessor } from '@/lib/services/transaction-processor';
import { transactionDb } from '@/lib/database/transaction-operations';
import { getUserSession } from '@/lib/database/utils';
import { z } from 'zod';

/**
 * Transaction Statistics API endpoint
 * 
 * Provides aggregated statistics and analytics for transactions
 * including totals, averages, category breakdowns, and confidence metrics.
 * 
 * Requirements covered:
 * - Analytics support for dashboard
 * - 7.3: RLS enforcement through user session
 * - Performance optimized queries
 */

// Validation schema for query parameters
const statsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeIntegrity: z.coerce.boolean().default(false),
});

/**
 * GET /api/transactions/stats - Get transaction statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedParams = statsQuerySchema.parse(queryParams);

    // Build date range if provided
    const dateRange = validatedParams.startDate && validatedParams.endDate
      ? { start: validatedParams.startDate, end: validatedParams.endDate }
      : undefined;

    // Get transaction statistics
    const stats = await transactionProcessor.getTransactionStats(
      session.org.id,
      dateRange
    );

    // Get integrity check if requested
    let integrityIssues = undefined;
    if (validatedParams.includeIntegrity) {
      integrityIssues = await transactionDb.validateTransactionIntegrity(
        session.org.id
      );
    }

    // Get recent transactions for dashboard
    const recentTransactions = await transactionDb.getRecentTransactions(
      session.org.id,
      5
    );

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        recentTransactions,
        ...(integrityIssues && { integrityIssues }),
        dateRange,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error fetching transaction statistics:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}