import { NextRequest, NextResponse } from 'next/server';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics';
import { getServerAuth } from '@/lib/services/server-auth';
import { z } from 'zod';

const trendQuerySchema = z.object({
  periodDays: z.coerce.number().min(7).max(365).optional().default(30)
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
      periodDays: searchParams.get('periodDays')
    };

    const validatedParams = trendQuerySchema.parse(queryParams);
    const analyticsService = new AdvancedAnalyticsService();

    const trendAnalysis = await analyticsService.analyzeSpendingTrend(
      org.id,
      validatedParams.periodDays
    );

    return NextResponse.json({
      success: true,
      data: trendAnalysis
    });

  } catch (error) {
    console.error('Error analyzing spending trend:', error);
    
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
        error: error instanceof Error ? error.message : 'Failed to analyze spending trend'
      },
      { status: 500 }
    );
  }
}