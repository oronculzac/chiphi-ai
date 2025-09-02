import { NextRequest, NextResponse } from 'next/server';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics';
import { getServerAuth } from '@/lib/services/server-auth';
import { z } from 'zod';

const compareQuerySchema = z.object({
  currentStart: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid current start date'
  }),
  currentEnd: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid current end date'
  }),
  comparisonStart: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid comparison start date'
  }),
  comparisonEnd: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid comparison end date'
  })
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
      currentStart: searchParams.get('currentStart'),
      currentEnd: searchParams.get('currentEnd'),
      comparisonStart: searchParams.get('comparisonStart'),
      comparisonEnd: searchParams.get('comparisonEnd')
    };

    const validatedParams = compareQuerySchema.parse(queryParams);
    const analyticsService = new AdvancedAnalyticsService();

    const comparison = await analyticsService.compareTimePeriods(
      org.id,
      new Date(validatedParams.currentStart),
      new Date(validatedParams.currentEnd),
      new Date(validatedParams.comparisonStart),
      new Date(validatedParams.comparisonEnd)
    );

    return NextResponse.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Error comparing time periods:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to compare time periods'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for predefined comparisons (this month vs last month, etc.)
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
    const { comparisonType } = body;

    const analyticsService = new AdvancedAnalyticsService();
    let comparison;

    const now = new Date();
    
    switch (comparisonType) {
      case 'thisMonthVsLastMonth': {
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        
        comparison = await analyticsService.compareTimePeriods(
          org.id,
          currentMonthStart,
          currentMonthEnd,
          lastMonthStart,
          lastMonthEnd
        );
        break;
      }
      
      case 'thisYearVsLastYear': {
        const currentYearStart = new Date(now.getFullYear(), 0, 1);
        const currentYearEnd = new Date(now.getFullYear(), 11, 31);
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        
        comparison = await analyticsService.compareTimePeriods(
          org.id,
          currentYearStart,
          currentYearEnd,
          lastYearStart,
          lastYearEnd
        );
        break;
      }
      
      case 'last30DaysVsPrevious30Days': {
        const currentEnd = new Date();
        const currentStart = new Date(currentEnd.getTime() - (30 * 24 * 60 * 60 * 1000));
        const comparisonEnd = new Date(currentStart.getTime() - (24 * 60 * 60 * 1000));
        const comparisonStart = new Date(comparisonEnd.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        comparison = await analyticsService.compareTimePeriods(
          org.id,
          currentStart,
          currentEnd,
          comparisonStart,
          comparisonEnd
        );
        break;
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid comparison type. Supported types: thisMonthVsLastMonth, thisYearVsLastYear, last30DaysVsPrevious30Days'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Error comparing periods:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to compare periods'
      },
      { status: 500 }
    );
  }
}