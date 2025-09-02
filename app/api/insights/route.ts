import { NextRequest, NextResponse } from 'next/server';
import { InsightsService } from '@/lib/services/insights';
import { getServerAuth } from '@/lib/services/server-auth';

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
    const query = searchParams.get('query');
    const insightId = searchParams.get('insightId');

    const insightsService = new InsightsService();

    // If no query or insightId provided, return available insights
    if (!query && !insightId) {
      const availableInsights = insightsService.getAvailableInsights();
      return NextResponse.json({
        success: true,
        data: {
          availableInsights,
          message: 'Available insight queries'
        }
      });
    }

    let targetInsightId = insightId;

    // If query provided, try to match it to a predefined insight
    if (query && !insightId) {
      const matchedInsight = insightsService.matchQuery(query);
      if (!matchedInsight) {
        return NextResponse.json({
          success: false,
          error: 'Could not understand your question. Please try asking about spending, categories, trends, or merchants.',
          availableInsights: insightsService.getAvailableInsights()
        }, { status: 400 });
      }
      targetInsightId = matchedInsight.id;
    }

    if (!targetInsightId) {
      return NextResponse.json({
        success: false,
        error: 'No insight query specified'
      }, { status: 400 });
    }

    // Execute the insight
    const result = await insightsService.executeInsight(targetInsightId, org.id);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error processing insight request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process insight request'
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
    const { query, insightId } = body;

    if (!query && !insightId) {
      return NextResponse.json({
        success: false,
        error: 'Query or insightId is required'
      }, { status: 400 });
    }

    const insightsService = new InsightsService();
    let targetInsightId = insightId;

    // If query provided, try to match it to a predefined insight
    if (query && !insightId) {
      const matchedInsight = insightsService.matchQuery(query);
      if (!matchedInsight) {
        return NextResponse.json({
          success: false,
          error: 'Could not understand your question. Please try asking about spending, categories, trends, or merchants.',
          suggestions: insightsService.getAvailableInsights().map(insight => insight.question)
        }, { status: 400 });
      }
      targetInsightId = matchedInsight.id;
    }

    if (!targetInsightId) {
      return NextResponse.json({
        success: false,
        error: 'No insight query specified'
      }, { status: 400 });
    }

    // Execute the insight
    const result = await insightsService.executeInsight(targetInsightId, org.id);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error processing insight request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process insight request'
      },
      { status: 500 }
    );
  }
}