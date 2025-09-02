import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataExtractor } from '../ai-data-extractor';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    openai: {
      apiKey: 'test-key',
      model: 'gpt-4o-mini'
    }
  }
}));

describe('DataExtractor', () => {
  let extractor: DataExtractor;
  let mockOpenAI: any;

  beforeEach(() => {
    const MockOpenAI = vi.mocked(require('openai').default);
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    MockOpenAI.mockImplementation(() => mockOpenAI);
    extractor = new DataExtractor();
    vi.clearAllMocks();
  });

  describe('extractReceiptData', () => {
    it('should extract valid receipt data', async () => {
      const mockReceiptData = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Starbucks',
        last4: '1234',
        category: 'Food & Dining',
        subcategory: 'Coffee',
        notes: 'Morning coffee',
        confidence: 95,
        explanation: 'Clear receipt from coffee shop, categorized as Food & Dining based on merchant name'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockReceiptData)
          }
        }]
      });

      const result = await extractor.extractReceiptData('Starbucks receipt text...');

      expect(result).toEqual(mockReceiptData);
    });

    it('should handle receipt without payment card info', async () => {
      const mockReceiptData = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Cash Store',
        last4: null,
        category: 'Shopping',
        subcategory: null,
        notes: null,
        confidence: 85,
        explanation: 'Cash transaction, no card information available'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockReceiptData)
          }
        }]
      });

      const result = await extractor.extractReceiptData('Cash receipt text...');

      expect(result).toEqual(mockReceiptData);
      expect(result.last4).toBeNull();
    });

    it('should throw error for empty text', async () => {
      await expect(extractor.extractReceiptData('')).rejects.toThrow('Text cannot be empty for data extraction');
      await expect(extractor.extractReceiptData('   ')).rejects.toThrow('Text cannot be empty for data extraction');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(extractor.extractReceiptData('Some receipt text')).rejects.toThrow('Data extraction failed: API Error');
    });

    it('should handle invalid JSON response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      await expect(extractor.extractReceiptData('Some receipt text')).rejects.toThrow('Data extraction failed');
    });

    it('should validate schema and reject invalid data', async () => {
      const invalidData = {
        date: '2024-01-15',
        amount: -25.99, // Invalid negative amount
        currency: 'USD',
        merchant: 'Starbucks',
        last4: null,
        category: 'Food & Dining',
        subcategory: null,
        notes: null,
        confidence: 95,
        explanation: 'Test explanation'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(invalidData)
          }
        }]
      });

      await expect(extractor.extractReceiptData('Receipt text')).rejects.toThrow('Data extraction failed');
    });

    it('should detect and reject potential PAN in merchant field', async () => {
      const dataWithPAN = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Store 4111111111111111', // Contains potential PAN
        last4: '1111',
        category: 'Shopping',
        subcategory: null,
        notes: null,
        confidence: 95,
        explanation: 'Test explanation'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(dataWithPAN)
          }
        }]
      });

      await expect(extractor.extractReceiptData('Receipt text')).rejects.toThrow('Potential PAN detected in extracted data - security violation');
    });

    it('should detect and reject potential PAN in notes field', async () => {
      const dataWithPAN = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Safe Store',
        last4: '1111',
        category: 'Shopping',
        subcategory: null,
        notes: 'Card ending 4111111111111111 used', // Contains potential PAN
        confidence: 95,
        explanation: 'Test explanation'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(dataWithPAN)
          }
        }]
      });

      await expect(extractor.extractReceiptData('Receipt text')).rejects.toThrow('Potential PAN detected in extracted data - security violation');
    });

    it('should validate last4 format', async () => {
      const dataWithInvalidLast4 = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Store',
        last4: '12345', // Invalid - too many digits
        category: 'Shopping',
        subcategory: null,
        notes: null,
        confidence: 95,
        explanation: 'Test explanation'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(dataWithInvalidLast4)
          }
        }]
      });

      await expect(extractor.extractReceiptData('Receipt text')).rejects.toThrow('Invalid last4 format - must be exactly 4 digits');
    });
  });

  describe('extractReceiptDataWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockReceiptData = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Starbucks',
        last4: null,
        category: 'Food & Dining',
        subcategory: null,
        notes: null,
        confidence: 95,
        explanation: 'Test explanation'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockReceiptData)
          }
        }]
      });

      const result = await extractor.extractReceiptDataWithRetry('Receipt text');

      expect(result).toEqual(mockReceiptData);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const mockReceiptData = {
        date: '2024-01-15',
        amount: 25.99,
        currency: 'USD',
        merchant: 'Starbucks',
        last4: null,
        category: 'Food & Dining',
        subcategory: null,
        notes: null,
        confidence: 95,
        explanation: 'Test explanation'
      };

      // First call fails, second succeeds
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify(mockReceiptData)
            }
          }]
        });

      const result = await extractor.extractReceiptDataWithRetry('Receipt text', 2);

      expect(result).toEqual(mockReceiptData);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should fail after all retries exhausted', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Persistent failure'));

      await expect(extractor.extractReceiptDataWithRetry('Receipt text', 2)).rejects.toThrow('Persistent failure');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});