import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/database/utils';
import { createClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to update organization (admin or owner)
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update organization logo' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `org-${session.org.id}-logo-${Date.now()}.${fileExtension}`;
    const filePath = `logos/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('organization-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('organization-assets')
      .getPublicUrl(filePath);

    const logoUrl = urlData.publicUrl;

    // Update organization with new logo URL
    const { data: updatedOrg, error: updateError } = await supabase
      .rpc('update_organization_info', {
        p_org_id: session.org.id,
        p_logo_url: logoUrl,
        p_updated_by: session.user.id
      });

    if (updateError) {
      console.error('Error updating organization logo:', updateError);
      
      // Clean up uploaded file if database update fails
      await supabase.storage
        .from('organization-assets')
        .remove([filePath]);

      return NextResponse.json(
        { error: 'Failed to update organization logo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedOrg,
      message: 'Logo uploaded successfully'
    });

  } catch (error) {
    console.error('Error in POST /api/settings/organization/logo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Check if user has permission to update organization (admin or owner)
    if (!['admin', 'owner'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update organization logo' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Get current organization to find existing logo URL
    const { data: currentOrg, error: fetchError } = await supabase
      .from('orgs')
      .select('logo_url')
      .eq('id', session.org.id)
      .single();

    if (fetchError) {
      console.error('Error fetching current organization:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      );
    }

    // Update organization to remove logo URL
    const { data: updatedOrg, error: updateError } = await supabase
      .rpc('update_organization_info', {
        p_org_id: session.org.id,
        p_logo_url: null,
        p_updated_by: session.user.id
      });

    if (updateError) {
      console.error('Error removing organization logo:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove organization logo' },
        { status: 500 }
      );
    }

    // Clean up the file from storage if it exists
    if (currentOrg.logo_url) {
      try {
        // Extract file path from URL
        const url = new URL(currentOrg.logo_url);
        const pathParts = url.pathname.split('/');
        const filePath = pathParts.slice(-2).join('/'); // Get 'logos/filename.ext'
        
        await supabase.storage
          .from('organization-assets')
          .remove([filePath]);
      } catch (storageError) {
        // Log but don't fail the request if storage cleanup fails
        console.warn('Failed to clean up logo file from storage:', storageError);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedOrg,
      message: 'Logo removed successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/settings/organization/logo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}