'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';

/**
 * Transaction Processor Demo Component
 * 
 * Demonstrates the transaction processing functionality including:
 * - PII redaction
 * - AI processing simulation
 * - Confidence scoring
 * - Validation
 * 
 * Requirements demonstrated:
 * - 3.1: Structured data extraction
 * - 3.2: Confidence scoring and explanation
 * - 3.3: PII redaction
 * - 7.4: Secure data handling
 */

interface ProcessingResult {
  receiptData: {
    date: string;
    amount: number;
    currency: string;
    merchant: string;
    last4: string | null;
    category: string;
    subcategory: string | null;
    notes: string | null;
    confidence: number;
    explanation: string;
  };
  translationResult: {
    translatedText: string;
    originalText: string;
    sourceLanguage: string;
    confidence: number;
  };
  processingTimeMs: number;
  appliedMapping: boolean;
}

export function TransactionProcessorDemo() {
  const [emailContent, setEmailContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [redactedContent, setRedactedContent] = useState('');

  // Sample receipt content for demo
  const sampleReceipts = [
    {
      name: 'Restaurant Receipt',
      content: `Receipt from McDonald's
Date: 2024-01-15 12:30 PM
Order #12345

Big Mac Meal - $8.99
Large Fries - $2.49
Coca Cola - $1.99

Subtotal: $13.47
Tax: $1.08
Total: $14.55

Payment Method: Visa ending in 4532
Thank you for your visit!`
    },
    {
      name: 'Gas Station Receipt',
      content: `Shell Gas Station
123 Main Street
Date: 2024-01-16 08:15 AM

Fuel Purchase
Regular Unleaded
Gallons: 12.5
Price per gallon: $3.45
Total: $43.13

Card: ****-****-****-9876
Auth Code: 123456
Thank you!`
    },
    {
      name: 'Coffee Shop Receipt (with PII)',
      content: `Starbucks Coffee
Receipt #789123
Date: 2024-01-17 07:45 AM

Grande Latte - $5.25
Blueberry Muffin - $3.50

Subtotal: $8.75
Tax: $0.70
Total: $9.45

Card Number: 4532-1234-5678-9012
CVV: 123
Customer Phone: 555-123-4567
Email: customer@email.com

Thank you for choosing Starbucks!`
    }
  ];

  const handleProcessReceipt = async () => {
    if (!emailContent.trim()) {
      setError('Please enter receipt content');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Simulate PII redaction (client-side demo)
      const redacted = redactPIIDemo(emailContent);
      setRedactedContent(redacted);

      // Simulate AI processing with realistic delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock processing result
      const mockResult: ProcessingResult = {
        receiptData: {
          date: '2024-01-15',
          amount: parseFloat((Math.random() * 50 + 10).toFixed(2)),
          currency: 'USD',
          merchant: extractMerchantName(emailContent),
          last4: extractLast4Demo(emailContent),
          category: categorizeReceipt(emailContent),
          subcategory: null,
          notes: 'Processed from email receipt',
          confidence: Math.floor(Math.random() * 30 + 70), // 70-100
          explanation: generateExplanation(emailContent)
        },
        translationResult: {
          translatedText: redacted,
          originalText: emailContent,
          sourceLanguage: 'English',
          confidence: 100
        },
        processingTimeMs: Math.floor(Math.random() * 2000 + 1000),
        appliedMapping: Math.random() > 0.5
      };

      setResult(mockResult);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const redactPIIDemo = (text: string): string => {
    return text
      // Redact full credit card numbers
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, (match) => {
        const digits = match.replace(/\D/g, '');
        return `****-****-****-${digits.slice(-4)}`;
      })
      // Redact CVV codes
      .replace(/\bCVV:?\s*(\d{3,4})\b/gi, 'CVV: ***')
      // Redact phone numbers
      .replace(/(?:phone|tel|mobile|cell):?\s*(\d{3}[-.]?\d{3}[-.]?\d{4})/gi, 'Phone: ***-***-****')
      // Redact email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
      // Redact 6-digit codes (2FA/Auth codes)
      .replace(/\b\d{6}\b/g, '******');
  };

  const extractMerchantName = (text: string): string => {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine?.toLowerCase().includes('mcdonald')) return "McDonald's";
    if (firstLine?.toLowerCase().includes('starbucks')) return 'Starbucks';
    if (firstLine?.toLowerCase().includes('shell')) return 'Shell';
    if (firstLine?.toLowerCase().includes('walmart')) return 'Walmart';
    if (firstLine?.toLowerCase().includes('target')) return 'Target';
    
    return firstLine || 'Unknown Merchant';
  };

  const categorizeReceipt = (text: string): string => {
    const content = text.toLowerCase();
    
    if (content.includes('gas') || content.includes('fuel') || content.includes('shell') || content.includes('exxon')) {
      return 'Transportation';
    }
    if (content.includes('coffee') || content.includes('restaurant') || content.includes('mcdonald') || content.includes('starbucks')) {
      return 'Food & Dining';
    }
    if (content.includes('walmart') || content.includes('target') || content.includes('amazon')) {
      return 'Shopping';
    }
    
    return 'Other';
  };

  const extractLast4Demo = (text: string): string | null => {
    const cardMatch = text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?(\d{4})\b/);
    if (cardMatch) return cardMatch[1];
    
    const endingMatch = text.match(/ending in (\d{4})/i);
    if (endingMatch) return endingMatch[1];
    
    return null;
  };

  const generateExplanation = (text: string): string => {
    const merchant = extractMerchantName(text);
    const category = categorizeReceipt(text);
    
    return `Categorized as "${category}" based on merchant "${merchant}". High confidence due to clear merchant identification and transaction pattern recognition.`;
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-500';
    if (confidence >= 80) return 'bg-blue-500';
    if (confidence >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Transaction Processor Demo
          </CardTitle>
          <CardDescription>
            Demonstrates AI-powered receipt processing with PII redaction, confidence scoring, and structured data extraction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sample Receipts */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Try a sample receipt:
            </label>
            <div className="flex flex-wrap gap-2">
              {sampleReceipts.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailContent(sample.content)}
                >
                  {sample.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Email Content Input */}
          <div>
            <label htmlFor="email-content" className="text-sm font-medium mb-2 block">
              Receipt Content:
            </label>
            <Textarea
              id="email-content"
              placeholder="Paste receipt content here..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Process Button */}
          <Button 
            onClick={handleProcessReceipt} 
            disabled={isProcessing || !emailContent.trim()}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Receipt...
              </>
            ) : (
              'Process Receipt'
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* PII Redaction Demo */}
          {redactedContent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  PII Redaction
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {showOriginal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showOriginal ? 'Hide Original' : 'Show Original'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                  {showOriginal ? emailContent : redactedContent}
                </pre>
                {!showOriginal && (
                  <p className="text-xs text-gray-600 mt-2">
                    ✓ Credit card numbers, CVV codes, phone numbers, and email addresses have been redacted
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Processing Result */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Processing Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Transaction Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Transaction Details</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Date:</strong> {result.receiptData.date}</div>
                      <div><strong>Amount:</strong> ${result.receiptData.amount.toFixed(2)} {result.receiptData.currency}</div>
                      <div><strong>Merchant:</strong> {result.receiptData.merchant}</div>
                      <div><strong>Category:</strong> {result.receiptData.category}</div>
                      {result.receiptData.last4 && (
                        <div><strong>Card Last4:</strong> ****{result.receiptData.last4}</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Processing Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <strong>Confidence:</strong>
                        <Badge className={`${getConfidenceBadgeColor(result.receiptData.confidence)} text-white`}>
                          {result.receiptData.confidence}%
                        </Badge>
                      </div>
                      <div><strong>Processing Time:</strong> {result.processingTimeMs}ms</div>
                      <div><strong>Language:</strong> {result.translationResult.sourceLanguage}</div>
                      {result.appliedMapping && (
                        <div className="text-green-600">✓ Applied learned mapping</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <h4 className="font-medium mb-2">AI Explanation</h4>
                  <p className="text-sm bg-blue-50 p-3 rounded border">
                    {result.receiptData.explanation}
                  </p>
                </div>

                {/* Processing Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {result.receiptData.confidence}%
                    </div>
                    <div className="text-xs text-gray-600">Extraction Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.processingTimeMs}ms
                    </div>
                    <div className="text-xs text-gray-600">Processing Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.translationResult.confidence}%
                    </div>
                    <div className="text-xs text-gray-600">Translation Confidence</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}