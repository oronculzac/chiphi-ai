import { ReceiptData } from './ai-data-extractor';
import { loggingService } from './logging-service';

/**
 * Fallback Categorization Service
 * 
 * Provides basic categorization when AI services are unavailable
 * Requirements: 7.5 - Implement graceful degradation when AI services are unavailable
 */

export interface FallbackReceiptData {
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
  fallbackUsed: boolean;
}

export class FallbackCategorizationService {
  // Simple keyword-based categorization rules
  private readonly CATEGORY_KEYWORDS = {
    'Food & Dining': [
      'restaurant', 'cafe', 'pizza', 'burger', 'food', 'dining', 'kitchen',
      'mcdonalds', 'subway', 'starbucks', 'kfc', 'dominos', 'grocery',
      'supermarket', 'market', 'deli', 'bakery', 'bar', 'pub', 'bistro'
    ],
    'Transportation': [
      'gas', 'fuel', 'shell', 'exxon', 'bp', 'chevron', 'parking', 'uber',
      'lyft', 'taxi', 'metro', 'bus', 'train', 'airline', 'airport'
    ],
    'Shopping': [
      'amazon', 'walmart', 'target', 'costco', 'mall', 'store', 'shop',
      'retail', 'clothing', 'fashion', 'electronics', 'best buy', 'apple'
    ],
    'Entertainment': [
      'movie', 'cinema', 'theater', 'netflix', 'spotify', 'game', 'concert',
      'ticket', 'entertainment', 'amusement', 'park'
    ],
    'Health & Fitness': [
      'pharmacy', 'cvs', 'walgreens', 'hospital', 'clinic', 'doctor',
      'medical', 'gym', 'fitness', 'health', 'wellness'
    ],
    'Travel': [
      'hotel', 'motel', 'booking', 'airbnb', 'flight', 'airline', 'rental',
      'travel', 'vacation', 'trip'
    ],
    'Bills & Utilities': [
      'electric', 'electricity', 'water', 'gas', 'internet', 'phone',
      'mobile', 'insurance', 'bill', 'utility', 'service'
    ],
    'Business': [
      'office', 'supplies', 'software', 'professional', 'consulting',
      'service', 'business', 'corporate'
    ]
  };

