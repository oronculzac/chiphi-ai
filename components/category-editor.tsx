'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Info, Save, X, Lightbulb } from 'lucide-react';
import { ConfidenceBadge } from './confidence-badge';

interface CategoryEditorProps {
  transaction: Transaction;
  onSave: (transactionId: string, category: string, subcategory?: string) => void;
  onCancel: () => void;
}

// Common expense categories for suggestions
const COMMON_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Travel',
  'Business',
  'Education',
  'Personal Care',
  'Home & Garden',
  'Gifts & Donations',
  'Fees & Charges',
  'Other'
];

const SUBCATEGORIES: Record<string, string[]> = {
  'Food & Dining': ['Restaurants', 'Fast Food', 'Coffee Shops', 'Groceries', 'Alcohol & Bars', 'Delivery'],
  'Transportation': ['Gas & Fuel', 'Parking', 'Public Transportation', 'Taxi & Rideshare', 'Auto Maintenance', 'Auto Insurance'],
  'Shopping': ['Clothing', 'Electronics', 'Books', 'Hobbies', 'Sporting Goods', 'General Merchandise'],
  'Entertainment': ['Movies & DVDs', 'Music', 'Games', 'Sports', 'Amusement', 'Newspapers & Magazines'],
  'Bills & Utilities': ['Phone', 'Internet', 'Cable TV', 'Electricity', 'Gas', 'Water', 'Trash', 'Insurance'],
  'Healthcare': ['Doctor', 'Dentist', 'Pharmacy', 'Eyecare', 'Medical Devices', 'Health Insurance'],
  'Travel': ['Airfare', 'Hotel', 'Rental Car', 'Vacation', 'Business Travel'],
  'Business': ['Office Supplies', 'Software', 'Legal', 'Professional Services', 'Advertising'],
  'Education': ['Tuition', 'Books & Supplies', 'Student Loan', 'Online Courses'],
  'Personal Care': ['Hair', 'Spa & Massage', 'Laundry', 'Clothing Care'],
  'Home & Garden': ['Furniture', 'Hardware', 'Lawn & Garden', 'Home Improvement', 'Home Services'],
  'Gifts & Donations': ['Gift', 'Charity', 'Religious'],
  'Fees & Charges': ['Service Fee', 'Late Fee', 'Finance Charge', 'ATM Fee', 'Bank Fee'],
  'Other': ['Miscellaneous', 'Cash & ATM', 'Check']
};

export function CategoryEditor({ transaction, onSave, onCancel }: CategoryEditorProps) {
  const [category, setCategory] = useState(transaction.category);
  const [subcategory, setSubcategory] = useState(transaction.subcategory || '');
  const [customCategory, setCustomCategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [useCustomSubcategory, setUseCustomSubcategory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if current category is custom (not in predefined list)
  useEffect(() => {
    if (!COMMON_CATEGORIES.includes(transaction.category)) {
      setUseCustomCategory(true);
      setCustomCategory(transaction.category);
    }
  }, [transaction.category]);

  // Check if current subcategory is custom
  useEffect(() => {
    if (transaction.subcategory && category && SUBCATEGORIES[category]) {
      if (!SUBCATEGORIES[category].includes(transaction.subcategory)) {
        setUseCustomSubcategory(true);
        setCustomSubcategory(transaction.subcategory);
      }
    }
  }, [transaction.subcategory, category]);

  // Get available subcategories for selected category
  const availableSubcategories = category && SUBCATEGORIES[category] ? SUBCATEGORIES[category] : [];

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      const finalCategory = useCustomCategory ? customCategory : category;
      const finalSubcategory = useCustomSubcategory ? customSubcategory : subcategory;
      
      if (!finalCategory.trim()) {
        throw new Error('Category is required');
      }

      await onSave(
        transaction.id, 
        finalCategory.trim(), 
        finalSubcategory.trim() || undefined
      );
    } catch (error) {
      console.error('Error saving category:', error);
      // Error handling is done in parent component
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* Current Transaction Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Merchant:</span>
              <p>{transaction.merchant}</p>
            </div>
            <div>
              <span className="font-medium">Amount:</span>
              <p>{new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: transaction.currency || 'USD'
              }).format(transaction.amount)}</p>
            </div>
            <div>
              <span className="font-medium">Current Category:</span>
              <p>{transaction.category}</p>
            </div>
            <div>
              <span className="font-medium">AI Confidence:</span>
              <div className="ml-2 inline-block">
                <ConfidenceBadge 
                  confidence={transaction.confidence}
                  explanation={transaction.explanation}
                />
              </div>
            </div>
          </div>
          
          {transaction.explanation && (
            <>
              <Separator className="my-4" />
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">AI Explanation:</span>
                </div>
                <p className="text-sm text-muted-foreground">{transaction.explanation}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Category Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <div className="space-y-2">
              <Select
                value={useCustomCategory ? 'custom' : category}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setUseCustomCategory(true);
                  } else {
                    setUseCustomCategory(false);
                    setCategory(value);
                    setSubcategory(''); // Reset subcategory when category changes
                  }
                }}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Category...</SelectItem>
                </SelectContent>
              </Select>
              
              {useCustomCategory && (
                <Input
                  placeholder="Enter custom category"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  disabled={saving}
                />
              )}
            </div>
          </div>

          {/* Subcategory Selection */}
          {(availableSubcategories.length > 0 || useCustomSubcategory) && (
            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory (Optional)</Label>
              <div className="space-y-2">
                {availableSubcategories.length > 0 && (
                  <Select
                    value={useCustomSubcategory ? 'custom' : (subcategory || 'none')}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setUseCustomSubcategory(true);
                      } else {
                        setUseCustomSubcategory(false);
                        setSubcategory(value === 'none' ? '' : value);
                      }
                    }}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No subcategory</SelectItem>
                      {availableSubcategories.map((subcat) => (
                        <SelectItem key={subcat} value={subcat}>
                          {subcat}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom Subcategory...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                {(useCustomSubcategory || availableSubcategories.length === 0) && (
                  <Input
                    placeholder="Enter custom subcategory"
                    value={customSubcategory}
                    onChange={(e) => setCustomSubcategory(e.target.value)}
                    disabled={saving}
                  />
                )}
              </div>
            </div>
          )}

          {/* Learning Note */}
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300">Learning System</p>
                <p className="text-blue-600 dark:text-blue-400">
                  This correction will be saved and applied automatically to future receipts from "{transaction.merchant}".
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}