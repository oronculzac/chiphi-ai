/**
 * Performance Monitor Dashboard Component
 * Displays real-time performance metrics, AI costs, cache statistics,
 * and system health indicators for administrators and power users
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Database, 
  Zap, 
  TrendingUp, 
  Clock, 
  DollarSign,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Cpu,
  HardDrive
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface PerformanceStats {
  avg: number;
  min: number;
  max: number;
  count: number;
  p95: number;
  p99: number;
}

interface SlowOperation {
  metric_name: string;
  avg_value: number;
  max_value: number;
  count: number;
}

interface AICost {
  service: string;
  operation: string;
  total_cost: number;
  total_tokens: number;
  request_count: number;
}

interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
}

interface RealtimeStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  pendingUpdates: number;
  averageThrottle: number;
}

interface PerformanceData {
  cache_stats: CacheStats;
  realtime_stats: RealtimeStats;
  recent_ai_costs?: AICost[];
  slow_operations?: SlowOperation[];
  timestamp: string;
}

export function PerformanceMonitorDashboard({ orgId }: { orgId?: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPerformanceData = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      
      const response = await fetch(`/api/performance?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }
      
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlowOperations = async () => {
    try {
      const params = new URLSearchParams({ type: 'slow-operations' });
      if (orgId) params.set('org_id', orgId);
      
      const response = await fetch(`/api/performance?${params}`);
      if (!response.ok) return;
      
      const result = await response.json();
      setData(prev => prev ? { ...prev, slow_operations: result.slow_operations } : null);
    } catch (err) {
      console.error('Failed to fetch slow operations:', err);
    }
  };

  const performAction = async (action: string) => {
    try {
      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      if (response.ok) {
        await fetchPerformanceData();
      }
    } catch (err) {
      console.error(`Failed to perform action ${action}:`, err);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    fetchSlowOperations();
  }, [orgId]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchPerformanceData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, orgId]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const getHealthStatus = (stats: CacheStats, realtimeStats: RealtimeStats) => {
    const cacheHealthy = stats.hitRate > 70;
    const realtimeHealthy = realtimeStats.pendingUpdates < 100;
    
    if (cacheHealthy && realtimeHealthy) return 'healthy';
    if (!cacheHealthy || !realtimeHealthy) return 'warning';
    return 'critical';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading performance data...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load performance data: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const healthStatus = getHealthStatus(data.cache_stats, data.realtime_stats);
  const totalAICost = data.recent_ai_costs?.reduce((sum, cost) => sum + cost.total_cost, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitor</h2>
          <p className="text-muted-foreground">
            System performance and optimization insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={healthStatus === 'healthy' ? 'default' : 'destructive'}>
            {healthStatus === 'healthy' ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {healthStatus.toUpperCase()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPerformanceData()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.cache_stats.hitRate.toFixed(1)}%</div>
            <Progress value={data.cache_stats.hitRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data.cache_stats.cacheHits.toLocaleString()} hits / {data.cache_stats.totalRequests.toLocaleString()} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.realtime_stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {data.realtime_stats.pendingUpdates} pending updates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Costs (1h)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAICost)}</div>
            <p className="text-xs text-muted-foreground">
              {data.recent_ai_costs?.reduce((sum, cost) => sum + cost.request_count, 0) || 0} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Memory</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(data.cache_stats.memoryUsage)}</div>
            <p className="text-xs text-muted-foreground">
              {data.cache_stats.totalEntries} entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="cache" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cache">Cache Performance</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="ai-costs">AI Costs</TabsTrigger>
          <TabsTrigger value="slow-ops">Slow Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
                <CardDescription>Merchant mapping cache performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Total Requests</p>
                    <p className="text-2xl font-bold">{data.cache_stats.totalRequests.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Hit Rate</p>
                    <p className="text-2xl font-bold text-green-600">{data.cache_stats.hitRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Cache Hits</p>
                    <p className="text-2xl font-bold text-green-600">{data.cache_stats.cacheHits.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Cache Misses</p>
                    <p className="text-2xl font-bold text-red-600">{data.cache_stats.cacheMisses.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => performAction('clear-cache')}
                  >
                    Clear Cache
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => performAction('warm-cache')}
                  >
                    Warm Cache
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Hit Rate Visualization</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Hits', value: data.cache_stats.cacheHits, fill: '#22c55e' },
                        { name: 'Misses', value: data.cache_stats.cacheMisses, fill: '#ef4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                    >
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Subscription Performance</CardTitle>
              <CardDescription>Dashboard subscription optimization metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium">Total Subscriptions</p>
                  <p className="text-2xl font-bold">{data.realtime_stats.totalSubscriptions}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-2xl font-bold text-green-600">{data.realtime_stats.activeSubscriptions}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Pending Updates</p>
                  <p className="text-2xl font-bold">{data.realtime_stats.pendingUpdates}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Avg Throttle</p>
                  <p className="text-2xl font-bold">{Math.round(data.realtime_stats.averageThrottle)}ms</p>
                </div>
              </div>
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => performAction('cleanup-subscriptions')}
                >
                  Cleanup Subscriptions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-costs" className="space-y-4">
          {data.recent_ai_costs && data.recent_ai_costs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>AI Service Costs (Last Hour)</CardTitle>
                <CardDescription>Breakdown by service and operation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recent_ai_costs.map((cost, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{cost.service} - {cost.operation}</p>
                        <p className="text-sm text-muted-foreground">
                          {cost.request_count} requests • {cost.total_tokens.toLocaleString()} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(cost.total_cost)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(cost.total_cost / cost.request_count)}/req
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No AI costs recorded in the last hour</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="slow-ops" className="space-y-4">
          {data.slow_operations && data.slow_operations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Slow Operations</CardTitle>
                <CardDescription>Operations taking longer than 100ms on average</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.slow_operations.map((op, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{op.metric_name}</p>
                        <p className="text-sm text-muted-foreground">{op.count} executions</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{op.avg_value.toFixed(1)}ms avg</p>
                        <p className="text-sm text-muted-foreground">{op.max_value.toFixed(1)}ms max</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground">No slow operations detected</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
        </div>
        {orgId && (
          <span>Organization: {orgId}</span>
        )}
      </div>
    </div>
  );
}