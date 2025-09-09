import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for report filters
const reportFiltersSchema = z.object({
  timeRange: z.enum(['last7', 'last30', 'last90', 'mtd', 'custom']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categories: z.string().optional(), // Comma-separated categories
  search: z.string().optional(),
});

interface MTDData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

interface SpendingTrendPoint {
  date: string;
  amount: number;
  transactionCount: number;
}

// Simple in-memory cache for request deduplication (development only)
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds cache TTL

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const correlationId = request.headers.get('X-Correlation-ID') || `server_${Date.now()}`;
    
    // Create cache key from search params for deduplication
    const cacheKey = searchParams.toString();
    const requestTime = Date.now();
    
    // Check cache for recent identical requests (development optimization)
    if (process.env.NODE_ENV === 'development' && requestCache.has(cacheKey)) {
      const cached = requestCache.get(cacheKey)!;
      if (requestTime - cached.timestamp < CACHE_TTL) {
        console.log(`[${correlationId}] Returning cached response for: ${cacheKey}`);
        return NextResponse.json({
          success: true,
          data: {
            ...cached.data,
            correlationId: `${correlationId}_cached`,
          },
        });
      }
    }
    
    // Parse and validate query parameters
    const filters = reportFiltersSchema.parse({
      timeRange: searchParams.get('timeRange') || 'last30',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      categories: searchParams.get('categories') || undefined,
      search: searchParams.get('search') || undefined,
    });

    // Log request for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${correlationId}] Reports API request:`, {
        filters,
        userAgent: request.headers.get('user-agent')?.substring(0, 50),
        referer: request.headers.get('referer'),
      });
    }

    const supabase = await createClient();
    
    // Get current user and their organization
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organizations (use first one if multiple exist)
    const { data: memberships, error: membershipError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const membership = memberships[0];

    // Build date range filter
    let startDate: string;
    let endDate: string;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (filters.timeRange) {
      case 'last7':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        endDate = today;
        break;
      case 'last30':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        endDate = today;
        break;
      case 'last90':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        endDate = today;
        break;
      case 'mtd':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = today;
        break;
      case 'custom':
        if (!filters.startDate || !filters.endDate) {
          return NextResponse.json({ error: 'Start and end dates required for custom range' }, { status: 400 });
        }
        startDate = filters.startDate;
        endDate = filters.endDate;
        break;
      default:
        return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }

    // Parse categories filter
    const categoryFilter = filters.categories ? filters.categories.split(',').map(c => c.trim()) : [];

    // Fetch MTD data
    const mtdData = await fetchMTDData(supabase, membership.org_id, startDate, endDate, categoryFilter, filters.search);
    
    // Fetch category breakdown data
    const categoryData = await fetchCategoryData(supabase, membership.org_id, startDate, endDate, categoryFilter, filters.search);
    
    // Fetch spending trend data
    const trendData = await fetchTrendData(supabase, membership.org_id, startDate, endDate, categoryFilter, filters.search);

    const responseData = {
      mtd: mtdData,
      categories: categoryData,
      trend: trendData,
      correlationId,
    };

    // Cache the response for deduplication (development only)
    if (process.env.NODE_ENV === 'development') {
      requestCache.set(cacheKey, { data: responseData, timestamp: requestTime });
      
      // Clean up old cache entries
      for (const [key, value] of requestCache.entries()) {
        if (requestTime - value.timestamp > CACHE_TTL) {
          requestCache.delete(key);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request parameters' },
        { status: 400 }
      );
    }

    console.error('Error in reports data API:', error);
    return NextResponse.json(
      { error: 'Internal server error', retryable: true },
      { status: 500 }
    );
  }
}

async function fetchMTDData(
  supabase: any,
  orgId: string,
  startDate: string,
  endDate: string,
  categories: string[],
  search?: string
): Promise<MTDData> {
  // Build base query
  let query = supabase
    .from('transactions')
    .select('amount')
    .eq('org_id', orgId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Apply filters
  if (categories.length > 0) {
    query = query.in('category', categories);
  }

  if (search) {
    query = query.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data: currentTransactions, error: currentError } = await query;

  if (currentError) {
    console.error('Error fetching current MTD data:', currentError);
    throw new Error('Failed to fetch current period data');
  }

  // Calculate current total
  const current = currentTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

  // Calculate previous period for comparison
  const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(new Date(startDate).getTime() - daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prevEndDate = new Date(new Date(endDate).getTime() - daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let prevQuery = supabase
    .from('transactions')
    .select('amount')
    .eq('org_id', orgId)
    .gte('date', prevStartDate)
    .lte('date', prevEndDate);

  if (categories.length > 0) {
    prevQuery = prevQuery.in('category', categories);
  }

  if (search) {
    prevQuery = prevQuery.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data: previousTransactions } = await prevQuery;
  const previous = previousTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

  // Calculate change
  const change = current - previous;
  const changePercentage = previous > 0 ? (change / previous) * 100 : 0;

  return {
    current,
    previous,
    change,
    changePercentage,
  };
}

async function fetchCategoryData(
  supabase: any,
  orgId: string,
  startDate: string,
  endDate: string,
  categories: string[],
  search?: string
): Promise<CategoryBreakdown[]> {
  // Build base query
  let query = supabase
    .from('transactions')
    .select('category, amount')
    .eq('org_id', orgId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Apply filters
  if (categories.length > 0) {
    query = query.in('category', categories);
  }

  if (search) {
    query = query.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('Error fetching category data:', error);
    throw new Error('Failed to fetch category breakdown data');
  }

  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Group by category and calculate totals
  const categoryTotals = transactions.reduce((acc, transaction) => {
    const category = transaction.category || 'Uncategorized';
    const amount = Math.abs(transaction.amount);
    
    if (!acc[category]) {
      acc[category] = { total: 0, count: 0 };
    }
    
    acc[category].total += amount;
    acc[category].count += 1;
    
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  // Calculate total for percentages
  const grandTotal = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.total, 0);

  // Convert to array and sort by amount
  const categoryData: CategoryBreakdown[] = Object.entries(categoryTotals)
    .map(([category, data]) => ({
      category,
      amount: data.total,
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return categoryData;
}

async function fetchTrendData(
  supabase: any,
  orgId: string,
  startDate: string,
  endDate: string,
  categories: string[],
  search?: string
): Promise<SpendingTrendPoint[]> {
  // Build base query
  let query = supabase
    .from('transactions')
    .select('date, amount')
    .eq('org_id', orgId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  // Apply filters
  if (categories.length > 0) {
    query = query.in('category', categories);
  }

  if (search) {
    query = query.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('Error fetching trend data:', error);
    throw new Error('Failed to fetch spending trend data');
  }

  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Group by date and calculate daily totals
  const dailyTotals = transactions.reduce((acc, transaction) => {
    const date = transaction.date;
    const amount = Math.abs(transaction.amount);
    
    if (!acc[date]) {
      acc[date] = { total: 0, count: 0 };
    }
    
    acc[date].total += amount;
    acc[date].count += 1;
    
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  // Convert to array and sort by date
  const trendData: SpendingTrendPoint[] = Object.entries(dailyTotals)
    .map(([date, data]) => ({
      date,
      amount: data.total,
      transactionCount: data.count,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return trendData;
}