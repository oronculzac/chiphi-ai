import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

export async function DELETE() {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only owners can delete the entire account/organization
    if (session.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only organization owners can delete the account' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Use the database function to delete the entire organization
    const { data, error } = await supabase
      .rpc('delete_organization_account', {
        p_org_id: session.org.id,
        p_user_id: session.user.id
      });

    if (error) {
      console.error('Error deleting account:', error);
      
      // Handle specific error cases
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to delete account' },
          { status: 403 }
        );
      }
      
      if (error.message.includes('Organization not found')) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    // Log the account deletion for audit purposes
    console.log(`Account deleted: org_id=${session.org.id}, user_id=${session.user.id}, deleted_count=${data?.deleted_count || 0}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
      deletedCount: data?.deleted_count || 0
    });

  } catch (error) {
    console.error('Error in DELETE /api/settings/account/delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}