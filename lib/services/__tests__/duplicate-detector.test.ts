import { describe, it, expect, vi, beforeEach } from 'vitest';
import { duplicateDetector } from '../duplicate-detector';
import { createServiceClient } from '@/lib/supabase/server';
import { ParsedEmail } from '@/lib/types';

// Mock Supabase client
vi.mock('@/lib/supabase/server');
vi.mock('../logging-service');

describe('DuplicateDetector', () => {
  const mockOrgId = 'test-org-id';
  const mockCorrelationId = 'test-correlation-id';
  
  const mockParsedEmail: ParsedEmail = {
    messageId: 'test-message-id',
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Test Receipt',
    text: 'Thank you for your purchase. Total: $25.99',
    html: '<p>Thank you for your purchase. Total: $25.99</p>',
    attachments: [],
    headers: {},
  };

  const mockSupabaseClient = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServiceClient).mockReturnValue(mockSupabaseClient as any);
  });

  describe('isDuplicate', () => {
    it('should detect duplicate by message ID', async () => {
      // Mock database response for existing message ID
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'existing-email-id', message_id: 'test-message-id' },
              error: null,
            }),
          }),
        }),
      });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await duplicateDetector.isDuplicate(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('Exact message ID match found');
      expect(result.existingEmailId).toBe('existing-email-id');
      expect(result.confidence).toBe(100);
    });

    it('should detect duplicate by content hash', async () => {
      // Mock message ID check - not found
      const mockMessageIdSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // Not found
            }),
          }),
        }),
      });

      // Mock content hash check - found
      const mockHashSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { email_id: 'existing-email-id', content_hash: 'test-hash' },
              error: null,
            }),
          }),
        }),
      });

      // Mock hash storage
      const mockInsert = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockMessageIdSelect }) // First call for message ID
        .mockReturnValueOnce({ select: mockHashSelect }) // Second call for content hash
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) }) }) }) }) // Email lookup for hash storage
        .mockReturnValueOnce({ insert: mockInsert }); // Hash storage

      const result = await duplicateDetector.isDuplicate(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('Identical content hash found');
      expect(result.existingEmailId).toBe('existing-email-id');
      expect(result.confidence).toBe(95);
    });

    it('should detect duplicate by similarity', async () => {
      // Mock message ID check - not found
      const mockMessageIdSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      // Mock content hash check - not found
      const mockHashSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      // Mock similarity check - found similar email
      const mockSimilaritySelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'similar-email-id',
                    message_id: 'similar-message-id',
                    parsed_content: {
                      subject: 'Test Receipt',
                      text: 'Thank you for your purchase. Total: $25.99', // Identical content
                    },
                    from_email: 'sender@example.com',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockMessageIdSelect })
        .mockReturnValueOnce({ select: mockHashSelect })
        .mockReturnValueOnce({ select: mockSimilaritySelect });

      const result = await duplicateDetector.isDuplicate(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toContain('High content similarity');
      expect(result.existingEmailId).toBe('similar-email-id');
      expect(result.confidence).toBeGreaterThan(90);
    });

    it('should return not duplicate when no matches found', async () => {
      // Mock all checks to return no results
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
            gte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await duplicateDetector.isDuplicate(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }),
        }),
      });
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await duplicateDetector.isDuplicate(
        mockParsedEmail,
        mockOrgId,
        mockCorrelationId
      );

      // Should return not duplicate on error to avoid blocking processing
      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hashes for identical content', () => {
      const email1: ParsedEmail = {
        messageId: 'msg1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase',
        html: '',
        attachments: [],
        headers: {},
      };

      const email2: ParsedEmail = {
        messageId: 'msg2', // Different message ID
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase',
        html: '',
        attachments: [],
        headers: {},
      };

      const hash1 = (duplicateDetector as any).generateContentHash(email1);
      const hash2 = (duplicateDetector as any).generateContentHash(email2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const email1: ParsedEmail = {
        messageId: 'msg1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase',
        html: '',
        attachments: [],
        headers: {},
      };

      const email2: ParsedEmail = {
        messageId: 'msg1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Different content here',
        html: '',
        attachments: [],
        headers: {},
      };

      const hash1 = (duplicateDetector as any).generateContentHash(email1);
      const hash2 = (duplicateDetector as any).generateContentHash(email2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateContentSimilarity', () => {
    it('should return high similarity for identical content', () => {
      const email1: ParsedEmail = {
        messageId: 'msg1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase total amount twenty five dollars',
        html: '',
        attachments: [],
        headers: {},
      };

      const email2: ParsedEmail = {
        messageId: 'msg2',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase total amount twenty five dollars',
        html: '',
        attachments: [],
        headers: {},
      };

      const similarity = (duplicateDetector as any).calculateContentSimilarity(email1, email2);
      expect(similarity).toBe(1.0);
    });

    it('should return low similarity for different content', () => {
      const email1: ParsedEmail = {
        messageId: 'msg1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase',
        html: '',
        attachments: [],
        headers: {},
      };

      const email2: ParsedEmail = {
        messageId: 'msg2',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Newsletter',
        text: 'Check out our latest products',
        html: '',
        attachments: [],
        headers: {},
      };

      const similarity = (duplicateDetector as any).calculateContentSimilarity(email1, email2);
      expect(similarity).toBeLessThan(0.5);
    });

    it('should return partial similarity for partially similar content', () => {
      const email1: ParsedEmail = {
        messageId: 'msg1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase at our store',
        html: '',
        attachments: [],
        headers: {},
      };

      const email2: ParsedEmail = {
        messageId: 'msg2',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Receipt',
        text: 'Thank you for your purchase at different location',
        html: '',
        attachments: [],
        headers: {},
      };

      const similarity = (duplicateDetector as any).calculateContentSimilarity(email1, email2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });
  });
});