import { NextRequest, NextResponse } from 'next/server';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics';
import { getServerAuth } from '@/lib/services/server-auth';
import { z } from 'zod';

const reportQuerySchema = z.object({
  type: z.enum(['monthly', 'yearly']),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2030),
  includePDF: z.coerce.boolean().optional().default(false)
});

export async function GET(request: NextRequest) {
  try {
    const { user, org } = await getServerAuth();
    
    if (!user || !org) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      type: searchParams.get('type'),
      month: searchParams.get('month'),
      year: searchParams.get('year'),
      includePDF: searchParams.get('includePDF')
    };

    const validatedParams = reportQuerySchema.parse(queryParams);
    const analyticsService = new AdvancedAnalyticsService();

    let report;
    
    if (validatedParams.type === 'monthly') {
      if (!validatedParams.month) {
        return NextResponse.json({
          success: false,
          error: 'Month is required for monthly reports'
        }, { status: 400 });
      }
      
      report = await analyticsService.generateMonthlyReport(
        org.id,
        validatedParams.month,
        validatedParams.year
      );
    } else {
      report = await analyticsService.generateYearlyReport(
        org.id,
        validatedParams.year
      );
    }

    // If PDF export is requested (placeholder)
    if (validatedParams.includePDF) {
      try {
        const pdfBuffer = await analyticsService.exportReportToPDF(report);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${validatedParams.type}-report-${validatedParams.year}${validatedParams.month ? `-${validatedParams.month}` : ''}.pdf"`
          }
        });
      } catch (error) {
        // PDF export not implemented yet, return JSON with note
        return NextResponse.json({
          success: true,
          data: report,
          note: 'PDF export is not yet implemented. Returning JSON data instead.'
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error generating report:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate report'
      },
      { status: 500 }
    );
  }
}

// Get available report periods
export async function POST(request: NextRequest) {
  try {
    const { user, org } = await getServerAuth();
    
    if (!user || !org) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'getAvailablePeriods') {
      const analyticsService = new AdvancedAnalyticsService();
      const periods = await analyticsService.getAvailableReportPeriods(org.id);
      
      return NextResponse.json({
        success: true,
        data: periods
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error processing report request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process request'
      },
      { status: 500 }
    );
  }
}