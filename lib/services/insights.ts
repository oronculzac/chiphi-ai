import { createClient } from '@/lib/supabase/client';
import { InsightQuery, InsightResult } from '@/lib/types';

// Predefined analytics queries for security (Requirement 6.5)
const PREDEFINED_INSIGHTS: InsightQuery[] = [
    {
        id: 'monthly_spending',
        question: 'How much did I spend this month?',
        description: 'Shows total spending for the current month',
        category: 'spending'
    },
    {
        id: 'top_categories',
        question: 'What are my top spending categories?',
        description: 'Shows categories with highest spending amounts',
        category: 'categories'
    },
    {
        id: 'spending_trend',
        question: 'How has my spending changed over time?',
        description: 'Shows spending trends over the last 30 days',
        category: 'trends'
    },
    {
        id: 'top_merchants',
        question: 'Which merchants do I spend the most at?',
        description: 'Shows merchants with highest transaction amounts',
        category: 'merchants'
    },
    {
        id: 'weekly_average',
        question: 'What is my average weekly spending?',
        description: 'Calculates average spending per week over the last 8 weeks',
        category: 'spending'
    },
    {
        id: 'category_comparison',
        question: 'How does this month compare to last month by category?',
        description: 'Compares current month spending to previous month by category',
        category: 'categories'
    },
    {
        id: 'high_confidence_transactions',
        question: 'How many transactions have high confidence scores?',
        description: 'Shows percentage of transactions with confidence > 80%',
        category: 'spending'
    },
    {
        id: 'recent_activity',
        question: 'What has been my recent spending activity?',
        description: 'Shows spending activity over the last 7 days',
        category: 'trends'
    }
];

export class InsightsService {
    private supabase = createClient();

    // Get all available insight queries
    getAvailableInsights(): InsightQuery[] {
        return PREDEFINED_INSIGHTS;
    }

    // Match natural language query to predefined insights
    matchQuery(userQuery: string): InsightQuery | null {
        const query = userQuery.toLowerCase().trim();

        // Simple keyword matching for natural language queries
        const keywords = {
            monthly_spending: ['month', 'monthly', 'this month', 'current month', 'total'],
            top_categories: ['categories', 'category', 'top categories', 'spending categories'],
            spending_trend: ['trend', 'trends', 'over time', 'change', 'pattern'],
            top_merchants: ['merchants', 'merchant', 'stores', 'where', 'top merchants'],
            weekly_average: ['weekly', 'week', 'average', 'per week'],
            category_comparison: ['compare', 'comparison', 'last month', 'previous month'],
            high_confidence_transactions: ['confidence', 'accurate', 'high confidence'],
            recent_activity: ['recent', 'lately', 'last week', '7 days', 'activity']
        };

        // Find best match based on keyword overlap
        let bestMatch: InsightQuery | null = null;
        let maxMatches = 0;

        for (const [insightId, insightKeywords] of Object.entries(keywords)) {
            const matches = insightKeywords.filter(keyword =>
                query.includes(keyword)
            ).length;

            if (matches > maxMatches) {
                maxMatches = matches;
                bestMatch = PREDEFINED_INSIGHTS.find(insight => insight.id === insightId) || null;
            }
        }

        return bestMatch;
    }

    // Execute predefined analytics function (Requirement 6.4)
    async executeInsight(insightId: string, orgId: string): Promise<InsightResult> {
        const insight = PREDEFINED_INSIGHTS.find(i => i.id === insightId);
        if (!insight) {
            throw new Error('Invalid insight query');
        }

        try {
            switch (insightId) {
                case 'monthly_spending':
                    return await this.getMonthlySpending(orgId);

                case 'top_categories':
                    return await this.getTopCategories(orgId);

                case 'spending_trend':
                    return await this.getSpendingTrend(orgId);

                case 'top_merchants':
                    return await this.getTopMerchants(orgId);

                case 'weekly_average':
                    return await this.getWeeklyAverage(orgId);

                case 'category_comparison':
                    return await this.getCategoryComparison(orgId);

                case 'high_confidence_transactions':
                    return await this.getHighConfidenceTransactions(orgId);

                case 'recent_activity':
                    return await this.getRecentActivity(orgId);

                default:
                    throw new Error('Insight not implemented');
            }
        } catch (error) {
            console.error('Error executing insight:', error);
            throw new Error('Failed to generate insight');
        }
    }

