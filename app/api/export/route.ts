import { NextRequest, NextResponse } from 'next/server';
import { ExportService, ExportOptions } from '@/lib/services/export';
import { getServerAuth } from '@/lib/services/server-auth';
import { z } from 'zod';

// Validation schema for export request
const exportRequestSchema = z.object({
  format: z.enum(['csv', 'ynab']),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
  categories: z.array(z.string()).optional(),
});

/**
 * Export API Route
 * Implements requirements 8.1, 8.2, 8.4, 8.5
 * Handles both CSV and YNAB export formats with tenant-scoped access
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user and get organization (requirement 8.4)
    const { user, organization } = await getServerAuth();
    
    if (!user || !organization) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = exportRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { format, dateRange, categories } = validationResult.data;

    // Prepare export options
    const options: ExportOptions = {
      format,
      ...(dateRange && {
        dateRange: {
          start: new Date(dateRange.start!),
          end: new Date(dateRange.end!)
        }
      }),
      ...(categories && { categories })
    };

    // Execute export with tenant-scoped access (requirement 8.4)
    const exportService = new ExportService();
    const result = await exportService.exportTransactions(organization.id, options);

    if (result.success) {
      // Return successful export data
      return NextResponse.json({
        success: true,
        data: result.data,
        filename: result.filename
      });
    } else {
      // Handle export errors with clear messaging (requirement 8.5)
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          retryable: result.retryable
        },
        { status: result.retryable ? 500 : 400 }
      );
    }
  } catch (error) {
    console.error('Export API error:', error);
    
    // Provide clear error messaging (requirement 8.5)
    return NextResponse.json(
      {
        success: false,
        error: 'Export failed. Please try again.',
        retryable: true
      },
      { status: 500 }
    );
  }
}

/**
 * Get available export formats
 */
export async function GET() {
  try {
    // Authenticate user
    const { user } = await getServerAuth();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const exportService = new ExportService();
    const formats = exportService.getAvailableFormats();

    return NextResponse.json({
      success: true,
      formats
    });
  } catch (error) {
    console.error('Export formats API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get export formats'
      },
      { status: 500 }
    );
  }
}