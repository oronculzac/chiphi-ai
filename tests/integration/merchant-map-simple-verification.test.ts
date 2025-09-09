import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { merchantMapService } from '@/lib/services/merchant-map';
import { testOrganizations, testUsers } from '../fixtures/test-organizations';
import { ReceiptData } from '@/lib/types';

/**
 * Simple MerchantMap Learning System Verification
 * 
 * Basic tests to verify MerchantMap functionality works correctly
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
describe('MerchantMap Simple Verification', () => {
  const testOrgId = testOrganizations.primary.id;
  const testUserId = testUsers.primaryOwner.id;

  // Track created mappings for cleanup
  const createdMappings: string[] = [];

  afterEach(async () => {
    // Clean up created mappings
    for (const merchantName of createdMappings) {
      try {
        await merchantMapService.deleteMapping(merchantName, testOrgId);
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Failed to cleanup mapping for ${merchantName}:`, error);
      }
    }
    createdMappings.length = 0;
  });

  describe('Basic MerchantMap Operations', () => {
    it('should create and retrieve merchant mapping', async () => {
      const merchantName = 'Test Merchant Basic';
      const category = 'Food & Dining';
      const subcategory = 'Restaurants';

      // Create mapping
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        category,
        subcategory,
        testOrgId,
        testUserId
      );

      createdMappings.push(merchantName);

      // Verify mapping was created
      expect(mapping).toBeDefined();
      expect(mapping.category).toBe(category);
      expect(mapping.subcategory).toBe(subcategory);
      expect(mapping.org_id).toBe(testOrgId);

      // Retrieve mapping
      const retrieved = await merchantMapService.lookupMapping(merchantName, testOrgId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.category).toBe(category);
      expect(retrieved?.subcategory).toBe(subcategory);
    });

    it('should apply learned mapping to receipt data', async () => {
      const merchantName = 'Test Merchant Apply';
      const learnedCategory = 'Transportation';
      const learnedSubcategory = 'Gas & Fuel';

      // Create learned mapping
      await merchantMapService.updateMapping(
        merchantName,
        learnedCategory,
        learnedSubcategory,
        testOrgId,
        testUserId
      );

      createdMappings.push(merchantName);

      // Create receipt data
      const receiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 45.00,
        currency: 'USD',
        merchant: merchantName,
        last4: '1234',
        category: 'Miscellaneous', // Original AI categorization
        subcategory: null,
        notes: null,
        confidence: 75,
        explanation: 'AI categorized as miscellaneous'
      };

      // Apply mapping
      const result = await merchantMapService.applyMapping(receiptData, testOrgId);

      // Verify learned categorization was applied
      expect(result.category).toBe(learnedCategory);
      expect(result.subcategory).toBe(learnedSubcategory);
      expect(result.confidence).toBeGreaterThan(75); // Should increase confidence
      expect(result.explanation).toContain('Applied learned categorization');
    });

    it('should handle merchant name normalization', async () => {
      const variations = [
        'STARBUCKS CORPORATION',
        'Starbucks Corp.',
        'starbucks inc',
        '  Starbucks Company  '
      ];

      const category = 'Food & Dining';
      const subcategory = 'Coffee Shops';

      // Create mapping with first variation
      await merchantMapService.updateMapping(
        variations[0],
        category,
        subcategory,
        testOrgId,
        testUserId
      );

      createdMappings.push(variations[0]);

      // Test that all variations resolve to the same mapping
      for (const variation of variations) {
        const mapping = await merchantMapService.lookupMapping(variation, testOrgId);
        expect(mapping).toBeDefined();
        expect(mapping?.category).toBe(category);
        expect(mapping?.subcategory).toBe(subcategory);
      }
    });

    it('should return null for non-existent mappings', async () => {
      const nonExistentMerchant = 'Non Existent Merchant XYZ';
      
      const mapping = await merchantMapService.lookupMapping(nonExistentMerchant, testOrgId);
      expect(mapping).toBeNull();
    });

    it('should return original data when no mapping exists', async () => {
      const receiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 25.00,
        currency: 'USD',
        merchant: 'Unknown Merchant ABC',
        last4: null,
        category: 'Shopping',
        subcategory: 'General',
        notes: null,
        confidence: 80,
        explanation: 'AI categorization'
      };

      const result = await merchantMapService.applyMapping(receiptData, testOrgId);

      // Should return exactly the same data
      expect(result).toEqual(receiptData);
    });
  });

  describe('MerchantMap Statistics', () => {
    it('should provide mapping statistics', async () => {
      // Create a few test mappings
      const testMappings = [
        { merchant: 'Stats Test 1', category: 'Food & Dining', subcategory: 'Restaurants' },
        { merchant: 'Stats Test 2', category: 'Food & Dining', subcategory: 'Coffee Shops' },
        { merchant: 'Stats Test 3', category: 'Transportation', subcategory: 'Gas & Fuel' }
      ];

      for (const mapping of testMappings) {
        await merchantMapService.updateMapping(
          mapping.merchant,
          mapping.category,
          mapping.subcategory,
          testOrgId,
          testUserId
        );
        createdMappings.push(mapping.merchant);
      }

      const stats = await merchantMapService.getMappingStats(testOrgId);

      expect(stats).toBeDefined();
      expect(stats.totalMappings).toBeGreaterThanOrEqual(3);
      expect(stats.recentMappings).toBeGreaterThanOrEqual(3);
      expect(stats.topCategories).toBeInstanceOf(Array);
      expect(stats.topCategories.length).toBeGreaterThan(0);

      // Food & Dining should be top category (2 mappings)
      const topCategory = stats.topCategories.find(cat => cat.category === 'Food & Dining');
      expect(topCategory).toBeDefined();
      expect(topCategory?.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty merchant names gracefully', async () => {
      const receiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 10.00,
        currency: 'USD',
        merchant: '', // Empty merchant name
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 80,
        explanation: 'AI categorization'
      };

      // Should not throw and return original data
      const result = await merchantMapService.applyMapping(receiptData, testOrgId);
      expect(result).toEqual(receiptData);
    });

    it('should handle null subcategory in mappings', async () => {
      const merchantName = 'Null Subcategory Test';
      
      // Create mapping with null subcategory
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        'Test Category',
        null, // null subcategory
        testOrgId,
        testUserId
      );

      createdMappings.push(merchantName);

      expect(mapping.category).toBe('Test Category');
      expect(mapping.subcategory).toBeNull();

      // Test applying this mapping
      const receiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 20.00,
        currency: 'USD',
        merchant: merchantName,
        last4: null,
        category: 'Original Category',
        subcategory: 'Original Subcategory',
        notes: null,
        confidence: 75,
        explanation: 'Original explanation'
      };

      const result = await merchantMapService.applyMapping(receiptData, testOrgId);

      expect(result.category).toBe('Test Category');
      expect(result.subcategory).toBeNull();
      expect(result.confidence).toBe(90); // 75 + 15
    });
  });

  describe('Confidence Score Enhancement', () => {
    it('should increase confidence when applying learned mappings', async () => {
      const merchantName = 'Confidence Test Merchant';
      
      await merchantMapService.updateMapping(
        merchantName,
        'Business',
        'Office Supplies',
        testOrgId,
        testUserId
      );

      createdMappings.push(merchantName);

      const testCases = [
        { original: 50, expected: 65 },
        { original: 75, expected: 90 },
        { original: 85, expected: 100 }, // Should cap at 100
        { original: 95, expected: 100 }  // Should cap at 100
      ];

      for (const testCase of testCases) {
        const receiptData: ReceiptData = {
          date: '2024-01-15',
          amount: 99.99,
          currency: 'USD',
          merchant: merchantName,
          last4: null,
          category: 'Miscellaneous',
          subcategory: null,
          notes: null,
          confidence: testCase.original,
          explanation: 'AI categorization'
        };

        const result = await merchantMapService.applyMapping(receiptData, testOrgId);
        expect(result.confidence).toBe(testCase.expected);
      }
    });
  });

  describe('Learning System Explanations', () => {
    it('should provide detailed explanations for learned categorizations', async () => {
      const merchantName = 'Explanation Test Merchant';
      
      await merchantMapService.updateMapping(
        merchantName,
        'Healthcare',
        'Pharmacy',
        testOrgId,
        testUserId
      );

      createdMappings.push(merchantName);

      const receiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 12.99,
        currency: 'USD',
        merchant: merchantName,
        last4: '5678',
        category: 'Miscellaneous',
        subcategory: null,
        notes: 'Prescription pickup',
        confidence: 68,
        explanation: 'AI analyzed merchant name and categorized as miscellaneous'
      };

      const result = await merchantMapService.applyMapping(receiptData, testOrgId);

      // Verify explanation contains learning context
      expect(result.explanation).toContain('Applied learned categorization');
      expect(result.explanation).toContain('previous user correction');
      expect(result.explanation).toContain('Original AI suggestion: Miscellaneous');
      expect(result.explanation).toContain('User-corrected category: Healthcare > Pharmacy');
    });
  });
});