import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for export request
const exportRequestSchema = z.object({
  format: z.enum(['csv', 'ynab']),
  timeRange: z.enum(['last7', 'last30', 'last90', 'mtd', 'custom']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categories: z.array(z.string()).optional(),
  search: z.string().optional(),
});

interface Transaction {
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  subcategory: string | null;
  notes: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const exportRequest = exportRequestSchema.parse(body);

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

    switch (exportRequest.timeRange) {
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
        if (!exportRequest.startDate || !exportRequest.endDate) {
          return NextResponse.json({ error: 'Start and end dates required for custom range' }, { status: 400 });
        }
        startDate = exportRequest.startDate;
        endDate = exportRequest.endDate;
        break;
      default:
        return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('transactions')
      .select('date, amount, currency, merchant, category, subcategory, notes')
      .eq('org_id', membership.org_id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    // Apply category filter
    if (exportRequest.categories && exportRequest.categories.length > 0) {
      query = query.in('category', exportRequest.categories);
    }

    // Apply search filter
    if (exportRequest.search) {
      query = query.or(`merchant.ilike.%${exportRequest.search}%,notes.ilike.%${exportRequest.search}%`);
    }

    const { data: transactions, error: queryError } = await query;

    if (queryError) {
      console.error('Error fetching transactions:', queryError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Generate export data
    const csvData = generateExportData(transactions || [], exportRequest.format);
    const filename = generateFilename(exportRequest.format, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: csvData,
      filename,
      transactionCount: transactions?.length || 0,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    console.error('Error in export API:', error);
    return NextResponse.json(
      { error: 'Internal server error', retryable: true },
      { status: 500 }
    );
  }
}

function generateExportData(transactions: Transaction[], format: 'csv' | 'ynab'): string {
  if (format === 'csv') {
    return generateCSV(transactions);
  } else {
    return generateYNAB(transactions);
  }
}

function generateCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Amount', 'Currency', 'Merchant', 'Category', 'Subcategory', 'Notes'];
  const rows = transactions.map(t => [
    t.date,
    t.amount.toFixed(2),
    t.currency,
    escapeCSVField(t.merchant),
    escapeCSVField(t.category),
    escapeCSVField(t.subcategory || ''),
    escapeCSVField(t.notes || ''),
  ]);

  return [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
}

function generateYNAB(transactions: Transaction[]): string {
  const headers = ['Date', 'Payee', 'Category', 'Memo', 'Outflow', 'Inflow'];
  const rows = transactions.map(t => [
    t.date,
    escapeCSVField(t.merchant),
    escapeCSVField(t.category + (t.subcategory ? `: ${t.subcategory}` : '')),
    escapeCSVField(t.notes || ''),
    t.amount < 0 ? Math.abs(t.amount).toFixed(2) : '',
    t.amount > 0 ? t.amount.toFixed(2) : '',
  ]);

  return [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateFilename(format: 'csv' | 'ynab', startDate: string, endDate: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const dateRange = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
  return `chiphi_transactions_${dateRange}_${timestamp}.${format === 'ynab' ? 'csv' : 'csv'}`;
}