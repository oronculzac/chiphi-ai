'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

/**
 * Report filter types and interfaces
 */
export interface ReportFilters {
  timeRange: 'last7' | 'last30' | 'last90' | 'mtd' | 'custom';
  startDate?: string;
  endDate?: string;
  categories: string[];
  search: string;
}

interface ReportsFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  availableCategories?: string[];
  loading?: boolean;
}

/**
 * Time range preset options
 */
const TIME_RANGE_OPTIONS = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month-to-date' },
  { value: 'custom', label: 'Custom range' },
] as const;

/**
 * ReportsFilters Component
 * 
 * Provides comprehensive filtering controls for reports including:
 * - Time range presets and custom date picker
 * - Category multi-select dropdown
 * - Debounced search input
 * - Clear all functionality
 * 
 * Requirements covered:
 * - 4.1, 4.2, 4.3: Time range filtering with presets and custom dates
 * - 4.4, 4.5: Date validation and URL state management
 * - 5.1, 5.2: Category multi-select filtering
 * - 5.3, 5.4: Search functionality with debouncing
 * - 5.5, 5.6: Filter combination and clear all functionality
 */
export default function ReportsFilters({
  filters,
  onFiltersChange,
  availableCategories = [],
  loading = false,
}: ReportsFiltersProps) {
  // Local state for search input to enable debouncing
  const [searchInput, setSearchInput] = useState(filters.search);
  
  // Local state for date picker
  const [startDate, setStartDate] = useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    filters.endDate ? new Date(filters.endDate) : undefined
  );

  // Debounced search handler (300ms delay)
  const debouncedSearch = useDebounce((searchTerm: string) => {
    onFiltersChange({ search: searchTerm });
  }, 300);

  // Update search when input changes
  useEffect(() => {
    debouncedSearch(searchInput);
  }, [searchInput, debouncedSearch]);

  // Sync local date state with filters
  useEffect(() => {
    setStartDate(filters.startDate ? new Date(filters.startDate) : undefined);
    setEndDate(filters.endDate ? new Date(filters.endDate) : undefined);
  }, [filters.startDate, filters.endDate]);

  // Handle time range change
  const handleTimeRangeChange = (timeRange: ReportFilters['timeRange']) => {
    if (timeRange === 'custom') {
      // Keep existing custom dates or set defaults
      onFiltersChange({ 
        timeRange,
        startDate: filters.startDate || format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        endDate: filters.endDate || format(new Date(), 'yyyy-MM-dd')
      });
    } else {
      // Clear custom dates for preset ranges
      onFiltersChange({ 
        timeRange,
        startDate: undefined,
        endDate: undefined
      });
    }
  };

  // Handle start date change
  const handleStartDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    setStartDate(date);
    
    // Validate that start date is before end date
    if (endDate && date > endDate) {
      // If start date is after end date, clear end date
      setEndDate(undefined);
      onFiltersChange({ 
        startDate: dateString,
        endDate: undefined
      });
    } else {
      onFiltersChange({ startDate: dateString });
    }
  };

  // Handle end date change
  const handleEndDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    setEndDate(date);
    
    // Validate that end date is after start date
    if (startDate && date < startDate) {
      // Show error or prevent invalid selection
      return;
    }
    
    onFiltersChange({ endDate: dateString });
  };

  // Handle category toggle
  const handleCategoryToggle = (category: string, checked: boolean) => {
    const newCategories = checked
      ? [...filters.categories, category]
      : filters.categories.filter(c => c !== category);
    
    onFiltersChange({ categories: newCategories });
  };

  // Handle clear all filters
  const handleClearAll = () => {
    setSearchInput('');
    setStartDate(undefined);
    setEndDate(undefined);
    onFiltersChange({
      timeRange: 'last30',
      startDate: undefined,
      endDate: undefined,
      categories: [],
      search: '',
    });
  };

  // Check if any filters are active
  const hasActiveFilters = 
    filters.timeRange !== 'last30' ||
    filters.categories.length > 0 ||
    filters.search.length > 0 ||
    filters.startDate ||
    filters.endDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Report Filters</span>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={loading}
            >
              Clear All
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time Range Filter */}
        <div className="space-y-2">
          <Label htmlFor="time-range">Time Range</Label>
          <Select
            value={filters.timeRange}
            onValueChange={handleTimeRangeChange}
            disabled={loading}
          >
            <SelectTrigger id="time-range" data-testid="time-range-select">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {filters.timeRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateChange}
                    disabled={(date) => {
                      const today = new Date();
                      const minDate = startDate || new Date(0);
                      return date > today || date < minDate;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="space-y-2">
              {/* Selected categories as badges */}
              {filters.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.categories.map((category) => (
                    <Badge
                      key={category}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleCategoryToggle(category, false)}
                    >
                      {category}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Category checkboxes */}
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {availableCategories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={filters.categories.includes(category)}
                      onCheckedChange={(checked) => 
                        handleCategoryToggle(category, checked as boolean)
                      }
                      disabled={loading}
                    />
                    <Label
                      htmlFor={`category-${category}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {category}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search Filter */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Merchants & Notes</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="text"
              placeholder="Search merchants, notes..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchInput('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Active Filters:</p>
              <ul className="space-y-1">
                {filters.timeRange !== 'last30' && (
                  <li>• Time Range: {TIME_RANGE_OPTIONS.find(opt => opt.value === filters.timeRange)?.label}</li>
                )}
                {filters.categories.length > 0 && (
                  <li>• Categories: {filters.categories.length} selected</li>
                )}
                {filters.search && (
                  <li>• Search: "{filters.search}"</li>
                )}
                {filters.startDate && filters.endDate && (
                  <li>• Custom Range: {format(new Date(filters.startDate), 'MMM d')} - {format(new Date(filters.endDate), 'MMM d')}</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}