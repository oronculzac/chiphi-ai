'use client';

import { useState } from 'react';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Info, Globe, CreditCard, Calendar, DollarSign, Tag, FileText, HelpCircle } from 'lucide-react';
import { ConfidenceBadge } from './confidence-badge';
import { format } from 'date-fns';

interface TransactionDetailViewProps {
  transaction: Transaction;
}

export function TransactionDetailView({ transaction }: TransactionDetailViewProps) {
  const [showOriginalText, setShowOriginalText] = useState(false);



  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const hasTranslation = transaction.original_text && transaction.translated_text && 
                        transaction.source_language && transaction.source_language !== 'en';

  return (
    <div className="space-y-6">
      {/* Transaction Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5" />
              <span>{formatCurrency(transaction.amount, transaction.currency)}</span>
            </CardTitle>
            <ConfidenceBadge 
              confidence={transaction.confidence}
              explanation={transaction.explanation}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Date:</span>
                <span>{format(new Date(transaction.date), 'MMMM d, yyyy')}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Merchant:</span>
                <span>{transaction.merchant}</span>
              </div>
              
              {transaction.last4 && (
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Card:</span>
                  <span>•••• {transaction.last4}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Category:</span>
                <span>{transaction.category}</span>
              </div>
              
              {transaction.subcategory && (
                <div className="flex items-center space-x-2 ml-6">
                  <span className="font-medium">Subcategory:</span>
                  <span>{transaction.subcategory}</span>
                </div>
              )}
              
              {hasTranslation && (
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Language:</span>
                  <span className="capitalize">{transaction.source_language}</span>
                </div>
              )}
            </div>
          </div>
          
          {transaction.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <span className="font-medium">Notes:</span>
                <p className="mt-1 text-muted-foreground">{transaction.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5" />
            <span>AI Explanation</span>
            <ConfidenceBadge 
              confidence={transaction.confidence}
              showIcon={false}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p>{transaction.explanation}</p>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Text */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Receipt Text</span>
            </CardTitle>
            {hasTranslation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOriginalText(!showOriginalText)}
              >
                <Globe className="w-4 h-4 mr-2" />
                {showOriginalText ? 'Show English' : 'Show Original'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasTranslation ? (
            <Tabs value={showOriginalText ? 'original' : 'translated'} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="translated"
                  onClick={() => setShowOriginalText(false)}
                >
                  English Translation
                </TabsTrigger>
                <TabsTrigger 
                  value="original"
                  onClick={() => setShowOriginalText(true)}
                >
                  Original ({transaction.source_language?.toUpperCase()})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="translated" className="mt-4">
                <ScrollArea className="h-64 w-full rounded-md border p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {transaction.translated_text || 'No translated text available'}
                  </pre>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="original" className="mt-4">
                <ScrollArea className="h-64 w-full rounded-md border p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {transaction.original_text || 'No original text available'}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              <pre className="whitespace-pre-wrap text-sm">
                {transaction.original_text || transaction.translated_text || 'No receipt text available'}
              </pre>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Transaction ID:</span>
              <p className="text-muted-foreground font-mono">{transaction.id}</p>
            </div>
            <div>
              <span className="font-medium">Email ID:</span>
              <p className="text-muted-foreground font-mono">{transaction.email_id}</p>
            </div>
            <div>
              <span className="font-medium">Created:</span>
              <p className="text-muted-foreground">
                {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            <div>
              <span className="font-medium">Updated:</span>
              <p className="text-muted-foreground">
                {format(new Date(transaction.updated_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}