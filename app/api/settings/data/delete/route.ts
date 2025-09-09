import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for data deletion request
const deleteDataSchema = z.object({
  dataTypes: z.array(z.enum([
    'transactions',
    'emails', 
    'merchantMappings',
    'processingLogs',
    'notifications'
  ])).min(1, 'At least one data type must be selected'),
});

export async function DELETE(request: NextRequest) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins and owners can delete organization data
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete organization data' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = deleteDataSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { dataTypes } = validationResult.data;
    const supabase = await createClient();

    // Use the database function to delete selected data types
    const { data, error } = await supabase
      .rpc('delete_organization_data', {
        p_org_id: session.org.id,
        p_user_id: session.user.id,
        p_data_types: dataTypes
      });

    if (error) {
      console.error('Error deleting data:', error);
      
      // Handle specific error cases
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to delete data' },
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
        { error: 'Failed to delete data' },
        { status: 500 }
      );
    }

    // Log the data deletion for audit purposes
    console.log(`Data deleted: org_id=${session.org.id}, user_id=${session.user.id}, types=${dataTypes.join(',')}, deleted_count=${data?.deleted_count || 0}`);

    return NextResponse.json({
      success: true,
      message: 'Data deleted successfully',
      deletedCount: data?.deleted_count || 0,
      deletedTypes: dataTypes
    });

  } catch (error) {
    console.error('Error in DELETE /api/settings/data/delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}