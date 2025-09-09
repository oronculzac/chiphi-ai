# Reports Widgets

This directory contains the widget components for the Reports MVP feature.

## MTD Total Widget

The `MTDTotalWidget` component displays the current month-to-date spending total with comparison to the previous period.

### Features Implemented

✅ **Current MTD Total Display**: Shows the current month-to-date spending amount in formatted currency

✅ **Previous Period Comparison**: Calculates and displays percentage change compared to previous period

✅ **Visual Trend Indicators**: 
- Red arrow (↗) and red text for spending increases (bad trend)
- Green arrow (↘) and green text for spending decreases (good trend)
- Neutral display for no change

✅ **Edge Case Handling**:
- Shows "No comparison data available" when no previous period data exists
- Handles zero amounts gracefully
- Displays appropriate messaging for different states

✅ **Loading States**: Skeleton loaders that match the component dimensions

✅ **Error States**: Error display with retry functionality

✅ **Accessibility**: 
- Proper ARIA labels and roles
- Screen reader friendly descriptions
- Keyboard navigation support

### Usage

```tsx
import { MTDTotalWidget } from '@/components/reports/widgets/mtd-total-widget';

<MTDTotalWidget
  data={mtdData}
  loading={loading}
  error={error}
  onRetry={handleRetry}
/>
```

### Data Structure

```typescript
interface MTDData {
  current: number;        // Current period total
  previous: number;       // Previous period total
  change: number;         // Absolute change amount
  changePercentage: number; // Percentage change
}
```

### Testing

The component includes comprehensive unit tests covering:
- Loading states
- Error states with retry functionality
- No data states
- Data display with increases/decreases
- Edge cases (no previous data, zero change)
- Accessibility attributes
- Currency formatting
- Visual trend indicators

Run tests with:
```bash
npm run test:unit -- --run components/reports/widgets/__tests__/mtd-total-widget.test.tsx
```

### Integration

The widget is integrated into the reports page at `/reports` and uses:
- `useReportsData` hook for data fetching
- `useAuth` hook for organization context
- SWR for caching and real-time updates
- URL parameter synchronization for filter state

### Requirements Satisfied

This implementation satisfies the following requirements from the Reports MVP spec:

- **1.1**: Display current month-to-date total spending amount ✅
- **1.2**: Show percentage change compared to previous period ✅  
- **1.3**: Display visual indicators (red/green arrows) for increase/decrease trends ✅
- **1.4**: Handle edge cases when no previous period data exists ✅
- **1.5**: Add loading skeleton and error states ✅
- **8.1**: Implement proper loading states and error handling ✅

## Category Breakdown Widget

The `CategoryBreakdownWidget` component displays spending breakdown by category using an interactive donut chart with legend.

### Features Implemented

✅ **Interactive Donut Chart**: Uses Recharts to display category spending as a donut chart

✅ **Interactive Legend**: Clickable legend items with category names, amounts, and visual indicators

✅ **Click-to-Filter Functionality**: 
- Click chart segments to filter by category
- Click legend items to toggle category filters
- Visual indication of active filters with ring borders and filter icons

✅ **"Other" Category Grouping**: Automatically groups smaller categories into "Other" when more than 8 categories exist

✅ **Visual Filter Indication**:
- Active filters shown with ring borders on chart segments
- Filter count displayed in widget title
- Selected categories highlighted in legend
- Clear filters button when filters are active

✅ **Loading States**: Skeleton loaders for chart and legend areas

✅ **Error States**: Error display with retry functionality

✅ **Empty States**: Appropriate messaging when no data is available

✅ **Accessibility**: 
- Proper ARIA labels and roles
- Screen reader friendly descriptions
- Keyboard navigation support
- Color-independent information display

✅ **Responsive Design**: Chart adapts to container size changes

✅ **Colorblind-Friendly Palette**: Uses accessible color palette for chart segments

### Usage

```tsx
import { CategoryBreakdownWidget } from '@/components/reports/widgets/category-breakdown-widget';

<CategoryBreakdownWidget
  data={categoryData}
  onCategoryClick={handleCategoryClick}
  selectedCategories={selectedCategories}
  loading={loading}
  error={error}
  onRetry={handleRetry}
/>
```

### Data Structure

```typescript
interface CategoryBreakdown {
  category: string;       // Category name
  amount: number;         // Total amount spent in category
  percentage: number;     // Percentage of total spending
  count: number;          // Number of transactions in category
}
```

### Testing

The component includes comprehensive unit tests covering:
- Loading states with skeleton placeholders
- Error states with retry functionality
- Empty states with appropriate messaging
- Data display with interactive chart and legend
- Click-to-filter functionality on chart segments and legend
- "Other" category grouping for large datasets
- Active filter visual indication
- Clear filters functionality
- Accessibility attributes
- Currency formatting
- Responsive behavior

Run tests with:
```bash
npm run test:unit -- --run components/reports/widgets/__tests__/category-breakdown-widget.test.tsx
```

### Demo Component

A demo component is available for visual testing:

```tsx
import { CategoryBreakdownWidgetDemo } from '@/components/reports/widgets/category-breakdown-widget-demo';
```

### Integration

The widget integrates with the reports page and uses:
- `useReportsData` hook for category data fetching
- Filter state management for category selection
- URL parameter synchronization for filter persistence
- SWR for caching and real-time updates

### Requirements Satisfied

This implementation satisfies the following requirements from the Reports MVP spec:

- **2.1**: Display donut chart showing spending breakdown by category ✅
- **2.2**: Include interactive legend showing category names and amounts ✅
- **2.3**: Click on category in chart or legend to filter reports ✅
- **2.4**: Visually indicate active category filter ✅
- **2.5**: Provide clear way to remove category filter ✅
- **2.6**: Group smaller categories into "Other" when more than 8 categories ✅
- **7.1**: Show appropriate empty states when no data matches filters ✅
- **7.5**: Show skeleton loading states until data loads ✅
- **8.1**: Implement proper loading states and error handling ✅