    private async getMonthlySpending(orgId: string): Promise<InsightResult> {
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const { data, error } = await this.supabase.rpc('fn_report_totals', {
            p_org_id: orgId,
            p_start_date: startOfMonth.toISOString().split('T')[0],
            p_end_date: endOfMonth.toISOString().split('T')[0]
        });

        if (error) throw error;

        const result = data?.[0];
        const amount = parseFloat(result?.current_total || '0');
        return {
            query: 'How much did I spend this month?',
            answer: `You have spent ${amount.toFixed(2)} this month so far.`,
            data: { amount },
            visualization: 'metric',
            confidence: 100
        };
    }

    private async getTopCategories(orgId: string): Promise<InsightResult> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

        const { data, error } = await this.supabase.rpc('fn_report_by_category', {
            p_org_id: orgId,
            p_start_date: startDate.toISOString().split('T')[0],
            p_end_date: endDate.toISOString().split('T')[0]
        });

        if (error) throw error;

        const categories = data || [];
        const topCategory = categories[0];

        return {
            query: 'What are my top spending categories?',
            answer: topCategory
                ? `Your top spending category is "${topCategory.category}" with ${parseFloat(topCategory.amount).toFixed(2)} (${topCategory.percentage}% of total spending).`
                : 'No spending data available for categories.',
            data: categories.slice(0, 5),
            visualization: 'chart',
            confidence: 95
        };
    }

    private async getSpendingTrend(orgId: string): Promise<InsightResult> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        const { data, error } = await this.supabase.rpc('fn_report_daily', {
            p_org_id: orgId,
            p_start_date: startDate.toISOString().split('T')[0],
            p_end_date: endDate.toISOString().split('T')[0]
        });

        if (error) throw error;

        const trendData = data || [];
        const recentWeek = trendData.slice(-7);
        const previousWeek = trendData.slice(-14, -7);

        const recentAvg = recentWeek.reduce((sum: number, day: any) => sum + parseFloat(day.amount || '0'), 0) / 7;
        const previousAvg = previousWeek.reduce((sum: number, day: any) => sum + parseFloat(day.amount || '0'), 0) / 7;

        const change = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
        const trend = change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable';

        return {
            query: 'How has my spending changed over time?',
            answer: `Your spending trend is ${trend}. Your average daily spending this week is ${recentAvg.toFixed(2)} compared to ${previousAvg.toFixed(2)} last week.`,
            data: trendData,
            visualization: 'chart',
            confidence: 90
        };
    }

    private async getTopMerchants(orgId: string): Promise<InsightResult> {
        const { data, error } = await this.supabase
            .from('transactions')
            .select('merchant, amount')
            .eq('org_id', orgId)
            .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (error) throw error;

        const merchantTotals = (data || []).reduce((acc: Record<string, number>, transaction: any) => {
            const merchant = transaction.merchant;
            acc[merchant] = (acc[merchant] || 0) + parseFloat(transaction.amount);
            return acc;
        }, {});

        const sortedMerchants = Object.entries(merchantTotals)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5);

        const topMerchant = sortedMerchants[0];

        return {
            query: 'Which merchants do I spend the most at?',
            answer: topMerchant
                ? `Your top merchant is "${topMerchant[0]}" with ${(topMerchant[1] as number).toFixed(2)} in spending.`
                : 'No merchant data available.',
            data: sortedMerchants.map(([merchant, amount]) => ({ merchant, amount })),
            visualization: 'table',
            confidence: 95
        };
    }

    private async getWeeklyAverage(orgId: string): Promise<InsightResult> {
        const { data, error } = await this.supabase
            .from('transactions')
            .select('amount, date')
            .eq('org_id', orgId)
            .gte('date', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (error) throw error;

        const total = (data || []).reduce((sum: number, transaction: any) =>
            sum + parseFloat(transaction.amount), 0
        );

        const weeklyAverage = total / 8; // 8 weeks

        return {
            query: 'What is my average weekly spending?',
            answer: `Your average weekly spending over the last 8 weeks is ${weeklyAverage.toFixed(2)}.`,
            data: { weeklyAverage, totalSpending: total, weeks: 8 },
            visualization: 'metric',
            confidence: 90
        };
    }

    private async getCategoryComparison(orgId: string): Promise<InsightResult> {
        const currentMonth = new Date();
        const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const currentMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const lastMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

        const [currentData, lastData] = await Promise.all([
            this.supabase.rpc('fn_report_by_category', {
                p_org_id: orgId,
                p_start_date: currentMonthStart.toISOString().split('T')[0],
                p_end_date: currentMonthEnd.toISOString().split('T')[0]
            }),
            this.supabase.rpc('fn_report_by_category', {
                p_org_id: orgId,
                p_start_date: lastMonth.toISOString().split('T')[0],
                p_end_date: lastMonthEnd.toISOString().split('T')[0]
            })
        ]);

        if (currentData.error || lastData.error) {
            throw currentData.error || lastData.error;
        }

        const currentCategories = currentData.data || [];
        const lastMonthCategories = lastData.data || [];

        const lastMonthMap = lastMonthCategories.reduce((acc: Record<string, number>, cat: any) => {
            acc[cat.category] = parseFloat(cat.amount);
            return acc;
        }, {});

        const comparison = currentCategories.map((current: any) => {
            const lastAmount = lastMonthMap[current.category] || 0;
            const currentAmount = parseFloat(current.amount);
            const change = lastAmount > 0 ? ((currentAmount - lastAmount) / lastAmount) * 100 : 0;
            return {
                category: current.category,
                currentAmount,
                lastAmount,
                change: isFinite(change) ? change : 0
            };
        });

        const biggestIncrease = comparison.reduce((max: any, cat: any) =>
            cat.change > max.change ? cat : max, comparison[0] || { category: 'None', change: 0 }
        );

        return {
            query: 'How does this month compare to last month by category?',
            answer: biggestIncrease.category !== 'None'
                ? `The biggest change is in "${biggestIncrease.category}" with a ${biggestIncrease.change > 0 ? 'increase' : 'decrease'} of ${Math.abs(biggestIncrease.change).toFixed(1)}%.`
                : 'No comparison data available.',
            data: comparison,
            visualization: 'table',
            confidence: 85
        };
    }

    private async getHighConfidenceTransactions(orgId: string): Promise<InsightResult> {
        const { data, error } = await this.supabase
            .from('transactions')
            .select('confidence')
            .eq('org_id', orgId)
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (error) throw error;

        const transactions = data || [];
        const highConfidence = transactions.filter((t: any) => t.confidence > 80).length;
        const percentage = transactions.length > 0 ? (highConfidence / transactions.length) * 100 : 0;

        return {
            query: 'How many transactions have high confidence scores?',
            answer: `${percentage.toFixed(1)}% of your transactions (${highConfidence} out of ${transactions.length}) have high confidence scores (>80%).`,
            data: { highConfidence, total: transactions.length, percentage },
            visualization: 'metric',
            confidence: 100
        };
    }

    private async getRecentActivity(orgId: string): Promise<InsightResult> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

        const { data, error } = await this.supabase.rpc('fn_report_daily', {
            p_org_id: orgId,
            p_start_date: startDate.toISOString().split('T')[0],
            p_end_date: endDate.toISOString().split('T')[0]
        });

        if (error) throw error;

        const recentData = data || [];
        const total = recentData.reduce((sum: number, day: any) => sum + parseFloat(day.amount || '0'), 0);
        const dailyAverage = total / 7;
        const activeDays = recentData.filter((day: any) => parseFloat(day.amount || '0') > 0).length;

        return {
            query: 'What has been my recent spending activity?',
            answer: `In the last 7 days, you spent ${total.toFixed(2)} across ${activeDays} days, averaging ${dailyAverage.toFixed(2)} per day.`,
            data: { total, dailyAverage, activeDays, recentData },
            visualization: 'chart',
            confidence: 95
        };
    }
}