  // Common currency patterns
  private readonly CURRENCY_PATTERNS = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    'USD': 'USD',
    'EUR': 'EUR',
    'GBP': 'GBP',
    'CAD': 'CAD',
    'AUD': 'AUD'
  };

  /**
   * Extract basic receipt data using fallback methods
   * Requirements: 7.5
   */
  async extractFallbackData(
    emailContent: string,
    orgId: string,
    emailId: string,
    correlationId?: string
  ): Promise<FallbackReceiptData> {
    const startTime = Date.now();

    try {
      // Log fallback processing start
      await loggingService.logProcessingStep({
        orgId,
        emailId,
        step: 'fallback_categorization_start',
        status: 'started',
        details: {
          reason: 'AI services unavailable',
          contentLength: emailContent.length,
          correlationId,
        },
        correlationId,
      });

      // Extract basic information using regex patterns
      const amount = this.extractAmount(emailContent);
      const currency = this.extractCurrency(emailContent);
      const date = this.extractDate(emailContent);
      const merchant = this.extractMerchant(emailContent);
      const last4 = this.extractLast4(emailContent);
      const category = this.categorizeByKeywords(emailContent, merchant);

      const fallbackData: FallbackReceiptData = {
        date: date || new Date().toISOString().split('T')[0],
        amount: amount || 0,
        currency: currency || 'USD',
        merchant: merchant || 'Unknown Merchant',
        last4: last4,
        category: category || 'Other',
        subcategory: null,
        notes: 'Processed using fallback categorization due to AI service unavailability',
        confidence: 30, // Low confidence for fallback processing
        explanation: `Categorized as "${category || 'Other'}" using keyword matching. AI services were unavailable, so this is a basic categorization that may need manual review.`,
        fallbackUsed: true
      };

      const processingTimeMs = Date.now() - startTime;

      // Log successful fallback processing
      await loggingService.logProcessingStep({
        orgId,
        emailId,
        step: 'fallback_categorization_complete',
        status: 'completed',
        details: {
          category: fallbackData.category,
          confidence: fallbackData.confidence,
          amount: fallbackData.amount,
          currency: fallbackData.currency,
          processingTimeMs,
          correlationId,
        },
        processingTimeMs,
        correlationId,
      });

      return fallbackData;

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      // Log fallback processing failure
      await loggingService.logProcessingStep({
        orgId,
        emailId,
        step: 'fallback_categorization_failed',
        status: 'failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs,
          correlationId,
        },
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
        correlationId,
      });

      // Return minimal fallback data even if extraction fails
      return {
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        currency: 'USD',
        merchant: 'Unknown Merchant',
        last4: null,
        category: 'Other',
        subcategory: null,
        notes: 'Fallback processing failed - manual review required',
        confidence: 10,
        explanation: 'Unable to process receipt automatically. Manual review and categorization required.',
        fallbackUsed: true
      };
    }
  }

  /**
   * Extract amount from email content using regex patterns
   */
  private extractAmount(content: string): number | null {
    // Common amount patterns
    const patterns = [
      /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*USD/gi,
      /total[:\s]*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      /amount[:\s]*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      /(\d+\.\d{2})/g
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const numStr = match.replace(/[^\d.]/g, '');
          const num = parseFloat(numStr);
          if (num > 0 && num < 100000) { // Reasonable amount range
            return num;
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract currency from email content
   */
  private extractCurrency(content: string): string | null {
    for (const [symbol, currency] of Object.entries(this.CURRENCY_PATTERNS)) {
      if (content.includes(symbol)) {
        return currency;
      }
    }
    return null;
  }

  /**
   * Extract date from email content
   */
  private extractDate(content: string): string | null {
    // Common date patterns
    const patterns = [
      /(\d{4}-\d{2}-\d{2})/g,
      /(\d{2}\/\d{2}\/\d{4})/g,
      /(\d{2}-\d{2}-\d{4})/g,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const dateStr = match[0];
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Extract merchant name from email content
   */
  private extractMerchant(content: string): string | null {
    // Look for common merchant patterns
    const patterns = [
      /Receipt from\s+([^\n]+)/gi,
      /from:\s*([^<\n]+)/gi,
      /merchant[:\s]*([^\n]+)/gi,
      /store[:\s]*([^\n]+)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:store|shop|restaurant|cafe)/gi,
      /^([A-Z][a-zA-Z\s&']+)$/gm // Match lines that look like merchant names
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const merchantMatch = match.match(pattern);
          if (merchantMatch && merchantMatch[1]) {
            const merchant = merchantMatch[1].trim();
            if (merchant.length > 2 && merchant.length < 50) {
              return merchant;
            }
          }
        }
      }
    }

    // Look for known merchant names in the content
    const knownMerchants = [
      'Starbucks', 'McDonald\'s', 'Subway', 'KFC', 'Pizza Hut', 'Domino\'s',
      'Shell', 'Exxon', 'BP', 'Chevron', 'Amazon', 'Walmart', 'Target',
      'CVS', 'Walgreens', 'Netflix', 'Spotify'
    ];

    for (const merchant of knownMerchants) {
      if (content.toLowerCase().includes(merchant.toLowerCase())) {
        return merchant;
      }
    }

    // Extract from email subject or sender
    const lines = content.split('\n');
    for (const line of lines.slice(0, 5)) { // Check first few lines
      if (line.includes('@') && !line.includes('receipt')) {
        const parts = line.split('@')[0].split(/[<>\s]/);
        const potential = parts[parts.length - 1];
        if (potential && potential.length > 2) {
          return potential;
        }
      }
    }

    return null;
  }

  /**
   * Extract last 4 digits of card from email content
   */
  private extractLast4(content: string): string | null {
    // Look for patterns like "ending in 1234" or "****1234"
    const patterns = [
      /ending\s+in\s+(\d{4})/gi,
      /\*{4,}\s*(\d{4})/g,
      /x{4,}\s*(\d{4})/gi,
      /card\s+\*+(\d{4})/gi,
      /Card ending in (\d{4})/gi
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Categorize based on keyword matching
   */
  private categorizeByKeywords(content: string, merchant: string | null): string | null {
    const searchText = `${content} ${merchant || ''}`.toLowerCase();

    let bestMatch = null;
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
      let matches = 0;
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          matches++;
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = category;
      }
    }

    return bestMatch;
  }

  /**
   * Check if AI services are available
   */
  async checkAIServiceAvailability(): Promise<{
    available: boolean;
    services: {
      openai: boolean;
      translation: boolean;
      extraction: boolean;
    };
    error?: string;
  }> {
    try {
      // This would implement actual health checks for AI services
      // For now, return a basic check
      return {
        available: true,
        services: {
          openai: true,
          translation: true,
          extraction: true,
        }
      };
    } catch (error) {
      return {
        available: false,
        services: {
          openai: false,
          translation: false,
          extraction: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const fallbackCategorizationService = new FallbackCategorizationService();