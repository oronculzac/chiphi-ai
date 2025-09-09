'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Edit3, Filter, SortAsc, SortDesc } from 'lucide-react';
import { TransactionDetailView } from './transaction-detail-view';
import { CategoryEditor } from './category-editor';
import { ConfidenceBadge } from './confidence-badge';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransactionListProps {
  orgId: string;
  onCategoryUpdate?: (transactionId: string, category: string, subcategory?: string) => void;
  filter?: 'all' | 'recent' | 'high-confidence' | 'needs-review';
}

interface FilterOptions {
  category?: string;
  minConfidence?: number;
  startDate?: string;
  endDate?: string;
  sortBy: 'date' | 'amount' | 'confidence' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

export function TransactionList({ orgId, onCategoryUpdate, filter = 'all' }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();
  
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Fetch transactions with current filters
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: '50'
      });

      if (filters.category) params.append('category', filters.category);
      if (filters.minConfidence) params.append('minConfidence', filters.minConfidence.toString());
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      // Apply filter-specific parameters
      switch (filter) {
        case 'recent':
          params.append('recent', 'true');
          break;
        case 'high-confidence':
          params.append('minConfidence', '80');
          break;
        case 'needs-review':
          params.append('maxConfidence', '70');
          break;
      }

      const response = await fetch(`/api/transactions?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch transactions');
      }

      setTransactions(result.data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch transactions on mount and filter changes
  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  // Handle category update
  const handleCategoryUpdate = async (transactionId: string, category: string, subcategory?: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subcategory })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update category');
      }

      // Update local state
      setTransactions(prev => 
        prev.map(t => 
          t.id === transactionId 
            ? { ...t, category, subcategory: subcategory || null }
            : t
        )
      );

      // Call parent callback if provided
      onCategoryUpdate?.(transactionId, category, subcategory);
      
      setEditingCategory(null);
    } catch (err) {
      console.error('Error updating category:', err);
      setError(err instanceof Error ? err.message : 'Failed to update category');
    }
  };



  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <Button onClick={fetchTransactions} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}>
            <CardTitle id="transactions-table-title">
              Transactions
              {filter !== 'all' && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filter.replace('-', ' ')})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                aria-controls="transaction-filters"
                aria-label={`${showFilters ? 'Hide' : 'Show'} transaction filters`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>
          
          {showFilters && (
            <div 
              id="transaction-filters"
              className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-4'} gap-4 pt-4 border-t`}
              role="region"
              aria-labelledby="filters-heading"
            >
              <h3 id="filters-heading" className="sr-only">Transaction Filters</h3>
              <div>
                <label htmlFor="category-filter" className="text-sm font-medium">Category</label>
                <Input
                  id="category-filter"
                  placeholder="Filter by category"
                  value={filters.category || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value || undefined }))}
                  aria-describedby="category-filter-desc"
                />
                <div id="category-filter-desc" className="sr-only">
                  Filter transactions by category name
                </div>
              </div>
              
              <div>
                <label htmlFor="confidence-filter" className="text-sm font-medium">Min Confidence</label>
                <Select
                  value={filters.minConfidence?.toString() || 'any'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    minConfidence: value === 'any' ? undefined : parseInt(value) 
                  }))}
                >
                  <SelectTrigger id="confidence-filter" aria-describedby="confidence-filter-desc">
                    <SelectValue placeholder="Any confidence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any confidence</SelectItem>
                    <SelectItem value="80">High (80%+)</SelectItem>
                    <SelectItem value="60">Medium (60%+)</SelectItem>
                    <SelectItem value="40">Low (40%+)</SelectItem>
                  </SelectContent>
                </Select>
                <div id="confidence-filter-desc" className="sr-only">
                  Filter transactions by AI confidence level
                </div>
              </div>
              
              <div>
                <label htmlFor="sort-filter" className="text-sm font-medium">Sort By</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}
                >
                  <SelectTrigger id="sort-filter" aria-describedby="sort-filter-desc">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="confidence">Confidence</SelectItem>
                    <SelectItem value="created_at">Created</SelectItem>
                  </SelectContent>
                </Select>
                <div id="sort-filter-desc" className="sr-only">
                  Choose how to sort transactions
                </div>
              </div>
              
              <div>
                <label htmlFor="sort-order-btn" className="text-sm font-medium">Order</label>
                <Button
                  id="sort-order-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                  }))}
                  className="w-full justify-start"
                  aria-describedby="sort-order-desc"
                  aria-pressed={filters.sortOrder === 'desc'}
                >
                  {filters.sortOrder === 'asc' ? (
                    <SortAsc className="w-4 h-4 mr-2" />
                  ) : (
                    <SortDesc className="w-4 h-4 mr-2" />
                  )}
                  {filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Button>
                <div id="sort-order-desc" className="sr-only">
                  Toggle between ascending and descending sort order
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {transactions.length === 0 ? (
            <div 
              className="text-center py-8 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              No transactions found. Try adjusting your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div id="transactions-table-desc" className="sr-only">
                Table showing {transactions.length} transactions with columns for date, merchant, amount, category, confidence, and actions
              </div>
              <Table 
                role="table" 
                aria-labelledby="transactions-table-title"
                aria-describedby="transactions-table-desc"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Merchant</TableHead>
                    <TableHead scope="col">Amount</TableHead>
                    <TableHead scope="col">Category</TableHead>
                    <TableHead scope="col">Confidence</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Actions</span>
                      {!isMobile && 'Actions'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(new Date(transaction.date), 'MMM d, yyyy')}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.merchant}</div>
                          {transaction.last4 && (
                            <div className="text-sm text-muted-foreground">
                              •••• {transaction.last4}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.category}</div>
                          {transaction.subcategory && (
                            <div className="text-sm text-muted-foreground">
                              {transaction.subcategory}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <ConfidenceBadge 
                          confidence={transaction.confidence}
                          explanation={transaction.explanation}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <div className={`flex items-center ${isMobile ? 'flex-col space-y-1' : 'space-x-2'}`}>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTransaction(transaction)}
                                aria-label={`View details for transaction at ${transaction.merchant}`}
                              >
                                {isMobile ? <Info className="w-4 h-4" /> : 'View'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" aria-describedby="transaction-detail-desc">
                              <DialogHeader className="pb-4">
                                <DialogTitle>Transaction Details</DialogTitle>
                                <div id="transaction-detail-desc" className="sr-only">
                                  Detailed view of the selected transaction including original text and AI analysis
                                </div>
                              </DialogHeader>
                              <div className="overflow-y-auto pr-2">
                                {selectedTransaction && (
                                  <TransactionDetailView transaction={selectedTransaction} />
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCategory(transaction.id)}
                            aria-label={`Edit category for transaction at ${transaction.merchant}`}
                          >
                            <Edit3 className="w-4 h-4" />
                            {!isMobile && <span className="sr-only">Edit</span>}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Editor Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent aria-describedby="category-edit-desc">
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
              <div id="category-edit-desc" className="sr-only">
                Edit the category and subcategory for this transaction. Changes will be learned for future similar transactions.
              </div>
            </DialogHeader>
            <CategoryEditor
              transaction={transactions.find(t => t.id === editingCategory)!}
              onSave={handleCategoryUpdate}
              onCancel={() => setEditingCategory(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </TooltipProvider>
  );
}