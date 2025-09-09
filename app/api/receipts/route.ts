import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Get query parameters
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user's organization (first one if multiple)
    const { data: orgMembers } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)

    if (!orgMembers || orgMembers.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgMember = orgMembers[0]

    // Build query
    let query = supabase
      .from('transactions')
      .select(`
        id,
        date,
        amount,
        currency,
        merchant,
        last4,
        category,
        subcategory,
        notes,
        confidence,
        created_at
      `)
      .eq('org_id', orgMember.org_id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (search) {
      query = query.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`)
    }
    
    if (category && category !== 'All Categories') {
      query = query.eq('category', category)
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Error fetching transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Transform data to match the expected format
    const receipts = transactions?.map(transaction => ({
      id: transaction.id,
      date: transaction.date,
      merchant: transaction.merchant,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      category: transaction.category,
      subcategory: transaction.subcategory,
      status: 'processed', // All transactions in DB are processed
      confidence: transaction.confidence,
      last4: transaction.last4,
      notes: transaction.notes
    })) || []

    // Get total count for pagination
    let countQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgMember.org_id)

    if (search) {
      countQuery = countQuery.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`)
    }
    
    if (category && category !== 'All Categories') {
      countQuery = countQuery.eq('category', category)
    }

    const { count } = await countQuery

    return NextResponse.json({
      receipts,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0)
    })

  } catch (error) {
    console.error('Error in receipts API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}