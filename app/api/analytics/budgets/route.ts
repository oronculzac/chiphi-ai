import { NextRequest, NextResponse } from 'next/server';
import { AdvancedAnalyticsService } from '@/lib/services/advanced-analytics';
import { getServerAuth } from '@/lib/services/server-auth';
import { z } from 'zod';

const createBudgetSchema = z.object({
  category: z.string().min(1),
  monthlyLimit: z.number().positive()
});

const updateBudgetSchema = z.object({
  budgetId: z.string().uuid(),
  monthlyLimit: z.number().positive().optional(),
  category: z.string().min(1).optional()
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
    const includeAlerts = searchParams.get('includeAlerts') === 'true';

    const analyticsService = new AdvancedAnalyticsService();
    const budgets = await analyticsService.getBudgets(org.id);

    let alerts = [];
    if (includeAlerts) {
      alerts = await analyticsService.getBudgetAlerts(org.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        budgets,
        alerts: includeAlerts ? alerts : undefined
      }
    });

  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch budgets'
      },
      { status: 500 }
    );
  }
}

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
    const validatedData = createBudgetSchema.parse(body);

    const analyticsService = new AdvancedAnalyticsService();
    const budget = await analyticsService.createBudget(
      org.id,
      validatedData.category,
      validatedData.monthlyLimit
    );

    return NextResponse.json({
      success: true,
      data: budget
    });

  } catch (error) {
    console.error('Error creating budget:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid budget data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create budget'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, org } = await getServerAuth();
    
    if (!user || !org) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updateBudgetSchema.parse(body);

    const analyticsService = new AdvancedAnalyticsService();
    
    try {
      const updatedBudget = await analyticsService.updateBudget(
        validatedData.budgetId,
        {
          monthlyLimit: validatedData.monthlyLimit,
          category: validatedData.category
        }
      );

      return NextResponse.json({
        success: true,
        data: updatedBudget
      });
    } catch (error) {
      // Budget updates not implemented yet
      return NextResponse.json({
        success: false,
        error: 'Budget updates require database table implementation',
        note: 'This feature will be available once budget storage is implemented'
      }, { status: 501 });
    }

  } catch (error) {
    console.error('Error updating budget:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid budget data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update budget'
      },
      { status: 500 }
    );
  }
}