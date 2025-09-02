/**
 * Performance Monitoring API
 * Provides endpoints for retrieving performance metrics and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/services/performance-monitor';
import { merchantMapCache } from '@/lib/services/merchant-map-cache';
import { dashboardSubscriptionManager } from '@/lib/services/realtime-optimizer';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const querySchema = z.object({
  metric: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  org_id: z.string().optional(),
  type: z.enum(['stats', 'slow-operations', 'ai-costs', 'cache-stats', 'realtime-stats']).optional()
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      metric: searchParams.get('metric'),
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      org_id: searchParams.get('org_id'),
      type: searchParams.get('type')
    });

    // Default date range (last 24 hours)
    const endDate = query.end_date ? new Date(query.end_date) : new Date();
    const startDate = query.start_date ? new Date(query.start_date) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    switch (query.type) {
      case 'stats':
        if (!query.metric) {
          return NextResponse.json({ error: 'Metric name required for stats' }, { status: 400 });
        }
        
        const stats = await performanceMonitor.getPerformanceStats(
          query.metric,
          startDate,
          endDate,
          query.org_id
        );
        
        return NextResponse.json({ stats });

      case 'slow-operations':
        const slowOps = await performanceMonitor.getSlowOperations(
          10,
          startDate,
          endDate,
          query.org_id
        );
        
        return NextResponse.json({ slow_operations: slowOps });

      case 'ai-costs':
        const aiCosts = await performanceMonitor.getAICostBreakdown(
          startDate,
          endDate,
          query.org_id
        );
        
        return NextResponse.json({ ai_costs: aiCosts });

      case 'cache-stats':
        const cacheStats = merchantMapCache.getStats();
        const topMerchants = merchantMapCache.getTopMerchants(10);
        
        return NextResponse.json({ 
          cache_stats: cacheStats,
          top_merchants: topMerchants
        });

      case 'realtime-stats':
        const realtimeStats = dashboardSubscriptionManager.getStats();
        
        return NextResponse.json({ realtime_stats: realtimeStats });

      default:
        // Return overview of all performance metrics
        const overview = {
          cache_stats: merchantMapCache.getStats(),
          realtime_stats: dashboardSubscriptionManager.getStats(),
          timestamp: new Date().toISOString()
        };

        // Get recent AI performance if org_id is provided
        if (query.org_id) {
          const recentAICosts = await performanceMonitor.getAICostBreakdown(
            new Date(Date.now() - 60 * 60 * 1000), // Last hour
            new Date(),
            query.org_id
          );
          overview['recent_ai_costs'] = recentAICosts;
        }

        return NextResponse.json(overview);
    }
  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'clear-cache':
        merchantMapCache.clear();
        return NextResponse.json({ message: 'Cache cleared successfully' });

      case 'warm-cache':
        // This would typically be called during application startup
        // or as a maintenance task
        const { warmMerchantMapCache } = await import('@/lib/services/merchant-map-cache');
        await warmMerchantMapCache(supabase);
        return NextResponse.json({ message: 'Cache warmed successfully' });

      case 'cleanup-subscriptions':
        dashboardSubscriptionManager.cleanup();
        return NextResponse.json({ message: 'Subscriptions cleaned up' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Performance API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}