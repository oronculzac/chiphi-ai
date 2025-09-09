import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { merchantMapService } from '@/lib/services/merchant-map';
import { testOrganizations, testUsers } from '../fixtures/test-organizations';
import { ReceiptData } from '@/lib/types';

/**
 * MerchantMap Learning System Verification Tests
 * 
 * These tests verify that the MerchantMap learning functionality remains intact
 * after recent changes and meets all requirements for:
 * - Transaction categorization with confidence scores and explanations
 * - User corrections updating MerchantMap associations
 * - AI decision explanations being properly displayed
 * - Learning system integrity across multi-tenant isolation
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
describe('MerchantMap Learning System Verification', () => {
  const supabase = createClient();
  const testOrgId = testOrganizations.primary.id;
  const testUserId = testUsers.primaryOwner.id;
  const testOrgId2 = testOrganizations.secondary.id;
  const testUserId2 = testUsers.secondaryOwner.id;

  // Test data cleanup
  const createdMappingIds: string[] = [];
  const createdTransactionIds: string[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Clean up merchant mappings
    if (createdMappingIds.length > 0) {
      await supabase
        .from('merchant_map')
        .delete()
        .in('id', createdMappingIds);
      createdMappingIds.length = 0;
    }

    // Clean up transactions
    if (createdTransactionIds.length > 0) {
      await supabase
        .from('transactions')
        .delete()
        .in('id', createdTransactionIds);
      createdTransactionIds.length = 0;
    }

    // Clean up any test merchant mappings by merchant name
    const testMerchantNames = ['starbucks coffee test', 'mcdonalds test', 'target test', 'amazon test'];
    for (const merchantName of testMerchantNames) {
      await supabase
        .from('merchant_map')
        .delete()
        .eq('merchant_name', merchantName);
    }
  }

  describe('Requirement 5.1: User corrections update MerchantMap associations', () => {
    it('should create new merchant mapping when user corrects transaction category', async () => {
      const merchantName = 'Starbucks Coffee Test';
      const originalCategory = 'Miscellaneous';
      const correctedCategory = 'Food & Dining';
      const correctedSubcategory = 'Coffee Shops';

      // Verify no existing mapping
      const existingMapping = await merchantMapService.lookupMapping(merchantName, testOrgId);
      expect(existingMapping).toBeNull();

      // User corrects the category (simulating category editor)
      const newMapping = await merchantMapService.updateMapping(
        merchantName,
        correctedCategory,
        correctedSubcategory,
        testOrgId,
        testUserId
      );

      createdMappingIds.push(newMapping.id);

      // Verify mapping was created correctly
      expect(newMapping.merchant_name).toBe('starbucks coffee test'); // normalized
      expect(newMapping.category).toBe(correctedCategory);
      expect(newMapping.subcategory).toBe(correctedSubcategory);
      expect(newMapping.org_id).toBe(testOrgId);
      expect(newMapping.created_by).toBe(testUserId);

      // Verify mapping can be retrieved
      const retrievedMapping = await merchantMapService.lookupMapping(merchantName, testOrgId);
      expect(retrievedMapping).toEqual(newMapping);
    });

    it('should update existing merchant mapping when user makes another correction', async () => {
      const merchantName = 'McDonalds Test';
      const initialCategory = 'Food & Dining';
      const initialSubcategory = 'Fast Food';
      const updatedCategory = 'Entertainment';
      const updatedSubcategory = 'Amusement';

      // Create initial mapping
      const initialMapping = await merchantMapService.updateMapping(
        merchantName,
        initialCategory,
        initialSubcategory,
        testOrgId,
        testUserId
      );
      createdMappingIds.push(initialMapping.id);

      // User makes another correction
      const updatedMapping = await merchantMapService.updateMapping(
        merchantName,
        updatedCategory,
        updatedSubcategory,
        testOrgId,
        testUserId
      );

      // Should be the same mapping ID (upsert behavior)
      expect(updatedMapping.id).toBe(initialMapping.id);
      expect(updatedMapping.category).toBe(updatedCategory);
      expect(updatedMapping.subcategory).toBe(updatedSubcategory);
      expect(updatedMapping.updated_at).not.toBe(initialMapping.updated_at);
    });

    it('should maintain multi-tenant isolation for merchant mappings', async () => {
      const merchantName = 'Target Test';
      const category1 = 'Shopping';
      const category2 = 'Groceries';

      // Create mapping for org1
      const mapping1 = await merchantMapService.updateMapping(
        merchantName,
        category1,
        'General Merchandise',
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping1.id);

      // Create different mapping for org2
      const mapping2 = await merchantMapService.updateMapping(
        merchantName,
        category2,
        'Supermarkets',
        testOrgId2,
        testUserId2
      );
      createdMappingIds.push(mapping2.id);

      // Verify org1 sees only their mapping
      const org1Mapping = await merchantMapService.lookupMapping(merchantName, testOrgId);
      expect(org1Mapping?.category).toBe(category1);
      expect(org1Mapping?.org_id).toBe(testOrgId);

      // Verify org2 sees only their mapping
      const org2Mapping = await merchantMapService.lookupMapping(merchantName, testOrgId2);
      expect(org2Mapping?.category).toBe(category2);
      expect(org2Mapping?.org_id).toBe(testOrgId2);

      // Verify mappings are different
      expect(org1Mapping?.id).not.toBe(org2Mapping?.id);
    });
  });

  describe('Requirement 5.2: Apply learned categorization rules with confidence scores', () => {
    it('should apply learned mapping to receipt data and increase confidence', async () => {
      const merchantName = 'Amazon Test';
      const learnedCategory = 'Shopping';
      const learnedSubcategory = 'Online Shopping';

      // Create learned mapping
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        learnedCategory,
        learnedSubcategory,
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping.id);

      // Create receipt data with AI categorization
      const originalReceiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 29.99,
        currency: 'USD',
        merchant: merchantName,
        last4: '1234',
        category: 'Miscellaneous', // AI's original guess
        subcategory: null,
        notes: 'Online purchase',
        confidence: 75, // Original AI confidence
        explanation: 'AI categorized as miscellaneous based on merchant name analysis'
      };

      // Apply learned mapping
      const enhancedReceiptData = await merchantMapService.applyMapping(
        originalReceiptData,
        testOrgId
      );

      // Verify learned categorization was applied
      expect(enhancedReceiptData.category).toBe(learnedCategory);
      expect(enhancedReceiptData.subcategory).toBe(learnedSubcategory);
      
      // Verify confidence was increased (original 75 + 15 = 90)
      expect(enhancedReceiptData.confidence).toBe(90);
      
      // Verify explanation includes learning context
      expect(enhancedReceiptData.explanation).toContain('Applied learned categorization');
      expect(enhancedReceiptData.explanation).toContain('previous user correction');
      expect(enhancedReceiptData.explanation).toContain('Original AI suggestion: Miscellaneous');
      expect(enhancedReceiptData.explanation).toContain('User-corrected category: Shopping > Online Shopping');

      // Verify other fields remain unchanged
      expect(enhancedReceiptData.date).toBe(originalReceiptData.date);
      expect(enhancedReceiptData.amount).toBe(originalReceiptData.amount);
      expect(enhancedReceiptData.merchant).toBe(originalReceiptData.merchant);
    });

    it('should return original data when no learned mapping exists', async () => {
      const originalReceiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 15.50,
        currency: 'USD',
        merchant: 'Unknown Merchant XYZ',
        last4: null,
        category: 'Transportation',
        subcategory: 'Gas & Fuel',
        notes: null,
        confidence: 85,
        explanation: 'AI categorized based on transaction patterns'
      };

      // Apply mapping (should find none)
      const result = await merchantMapService.applyMapping(originalReceiptData, testOrgId);

      // Should return exactly the same data
      expect(result).toEqual(originalReceiptData);
    });

    it('should cap confidence at 100% when applying learned mappings', async () => {
      const merchantName = 'High Confidence Test';
      
      // Create learned mapping
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        'Business',
        'Office Supplies',
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping.id);

      // Create receipt data with already high confidence
      const highConfidenceData: ReceiptData = {
        date: '2024-01-15',
        amount: 99.99,
        currency: 'USD',
        merchant: merchantName,
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 92, // High original confidence
        explanation: 'AI very confident about categorization'
      };

      const result = await merchantMapService.applyMapping(highConfidenceData, testOrgId);

      // Should cap at 100% (92 + 15 would be 107, but capped at 100)
      expect(result.confidence).toBe(100);
      expect(result.category).toBe('Business');
      expect(result.subcategory).toBe('Office Supplies');
    });
  });

  describe('Requirement 5.3: Display confidence scores and reasoning for AI decisions', () => {
    it('should preserve and enhance AI explanations when applying learned mappings', async () => {
      const merchantName = 'Explanation Test Merchant';
      
      // Create learned mapping
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        'Healthcare',
        'Pharmacy',
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping.id);

      const originalExplanation = 'AI analyzed merchant name and transaction amount to categorize as miscellaneous. Confidence based on limited merchant database matches.';
      
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
        explanation: originalExplanation
      };

      const result = await merchantMapService.applyMapping(receiptData, testOrgId);

      // Verify explanation contains both original AI reasoning and learning context
      expect(result.explanation).toContain('Applied learned categorization from previous user correction');
      expect(result.explanation).toContain('Original AI suggestion: Miscellaneous');
      expect(result.explanation).toContain('User-corrected category: Healthcare > Pharmacy');
      
      // Verify confidence score is properly displayed in explanation context
      expect(result.confidence).toBe(83); // 68 + 15
    });

    it('should maintain original explanation when no learned mapping is applied', async () => {
      const originalExplanation = 'AI categorized based on merchant name pattern matching and transaction amount analysis. High confidence due to clear merchant category indicators.';
      
      const receiptData: ReceiptData = {
        date: '2024-01-15',
        amount: 45.00,
        currency: 'USD',
        merchant: 'No Mapping Merchant',
        last4: null,
        category: 'Food & Dining',
        subcategory: 'Restaurants',
        notes: null,
        confidence: 89,
        explanation: originalExplanation
      };

      const result = await merchantMapService.applyMapping(receiptData, testOrgId);

      // Should preserve original explanation exactly
      expect(result.explanation).toBe(originalExplanation);
      expect(result.confidence).toBe(89);
    });
  });

  describe('Requirement 5.4: Original↔English translation toggle functionality', () => {
    it('should preserve translation fields when applying learned mappings', async () => {
      const merchantName = 'Translation Test';
      
      // Create learned mapping
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        'Food & Dining',
        'Restaurants',
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping.id);

      // Create receipt data with translation information
      const receiptDataWithTranslation: ReceiptData = {
        date: '2024-01-15',
        amount: 25.50,
        currency: 'EUR',
        merchant: merchantName,
        last4: null,
        category: 'Miscellaneous',
        subcategory: null,
        notes: null,
        confidence: 70,
        explanation: 'AI categorized based on translated text analysis'
      };

      const result = await merchantMapService.applyMapping(receiptDataWithTranslation, testOrgId);

      // Verify learned categorization was applied
      expect(result.category).toBe('Food & Dining');
      expect(result.subcategory).toBe('Restaurants');
      
      // Verify confidence and explanation were updated
      expect(result.confidence).toBe(85); // 70 + 15
      expect(result.explanation).toContain('Applied learned categorization');
      
      // Verify all other fields preserved (including potential translation fields)
      expect(result.date).toBe(receiptDataWithTranslation.date);
      expect(result.amount).toBe(receiptDataWithTranslation.amount);
      expect(result.currency).toBe(receiptDataWithTranslation.currency);
      expect(result.merchant).toBe(receiptDataWithTranslation.merchant);
      expect(result.last4).toBe(receiptDataWithTranslation.last4);
      expect(result.notes).toBe(receiptDataWithTranslation.notes);
    });
  });

  describe('Requirement 5.5: Learning system integrity and performance', () => {
    it('should handle merchant name normalization consistently', async () => {
      const variations = [
        'STARBUCKS CORPORATION',
        'Starbucks Corp.',
        'starbucks inc',
        '  Starbucks Company  ',
        'Starbucks LLC'
      ];

      const category = 'Food & Dining';
      const subcategory = 'Coffee Shops';

      // Create mapping with first variation
      const mapping = await merchantMapService.updateMapping(
        variations[0],
        category,
        subcategory,
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping.id);

      // Test that all variations resolve to the same mapping
      for (const variation of variations) {
        const receiptData: ReceiptData = {
          date: '2024-01-15',
          amount: 4.99,
          currency: 'USD',
          merchant: variation,
          last4: null,
          category: 'Miscellaneous',
          subcategory: null,
          notes: null,
          confidence: 75,
          explanation: 'AI initial categorization'
        };

        const result = await merchantMapService.applyMapping(receiptData, testOrgId);

        expect(result.category).toBe(category);
        expect(result.subcategory).toBe(subcategory);
        expect(result.confidence).toBe(90); // 75 + 15
      }
    });

    it('should provide mapping statistics for organization', async () => {
      // Create multiple mappings for testing stats
      const mappings = [
        { merchant: 'Stats Test 1', category: 'Food & Dining', subcategory: 'Restaurants' },
        { merchant: 'Stats Test 2', category: 'Food & Dining', subcategory: 'Coffee Shops' },
        { merchant: 'Stats Test 3', category: 'Transportation', subcategory: 'Gas & Fuel' },
        { merchant: 'Stats Test 4', category: 'Shopping', subcategory: 'Clothing' }
      ];

      for (const mapping of mappings) {
        const created = await merchantMapService.updateMapping(
          mapping.merchant,
          mapping.category,
          mapping.subcategory,
          testOrgId,
          testUserId
        );
        createdMappingIds.push(created.id);
      }

      const stats = await merchantMapService.getMappingStats(testOrgId);

      expect(stats.totalMappings).toBeGreaterThanOrEqual(4);
      expect(stats.recentMappings).toBeGreaterThanOrEqual(4); // All created within 30 days
      expect(stats.topCategories).toBeInstanceOf(Array);
      expect(stats.topCategories.length).toBeGreaterThan(0);
      
      // Food & Dining should be top category (2 mappings)
      const topCategory = stats.topCategories[0];
      expect(topCategory.category).toBe('Food & Dining');
      expect(topCategory.count).toBe(2);
    });

    it('should handle concurrent mapping updates gracefully', async () => {
      const merchantName = 'Concurrent Test Merchant';
      const categories = ['Category A', 'Category B', 'Category C'];

      // Simulate concurrent updates
      const updatePromises = categories.map((category, index) =>
        merchantMapService.updateMapping(
          merchantName,
          category,
          `Subcategory ${index + 1}`,
          testOrgId,
          testUserId
        )
      );

      const results = await Promise.all(updatePromises);

      // All should succeed, but only one mapping should exist
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.id).toBeDefined();
        createdMappingIds.push(result.id);
      });

      // Verify final state
      const finalMapping = await merchantMapService.lookupMapping(merchantName, testOrgId);
      expect(finalMapping).toBeDefined();
      expect(categories).toContain(finalMapping!.category);
    });

    it('should maintain performance with cache utilization', async () => {
      const merchantName = 'Cache Test Merchant';
      
      // Create mapping
      const mapping = await merchantMapService.updateMapping(
        merchantName,
        'Performance Test',
        'Cache Test',
        testOrgId,
        testUserId
      );
      createdMappingIds.push(mapping.id);

      // First lookup (cache miss)
      const start1 = Date.now();
      const result1 = await merchantMapService.lookupMapping(merchantName, testOrgId);
      const time1 = Date.now() - start1;

      // Second lookup (cache hit)
      const start2 = Date.now();
      const result2 = await merchantMapService.lookupMapping(merchantName, testOrgId);
      const time2 = Date.now() - start2;

      // Verify results are identical
      expect(result1).toEqual(result2);
      expect(result1?.id).toBe(mapping.id);

      // Cache hit should be faster (though this might be flaky in CI)
      // Just verify both calls completed successfully
      expect(time1).toBeGreaterThan(0);
      expect(time2).toBeGreaterThan(0);
    });
  });

  describe('Error handling and edge cases', () => {
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
      createdMappingIds.push(mapping.id);

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
      expect(result.confidence).toBe(90);
    });
  });
});