import { NextRequest, NextResponse } from 'next/server';
import { GmailAliasGenerator } from '@/lib/services/gmail-alias-generator';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * API endpoint for managing Gmail aliases
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }
    
    // Get existing alias for the organization
    const alias = await GmailAliasGenerator.getAliasForOrg(orgId);
    
    if (!alias) {
      return NextResponse.json(
        { error: 'No alias found for this organization' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      alias,
      instructions: {
        message: 'Send your receipts using either method:',
        email: alias,
        methods: [
          {
            title: 'Method 1: Direct Email',
            description: 'Send or forward receipts directly to this address:',
            email: alias,
          },
          {
            title: 'Method 2: Subject Flag',
            description: 'Add [AICHIPHI] to the subject line and send to:',
            email: 'oronculzac@gmail.com',
            example: 'Subject: [AICHIPHI] Your receipt from Starbucks',
          },
        ],
        example: 'Forward receipt emails from your bank, credit card, or any merchant using either method.',
      },
    });
  } catch (error) {
    console.error('Error fetching alias:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await request.json();
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }
    
    // Verify organization exists
    const supabase = createServiceClient();
    const { data: org, error: orgError } = await supabase
      .from('orgs')
      .select('id, name')
      .eq('id', orgId)
      .single();
    
    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Get or create alias
    const alias = await GmailAliasGenerator.getOrCreateAlias(orgId);
    
    return NextResponse.json({
      success: true,
      alias,
      organization: org.name,
      instructions: {
        message: 'Your receipt processing email address has been created!',
        email: alias,
        methods: [
          {
            title: 'Method 1: Direct Email',
            description: 'Send or forward receipts directly to:',
            email: alias,
          },
          {
            title: 'Method 2: Subject Flag',
            description: 'Add [AICHIPHI] to subject and send to:',
            email: 'oronculzac@gmail.com',
            example: 'Subject: [AICHIPHI] Your receipt from Starbucks',
          },
        ],
        steps: [
          '1. Forward receipt emails using either method above',
          '2. Our AI will automatically extract transaction data',
          '3. View processed receipts in your dashboard',
          '4. Export data to CSV or YNAB format',
        ],
      },
    });
  } catch (error) {
    console.error('Error creating alias:', error);
    return NextResponse.json(
      { error: 'Failed to create alias' },
      { status: 500 }
    );
  }
}

// Admin endpoint to list all aliases
export async function PUT(request: NextRequest) {
  try {
    const aliases = await GmailAliasGenerator.getAllAliases();
    
    return NextResponse.json({
      success: true,
      aliases,
      total: aliases.length,
      baseEmail: 'oronculzac@gmail.com',
    });
  } catch (error) {
    console.error('Error fetching all aliases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aliases' },
      { status: 500 }
    );
  }
}