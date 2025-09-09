'use client';

import React, { useState } from 'react';
import { SpendingTrendWidget } from './spending-trend-widget';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SpendingTrendPoint } from '@/lib/types';

// Simple seeded random number generator for consistent data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate sample data for different time ranges
function generateSampleData(timeRange: string): SpendingTrendPoint[] {
  const endDate = new Date('2025-09-03'); // Fixed date to avoid hydration issues
  let startDate = new Date('2025-09-03');
  let days = 30;

  switch (timeRange) {
    case 'last7':
      days = 7;
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'last30':
      days = 30;
      startDate.setDate(endDate.getDate() - 30);
      break;
    case 'last90':
      days = 90;
      startDate.setDate(endDate.getDate() - 90);
      break;
    case 'mtd':
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      days = endDate.getDate();
      break;
  }

  const data: SpendingTrendPoint[] = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < days; i++) {
    // Generate realistic spending patterns using seeded random
    const seed = i + (timeRange === 'last7' ? 100 : timeRange === 'last30' ? 200 : timeRange === 'last90' ? 300 : 400);
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    
    // Higher chance of spending on weekends, some days with no spending
    let amount = 0;
    const spendingChance = isWeekend ? 0.8 : 0.6;
    
    if (seededRandom(seed) < spendingChance) {
      // Generate amounts with realistic distribution
      if (isWeekend) {
        // Weekend spending tends to be higher (restaurants, entertainment)
        amount = seededRandom(seed + 1) * 150 + 20; // $20-$170
      } else {
        // Weekday spending (lunch, coffee, groceries)
        amount = seededRandom(seed + 1) * 80 + 5; // $5-$85
      }
      
      // Occasional larger purchases
      if (seededRandom(seed + 2) < 0.1) {
        amount += seededRandom(seed + 3) * 200 + 100; // Add $100-$300
      }
    }

    data.push({
      date: currentDate.toISOString().split('T')[0],
      amount: Math.round(amount * 100) / 100 // Round to 2 decimal places
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return data;
}

// Generate empty data
function generateEmptyData(): SpendingTrendPoint[] {
  return [];
}

// Generate sparse data (only a few data points)
function generateSparseData(timeRange: string): SpendingTrendPoint[] {
  const fullData = generateSampleData(timeRange);
  // Return only every 5th data point to simulate sparse data
  return fullData.filter((_, index) => index % 5 === 0 && Math.random() > 0.5);
}

export function SpendingTrendWidgetDemo() {
  const [timeRange, setTimeRange] = useState<string>('last30');
  const [dataType, setDataType] = useState<'normal' | 'empty' | 'sparse' | 'loading' | 'error'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate data based on current settings
  const getData = (): SpendingTrendPoint[] => {
    switch (dataType) {
      case 'empty':
        return generateEmptyData();
      case 'sparse':
        return generateSparseData(timeRange);
      case 'normal':
      default:
        return generateSampleData(timeRange);
    }
  };

  const handleDataTypeChange = (newDataType: string) => {
    const type = newDataType as typeof dataType;
    setDataType(type);
    
    if (type === 'loading') {
      setLoading(true);
      setError(null);
      // Simulate loading for 2 seconds
      setTimeout(() => {
        setLoading(false);
        setDataType('normal');
      }, 2000);
    } else if (type === 'error') {
      setLoading(false);
      setError('Failed to load spending trend data. Please try again.');
    } else {
      setLoading(false);
      setError(null);
    }
  };

  const handleRetry = () => {
    setError(null);
    setDataType('normal');
  };

  const data = dataType === 'loading' || dataType === 'error' ? [] : getData();

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Spending Trend Widget Demo</h2>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Range</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="last90">Last 90 Days</SelectItem>
                <SelectItem value="mtd">Month to Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data State</label>
            <Select value={dataType} onValueChange={handleDataTypeChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal Data</SelectItem>
                <SelectItem value="empty">Empty Data</SelectItem>
                <SelectItem value="sparse">Sparse Data</SelectItem>
                <SelectItem value="loading">Loading State</SelectItem>
                <SelectItem value="error">Error State</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Info */}
        <div className="text-sm text-muted-foreground">
          <p>Current state: {dataType}</p>
          <p>Data points: {data.length}</p>
          <p>Time range: {timeRange}</p>
        </div>
      </div>

      {/* Widget */}
      <div className="max-w-2xl">
        <SpendingTrendWidget
          data={data}
          timeRange={timeRange}
          loading={loading}
          error={error}
          onRetry={handleRetry}
        />
      </div>

      {/* Sample Data Display */}
      {dataType === 'normal' && data.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sample Data (First 10 points)</h3>
          <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono">
            <pre className="whitespace-pre-wrap break-words text-foreground">{JSON.stringify(data.slice(0, 10), null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}