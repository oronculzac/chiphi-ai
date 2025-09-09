# Reports Data Fetching and State Management Hooks

This document describes the implementation of Task 8 from the Reports MVP: data fetching and state management hooks with enhanced error handling, retry mechanisms, and correlation ID tracking.

## Hooks Overview

### `useReportsData`

Enhanced data fetching hook using SWR for caching and real-time updates.

**Features:**
- Correlation ID tracking for debugging and monitoring
- Enhanced error handling with retry mechanisms
- Exponential backoff for failed requests
- Visibility change detection for stale data refresh
- Proper loading and error states
- Configurable refresh intervals and retry counts

**Usage:**
```typescript
import { useReportsData } from '@/hooks/use-reports-data';

const { 
  mtdData, 
  categoryData, 
  trendData,
  loading, 
  error, 
  refetch,
  correlationId,
  retryCount,
  lastUpdated
} = useReportsData({
  orgId: 'org-123',
  filters: {
    timeRange: 'last30',
    categories: ['Food & Dining'],
    search: 'restaurant'
  },
  refreshInterval: 30000, // 30 seconds
  enabled: true // Optional: disable fetching
});
```

### `useReportsFilters`

Filter state management hook with URL synchronization and debouncing.

**Features:**
- URL parameter synchronization for filter persistence
- Debounced search input to optimize API calls
- Filter validation (date ranges, formats)
- Clear all filters functionality
- Browser back/forward navigation support
- Callback support for filter changes

**Usage:**
```typescript
import { useReportsFilters } from '@/hooks/use-reports-filters';

const {
  filters,
  updateFilters,
  updateFiltersDebounced,
  clearFilters,
  availableCategories,
  isLoading
} = useReportsFilters({
  debounceDelay: 300, // 300ms debounce for search
  onFiltersChange: (filters) => {
    console.log('Filters changed:', filters);
  }
});

// Update filters immediately (for dropdowns, checkboxes)
updateFilters({ timeRange: 'last7' });

// Update filters with debouncing (for search input)
updateFiltersDebounced({ search: 'restaurant' });

// Clear all filters to defaults
clearFilters();
```

## Integration Example

```typescript
import { useReportsData } from '@/hooks/use-reports-data';
import { useReportsFilters } from '@/hooks/use-reports-filters';

function ReportsPage() {
  const { currentOrganization } = useAuth();
  
  // Filter state management with URL sync
  const {
    filters,
    updateFilters,
    updateFiltersDebounced,
    clearFilters,
    availableCategories,
  } = useReportsFilters({
    debounceDelay: 300,
  });

  // Data fetching with caching and error handling
  const { 
    mtdData, 
    categoryData, 
    trendData,
    loading, 
    error, 
    refetch,
    correlationId
  } = useReportsData({
    orgId: currentOrganization?.id || '',
    filters,
    refreshInterval: 30000,
    enabled: !!currentOrganization?.id,
  });

  // Handle category selection from chart
  const handleCategoryClick = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    updateFilters({ categories: newCategories });
  };

  return (
    <div>
      <ReportsFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onFiltersChangeDebounced={updateFiltersDebounced}
        onClearFilters={clearFilters}
        availableCategories={availableCategories}
      />
      
      <ReportsWidgets
        mtdData={mtdData}
        categoryData={categoryData}
        trendData={trendData}
        loading={loading}
        error={error}
        onCategoryClick={handleCategoryClick}
        onRetry={refetch}
      />
    </div>
  );
}
```

## Error Handling

Both hooks implement comprehensive error handling:

### `useReportsData` Error Handling
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, max 10s)
- **Error Classification**: Different handling for 4xx vs 5xx errors
- **Correlation ID**: Every request includes a correlation ID for debugging
- **Circuit Breaking**: Stops retrying on authentication/authorization errors
- **Stale Data Refresh**: Refreshes data when tab becomes active after 5+ minutes

### `useReportsFilters` Error Handling
- **Validation**: Validates date formats and ranges before applying
- **Graceful Degradation**: Invalid filters are ignored, doesn't break the UI
- **URL Sync**: Handles malformed URL parameters gracefully
- **Browser Navigation**: Properly handles browser back/forward navigation

## Performance Optimizations

### Caching Strategy
- **SWR Configuration**: 30-second deduplication interval
- **Request Deduplication**: Prevents duplicate API calls
- **Stale-While-Revalidate**: Shows cached data while fetching fresh data
- **Focus Throttling**: Limits revalidation on window focus

### Debouncing
- **Search Input**: 300ms debounce for search queries
- **Filter Changes**: Immediate updates for dropdowns, debounced for text input
- **API Optimization**: Reduces unnecessary API calls during typing

### Memory Management
- **Cleanup**: Proper cleanup of event listeners and timeouts
- **Memoization**: Callbacks are memoized to prevent unnecessary re-renders
- **Conditional Fetching**: Data fetching can be disabled when not needed

## Requirements Coverage

This implementation covers the following requirements from Task 8:

- ✅ **Create useReportsData custom hook using SWR for caching and real-time updates**
- ✅ **Implement useReportsFilters hook for filter state management and URL synchronization**
- ✅ **Add debouncing for search input and filter changes to optimize API calls**
- ✅ **Implement proper error handling and retry mechanisms**
- ✅ **Add correlation ID tracking for debugging and monitoring**

### Specific Requirements Addressed:
- **4.6**: URL parameter handling for filter state persistence
- **8.2**: Debouncing for search input and filter changes
- **8.3**: Proper error handling and retry mechanisms
- **9.1**: Organization-level data isolation through proper API calls

## Testing

Both hooks include comprehensive unit tests covering:
- Filter state management and URL synchronization
- Data fetching with various scenarios
- Error handling and retry mechanisms
- Debouncing functionality
- Edge cases and validation

Run tests with:
```bash
npm run test:unit -- hooks/__tests__/ --run
```

## Future Enhancements

Potential improvements for future iterations:
1. **Real-time Updates**: WebSocket integration for live data updates
2. **Offline Support**: Cache data for offline viewing
3. **Advanced Caching**: Redis-based caching for better performance
4. **Analytics**: Track filter usage patterns for UX improvements
5. **A/B Testing**: Support for testing different filter configurations