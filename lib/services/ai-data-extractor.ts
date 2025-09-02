import { config } from '@/lib/config';
import { z } from 'zod';
import OpenAI from 'openai';

// Receipt data schema for validation
const ReceiptDataSchema = z.object({
  date: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchant: z.string().min(1),
  last4: z.string().nullable(),
  category: z.string().min(1),
  subcategory: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  explanation: z.string().min(1)
});

export interface ReceiptData {
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
}

export class DataExtractor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  /**
   * Extract structured data from receipt text using OpenAI API
   * Requirements: 3.1 - WHEN processing a receipt THEN the system SHALL extract data into strict JSON format
   * Requirements: 3.2 - WHEN extracting data THEN the system SHALL include: date, amount, currency, merchant, last4, category, subcategory, notes, confidence, explanation
   * Requirements: 3.3 - WHEN extracting payment info THEN the system SHALL store only last4 digits if present and redact full PANs
   * Requirements: 3.4 - WHEN extraction is complete THEN the system SHALL assign a confidence score (0-100)
   * Requirements: 3.5 - WHEN extraction is complete THEN the system SHALL provide an explanation for the categorization decision
   */
  async extractReceiptData(normalizedText: string): Promise<ReceiptData> {
    if (!normalizedText.trim()) {
      throw new Error('Text cannot be empty for data extraction');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert financial data extraction system. Extract structured data from receipt text.

CRITICAL SECURITY REQUIREMENTS:
- NEVER include full credit card numbers (PANs) in your response
- If you find credit card numbers, only extract the last 4 digits
- Redact any sensitive information like full account numbers

Extract the following information and return as JSON:

{
  "date": "YYYY-MM-DD format",
  "amount": 123.45,
  "currency": "USD",
  "merchant": "Merchant name",
  "last4": "1234 or null if no card info",
  "category": "Primary category",
  "subcategory": "Subcategory or null",
  "notes": "Additional notes or null",
  "confidence": 85,
  "explanation": "Detailed explanation of categorization decision"
}

CATEGORIZATION GUIDELINES:
- Food & Dining: restaurants, cafes, food delivery, groceries
- Transportation: gas, parking, rideshare, public transit
- Shopping: retail, online purchases, clothing, electronics
- Entertainment: movies, concerts, streaming, games
- Health & Fitness: medical, pharmacy, gym, wellness
- Travel: hotels, flights, car rental
- Bills & Utilities: phone, internet, electricity, insurance
- Business: office supplies, software, professional services
- Personal Care: salon, spa, cosmetics
- Home & Garden: furniture, home improvement, gardening
- Education: books, courses, tuition
- Charity: donations, non-profit contributions

CONFIDENCE SCORING:
- 90-100: Very clear receipt with all key information
- 70-89: Good receipt with minor ambiguities
- 50-69: Partial information or some unclear elements
- 30-49: Limited information, significant guesswork
- 0-29: Very poor quality or insufficient data

EXPLANATION REQUIREMENTS:
- Explain why you chose the specific category
- Mention key indicators that led to your decision
- Note any assumptions made due to missing information
- Highlight any uncertainty or ambiguity`
          },
          {
            role: 'user',
            content: `Extract structured data from this receipt text:\n\n${normalizedText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI data extraction');
      }

      // Parse and validate the JSON response
      const parsed = JSON.parse(content);
      const result = ReceiptDataSchema.parse(parsed);

      // Additional validation for PAN redaction
      this.validatePANRedaction(result);

      return {
        date: result.date,
        amount: result.amount,
        currency: result.currency,
        merchant: result.merchant,
        last4: result.last4,
        category: result.category,
        subcategory: result.subcategory,
        notes: result.notes,
        confidence: result.confidence,
        explanation: result.explanation
      };
    } catch (error) {
      console.error('Data extraction failed:', error);
      throw new Error(`Data extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that no full PANs are present in the extracted data
   * Requirements: 3.3 - WHEN extracting payment info THEN the system SHALL store only last4 digits if present and redact full PANs
   */
  private validatePANRedaction(data: ReceiptData): void {
    // Check for potential credit card numbers (13-19 digits)
    const panPattern = /\b\d{13,19}\b/g;
    
    const fieldsToCheck = [
      data.merchant,
      data.notes,
      data.explanation,
      data.subcategory
    ].filter(Boolean);

    for (const field of fieldsToCheck) {
      if (field && panPattern.test(field)) {
        throw new Error('Potential PAN detected in extracted data - security violation');
      }
    }

    // Validate last4 format if present
    if (data.last4 && (data.last4.length !== 4 || !/^\d{4}$/.test(data.last4))) {
      throw new Error('Invalid last4 format - must be exactly 4 digits');
    }
  }

  /**
   * Extract data with retry logic for transient failures
   */
  async extractReceiptDataWithRetry(
    normalizedText: string, 
    maxRetries: number = 2
  ): Promise<ReceiptData> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await this.extractReceiptData(normalizedText);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Data extraction attempt ${attempt} failed:`, error);
        
        if (attempt <= maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Data extraction failed after all retries');
  }
}

// Export singleton instance
export const dataExtractor = new DataExtractor();