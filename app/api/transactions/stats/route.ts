import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';
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

    // Set default date range to current month (Month to Date)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const endOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;
    
    const startDate = validatedParams.startDate || startOfMonth;
    const endDate = validatedParams.endDate || endOfMonth;

    const supabase = await createClient();

    // Get month-to-date totals
    const { data: totalsData, error: totalsError } = await supabase.rpc('fn_report_totals', {
      p_org_id: session.org.id,
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (totalsError) {
      throw totalsError;
    }

    // Get category breakdown
    const { data: categoryData, error: categoryError } = await supabase.rpc('fn_report_by_category', {
      p_org_id: session.org.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_categories: null
    });

    if (categoryError) {
      throw categoryError;
    }

    // Get daily spending trend
    const { data: dailyData, error: dailyError } = await supabase.rpc('fn_report_daily', {
      p_org_id: session.org.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_categories: null,
      p_search: null
    });

    if (dailyError) {
      throw dailyError;
    }

    // Get recent transactions
    const { data: recentTransactions, error: recentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('org_id', session.org.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      throw recentError;
    }

    return NextResponse.json({
      success: true,
      data: {
        monthToDateTotal: Number(totalsData?.[0]?.current_total || 0),
        categoryBreakdown: (categoryData || []).map((item: any) => ({
          category: item.category,
          amount: Number(item.amount),
          percentage: Number(item.percentage),
          count: Number(item.count)
        })),
        spendingTrend: (dailyData || []).map((item: any) => ({
          date: item.date,
          amount: Number(item.amount)
        })),
        recentTransactions: recentTransactions || [],
        dateRange: { start: startDate, end: endDate },
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