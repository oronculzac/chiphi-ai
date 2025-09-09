'use client';

import React, { useState } from 'react';
import { CategoryBreakdownWidget } from './category-breakdown-widget';

// Mock data for demonstration
const mockCategoryData = [
  { category: 'Food & Dining', amount: 1250.75, percentage: 35.2, count: 28 },
  { category: 'Transportation', amount: 850.50, percentage: 23.9, count: 15 },
  { category: 'Shopping', amount: 620.25, percentage: 17.4, count: 22 },
  { category: 'Entertainment', amount: 380.00, percentage: 10.7, count: 12 },
  { category: 'Utilities', amount: 275.80, percentage: 7.8, count: 6 },
  { category: 'Healthcare', amount: 180.45, percentage: 5.1, count: 4 },
];

const mockLargeCategoryData = [
  { category: 'Food & Dining', amount: 1250.75, percentage: 25.0, count: 28 },
  { category: 'Transportation', amount: 850.50, percentage: 17.0, count: 15 },
  { category: 'Shopping', amount: 620.25, percentage: 12.4, count: 22 },
  { category: 'Entertainment', amount: 380.00, percentage: 7.6, count: 12 },
  { category: 'Utilities', amount: 275.80, percentage: 5.5, count: 6 },
  { category: 'Healthcare', amount: 180.45, percentage: 3.6, count: 4 },
  { category: 'Education', amount: 150.00, percentage: 3.0, count: 3 },
  { category: 'Travel', amount: 125.30, percentage: 2.5, count: 2 },
  { category: 'Insurance', amount: 100.00, percentage: 2.0, count: 1 },
  { category: 'Subscriptions', amount: 85.75, percentage: 1.7, count: 8 },
  { category: 'Gifts', amount: 75.50, percentage: 1.5, count: 5 },
  { category: 'Personal Care', amount: 65.25, percentage: 1.3, count: 4 },
];

export function CategoryBreakdownWidgetDemo() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useEmptyData, setUseEmptyData] = useState(false);
  const [useLargeData, setUseLargeData] = useState(false);

  const handleCategoryClick = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const currentData = useEmptyData ? [] : useLargeData ? mockLargeCategoryData : mockCategoryData;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Category Breakdown Widget Demo</h2>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setLoading(!loading)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Toggle Loading: {loading ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={() => setError(error ? null : 'Failed to load category data')}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Toggle Error: {error ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={() => setUseEmptyData(!useEmptyData)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Empty Data: {useEmptyData ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={() => setUseLargeData(!useLargeData)}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Large Dataset (12 categories): {useLargeData ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={() => setSelectedCategories([])}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Clear Filters
          </button>
        </div>

        {/* Selected Categories Display */}
        {selectedCategories.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium mb-2">Selected Categories:</h3>
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map(category => (
                <span
                  key={category}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Widget */}
      <div className="max-w-2xl">
        <CategoryBreakdownWidget
          data={currentData}
          onCategoryClick={handleCategoryClick}
          selectedCategories={selectedCategories}
          loading={loading}
          error={error}
          onRetry={handleRetry}
        />
      </div>

      {/* Data Display */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Current Data:</h3>
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-auto whitespace-pre-wrap break-words text-foreground">
          {JSON.stringify(currentData, null, 2)}
        </pre>
      </div>
    </div>
  );
}