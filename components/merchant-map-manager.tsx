'use client';

import { useState } from 'react';
import { useMerchantMap } from '@/hooks/use-merchant-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Search, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface MerchantMapManagerProps {
  orgId: string;
  userId: string;
  userRole: 'owner' | 'admin' | 'member';
}

export function MerchantMapManager({ orgId, userId, userRole }: MerchantMapManagerProps) {
  const { mappings, stats, loading, error, updateMapping, deleteMapping, refresh } = useMerchantMap({
    orgId,
    autoFetch: true
  });

  const [newMapping, setNewMapping] = useState({
    merchantName: '',
    category: '',
    subcategory: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredMappings = mappings.filter(mapping =>
    mapping.merchant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mapping.subcategory && mapping.subcategory.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddMapping = async () => {
    if (!newMapping.merchantName.trim() || !newMapping.category.trim()) {
      toast.error('Merchant name and category are required');
      return;
    }

    setIsAdding(true);
    const success = await updateMapping(
      newMapping.merchantName.trim(),
      newMapping.category.trim(),
      newMapping.subcategory.trim() || null,
      userId
    );

    if (success) {
      setNewMapping({ merchantName: '', category: '', subcategory: '' });
    }
    setIsAdding(false);
  };

  const handleDeleteMapping = async (merchantName: string) => {
    if (!confirm(`Are you sure you want to delete the mapping for "${merchantName}"?`)) {
      return;
    }

    await deleteMapping(merchantName);
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={refresh} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Mappings</p>
                  <p className="text-2xl font-bold">{stats.totalMappings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Plus className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Recent (30 days)</p>
                  <p className="text-2xl font-bold">{stats.recentMappings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm font-medium mb-2">Top Categories</p>
                <div className="space-y-1">
                  {stats.topCategories.slice(0, 3).map((cat, index) => (
                    <div key={cat.category} className="flex justify-between text-xs">
                      <span className="truncate">{cat.category}</span>
                      <span className="text-muted-foreground">{cat.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add New Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Add Merchant Mapping</CardTitle>
          <CardDescription>
            Create a new mapping to automatically categorize future receipts from this merchant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="merchantName">Merchant Name</Label>
              <Input
                id="merchantName"
                placeholder="e.g., Starbucks"
                value={newMapping.merchantName}
                onChange={(e) => setNewMapping(prev => ({ ...prev, merchantName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., Food & Dining"
                value={newMapping.category}
                onChange={(e) => setNewMapping(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="subcategory">Subcategory (Optional)</Label>
              <Input
                id="subcategory"
                placeholder="e.g., Coffee Shops"
                value={newMapping.subcategory}
                onChange={(e) => setNewMapping(prev => ({ ...prev, subcategory: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleAddMapping} disabled={isAdding} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {isAdding ? 'Adding...' : 'Add Mapping'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Merchant Mappings</CardTitle>
          <CardDescription>
            Manage existing merchant categorization mappings. These are applied automatically to new receipts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mappings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading mappings...</p>
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No mappings match your search.' : 'No merchant mappings found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium capitalize">
                        {mapping.merchant_name}
                      </span>
                      <Badge variant="secondary">
                        {mapping.category}
                      </Badge>
                      {mapping.subcategory && (
                        <Badge variant="outline">
                          {mapping.subcategory}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {new Date(mapping.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {['admin', 'owner'].includes(userRole) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMapping(mapping.merchant_name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}