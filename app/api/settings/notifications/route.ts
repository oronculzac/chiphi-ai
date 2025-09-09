import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for notification preferences
const NotificationPreferencesSchema = z.object({
  receiptProcessed: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  summaryEmails: z.array(z.string().email()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get or create notification preferences using the database function
    const { data: preferences, error: prefsError } = await supabase
      .rpc('get_or_create_notification_prefs', {
        p_org_id: orgMember.org_id,
        p_user_id: user.id
      });

    if (prefsError) {
      console.error('Error fetching notification preferences:', prefsError);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Transform database format to API format
    const response = {
      receiptProcessed: preferences.receipt_processed,
      dailySummary: preferences.daily_summary,
      weeklySummary: preferences.weekly_summary,
      summaryEmails: preferences.summary_emails || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/settings/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = NotificationPreferencesSchema.parse(body);

    // Update notification preferences using the database function
    const { data: updatedPreferences, error: updateError } = await supabase
      .rpc('update_notification_prefs', {
        p_org_id: orgMember.org_id,
        p_user_id: user.id,
        p_receipt_processed: validatedData.receiptProcessed,
        p_daily_summary: validatedData.dailySummary,
        p_weekly_summary: validatedData.weeklySummary,
        p_summary_emails: validatedData.summaryEmails,
      });

    if (updateError) {
      console.error('Error updating notification preferences:', updateError);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    // Transform database format to API format
    const response = {
      receiptProcessed: updatedPreferences.receipt_processed,
      dailySummary: updatedPreferences.daily_summary,
      weeklySummary: updatedPreferences.weekly_summary,
      summaryEmails: updatedPreferences.summary_emails || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error in PUT /api/settings/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}