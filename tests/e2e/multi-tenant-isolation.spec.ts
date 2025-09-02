/**
 * Multi-Tenant Isolation Tests
 * 
 * Comprehensive tests to verify Row Level Security (RLS) and data isolation
 * between different organizations and users
 */

import { test, expect } from '@playwright/test';
import { AuthHelper, EmailHelper, DashboardHelper } from '../utils/test-helpers';
import { getTestOrg, getTestUser } from '../fixtures/test-organizations';
import { getEmailSample } from '../fixtures/email-samples';
import { validateTenantIsolationTest } from '@/lib/types/test-schemas';

test.describe('Multi-Tenant Isolation', () => {
  let authHelper: AuthHelper;
  let emailHelper: EmailHelper;
  let dashboardHelper: DashboardHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    emailHelper = new EmailHelper(page);
    dashboardHelper = new DashboardHelper(page);
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should isolate transaction data between organizations', async ({ page }) => {
    // Step 1: Setup test data for two organizations
    const org1 = getTestOrg('primary');
    const org2 = getTestOrg('secondary');
    const user1 = getTestUser('primaryOwner');
    const user2 = getTestUser('secondaryOwner');

    const isolationTest = {
      tenant1: {
        orgId: org1.id,
        userId: user1.id,
        inboxAlias: org1.inboxAlias,
        testTransactions: [
          { id: 'tx1-org1', amount: 25.50, merchant: 'Starbucks Org1', category: 'Food & Dining' },
          { id: 'tx2-org1', amount: 45.75, merchant: 'Whole Foods Org1', category: 'Groceries' },
        ],
      },
      tenant2: {
        orgId: org2.id,
        userId: user2.id,
        inboxAlias: org2.inboxAlias,
        testTransactions: [
          { id: 'tx1-org2', amount: 15.25, merchant: 'Starbucks Org2', category: 'Food & Dining' },
          { id: 'tx2-org2', amount: 85.99, merchant: 'Target Org2', category: 'Shopping' },
        ],
      },
      isolationTests: [
        { testName: 'transaction_visibility', description: 'Users should only see their org transactions', expectedIsolation: true },
        { testName: 'dashboard_stats', description: 'Dashboard stats should be org-specific', expectedIsolation: true },
        { testName: 'email_processing', description: 'Emails should only process for correct org', expectedIsolation: true },
      ],
    };

    validateTenantIsolationTest(isolationTest);

    // Step 2: Create transactions for Organization 1
    await authHelper.loginAsUser('primaryOwner');
    
    for (const txData of isolationTest.tenant1.testTransactions) {
      const emailData = {
        ...getEmailSample('starbucksCoffee'),
        messageId: `${txData.id}@test.com`,
        to: isolationTest.tenant1.inboxAlias,
        expectedAmount: txData.amount,
        expectedMerchant: txData.merchant,
        expectedCategory: txData.category,
      };
      
      await emailHelper.sendTestEmail(emailData);
      await emailHelper.waitForEmailProcessing(emailData.messageId);
    }

    // Verify Org1 can see their transactions
    await dashboardHelper.navigateToDashboard();
    await page.goto('/dashboard/transactions');
    
    const org1Transactions = page.locator('[data-testid^="transaction-"]');
    await expect(org1Transactions).toHaveCount(2);
    
    await expect(page.locator('text=Starbucks Org1')).toBeVisible();
    await expect(page.locator('text=Whole Foods Org1')).toBeVisible();
    
    // Verify Org1 dashboard stats
    await dashboardHelper.navigateToDashboard();
    const expectedOrg1Total = isolationTest.tenant1.testTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    await dashboardHelper.waitForStatsUpdate({
      monthToDateTotal: expectedOrg1Total,
      transactionCount: 2,
      categoryBreakdown: [
        { category: 'Food & Dining', amount: 25.50, percentage: 0, count: 1 },
        { category: 'Groceries', amount: 45.75, percentage: 0, count: 1 },
      ],
      spendingTrend: [],
    });

    await authHelper.logout();

    // Step 3: Create transactions for Organization 2
    await authHelper.loginAsUser('secondaryOwner');
    
    for (const txData of isolationTest.tenant2.testTransactions) {
      const emailData = {
        ...getEmailSample('wholeFoodsGrocery'),
        messageId: `${txData.id}@test.com`,
        to: isolationTest.tenant2.inboxAlias,
        expectedAmount: txData.amount,
        expectedMerchant: txData.merchant,
        expectedCategory: txData.category,
      };
      
      await emailHelper.sendTestEmail(emailData);
      await emailHelper.waitForEmailProcessing(emailData.messageId);
    }

    // Verify Org2 can see only their transactions
    await dashboardHelper.navigateToDashboard();
    await page.goto('/dashboard/transactions');
    
    const org2Transactions = page.locator('[data-testid^="transaction-"]');
    await expect(org2Transactions).toHaveCount(2);
    
    await expect(page.locator('text=Starbucks Org2')).toBeVisible();
    await expect(page.locator('text=Target Org2')).toBeVisible();
    
    // Verify Org2 cannot see Org1 transactions
    await expect(page.locator('text=Starbucks Org1')).not.toBeVisible();
    await expect(page.locator('text=Whole Foods Org1')).not.toBeVisible();
    
    // Verify Org2 dashboard stats (should not include Org1 data)
    await dashboardHelper.navigateToDashboard();
    const expectedOrg2Total = isolationTest.tenant2.testTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    await dashboardHelper.waitForStatsUpdate({
      monthToDateTotal: expectedOrg2Total,
      transactionCount: 2,
      categoryBreakdown: [
        { category: 'Food & Dining', amount: 15.25, percentage: 0, count: 1 },
        { category: 'Shopping', amount: 85.99, percentage: 0, count: 1 },
      ],
      spendingTrend: [],
    });

    // Step 4: Verify API-level isolation
    const org1TransactionsResponse = await page.request.get('/api/transactions');
    const org1TransactionsData = await org1TransactionsResponse.json();
    
    expect(org1TransactionsData.data).toHaveLength(2);
    expect(org1TransactionsData.data.every((tx: any) => tx.org_id === isolationTest.tenant2.orgId)).toBe(true);
    
    // Attempt to access Org1 transaction directly (should fail)
    const unauthorizedResponse = await page.request.get(`/api/transactions/${isolationTest.tenant1.testTransactions[0].id}`);
    expect(unauthorizedResponse.status()).toBe(404); // Should not find due to RLS
  });

  test('should isolate email processing between organizations', async ({ page }) => {
    const org1 = getTestOrg('primary');
    const org2 = getTestOrg('secondary');

    // Step 1: Login as Org1 user
    await authHelper.loginAsUser('primaryOwner');

    // Step 2: Send email to Org2 inbox alias (should be rejected or ignored)
    const crossOrgEmailData = {
      ...getEmailSample('starbucksCoffee'),
      messageId: 'cross-org-test@test.com',
      to: org2.inboxAlias, // Wrong organization
      from: 'external@example.com',
    };

    const response = await emailHelper.sendTestEmail(crossOrgEmailData);
    
    // Email should be received but not processed for wrong org
    expect(response.status()).toBe(200);

    // Step 3: Verify email was not processed for current org
    try {
      await emailHelper.waitForEmailProcessing(crossOrgEmailData.messageId, 10000);
      throw new Error('Email should not have been processed');
    } catch (error) {
      expect(error.message).toContain('timeout');
    }

    // Step 4: Verify no transaction was created in current org
    await page.goto('/dashboard/transactions');
    const transactions = page.locator('[data-testid^="transaction-"]');
    await expect(transactions).toHaveCount(0);

    // Step 5: Switch to correct organization and verify email is processed there
    await authHelper.logout();
    await authHelper.loginAsUser('secondaryOwner');

    // The email should now be processed for the correct organization
    const processingResult = await emailHelper.waitForEmailProcessing(crossOrgEmailData.messageId);
    expect(processingResult.success).toBe(true);

    // Verify transaction appears in correct org
    await page.goto('/dashboard/transactions');
    const org2Transactions = page.locator('[data-testid^="transaction-"]');
    await expect(org2Transactions).toHaveCount(1);
  });

  test('should isolate merchant mappings between organizations', async ({ page }) => {
    const org1 = getTestOrg('primary');
    const org2 = getTestOrg('secondary');

    // Step 1: Create merchant mapping in Org1
    await authHelper.loginAsUser('primaryOwner');
    
    const starbucksEmailOrg1 = {
      ...getEmailSample('starbucksCoffee'),
      messageId: 'starbucks-org1@test.com',
      to: org1.inboxAlias,
    };

    await emailHelper.sendTestEmail(starbucksEmailOrg1);
    await emailHelper.waitForEmailProcessing(starbucksEmailOrg1.messageId);

    // Correct the category to create a merchant mapping
    await page.goto('/dashboard/transactions');
    const transactionRow = page.locator('[data-testid^="transaction-"]').first();
    await transactionRow.click();

    await page.click('[data-testid="edit-category-button"]');
    await page.selectOption('[data-testid="category-select"]', 'Entertainment'); // Different from default
    await page.click('[data-testid="save-category-button"]');

    // Wait for merchant mapping to be created
    await page.waitForTimeout(2000);

    await authHelper.logout();

    // Step 2: Process same merchant in Org2
    await authHelper.loginAsUser('secondaryOwner');
    
    const starbucksEmailOrg2 = {
      ...getEmailSample('starbucksCoffee'),
      messageId: 'starbucks-org2@test.com',
      to: org2.inboxAlias,
    };

    await emailHelper.sendTestEmail(starbucksEmailOrg2);
    await emailHelper.waitForEmailProcessing(starbucksEmailOrg2.messageId);

    // Step 3: Verify Org2 doesn't use Org1's merchant mapping
    const transaction = await emailHelper.verifyTransactionCreated(starbucksEmailOrg2.messageId, starbucksEmailOrg2);
    
    // Should use default AI categorization, not Org1's custom mapping
    expect(transaction.category).toBe('Food & Dining'); // Default, not 'Entertainment'
    expect(transaction.confidence).toBeLessThan(100); // AI-based, not learned mapping

    // Step 4: Verify merchant mapping isolation via API
    const merchantMappingsResponse = await page.request.get('/api/merchant-mappings');
    const merchantMappings = await merchantMappingsResponse.json();
    
    // Should only see Org2's mappings (none yet)
    expect(merchantMappings.data).toHaveLength(0);

    // Step 5: Create mapping in Org2 and verify it doesn't affect Org1
    await page.goto('/dashboard/transactions');
    const org2TransactionRow = page.locator('[data-testid^="transaction-"]').first();
    await org2TransactionRow.click();

    await page.click('[data-testid="edit-category-button"]');
    await page.selectOption('[data-testid="category-select"]', 'Business'); // Different from both default and Org1
    await page.click('[data-testid="save-category-button"]');

    await authHelper.logout();

    // Step 6: Verify Org1 still uses its own mapping
    await authHelper.loginAsUser('primaryOwner');
    
    const starbucksEmailOrg1Again = {
      ...getEmailSample('starbucksCoffee'),
      messageId: 'starbucks-org1-again@test.com',
      to: org1.inboxAlias,
    };

    await emailHelper.sendTestEmail(starbucksEmailOrg1Again);
    await emailHelper.waitForEmailProcessing(starbucksEmailOrg1Again.messageId);

    const org1Transaction = await emailHelper.verifyTransactionCreated(starbucksEmailOrg1Again.messageId, starbucksEmailOrg1Again);
    
    // Should use Org1's mapping (Entertainment), not Org2's (Business) or default (Food & Dining)
    expect(org1Transaction.category).toBe('Entertainment');
    expect(org1Transaction.confidence).toBeGreaterThan(95); // High confidence from learned mapping
  });

  test('should isolate user roles and permissions within organization', async ({ page }) => {
    const org = getTestOrg('primary');

    // Step 1: Test owner permissions
    await authHelper.loginAsUser('primaryOwner');
    
    // Owner should see admin functions
    await page.goto('/dashboard/settings');
    await expect(page.locator('[data-testid="org-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-settings"]')).toBeVisible();

    await authHelper.logout();

    // Step 2: Test admin permissions
    await authHelper.loginAsUser('primaryAdmin');
    
    // Admin should see some admin functions but not billing
    await page.goto('/dashboard/settings');
    await expect(page.locator('[data-testid="org-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-settings"]')).not.toBeVisible();

    await authHelper.logout();

    // Step 3: Test member permissions
    await authHelper.loginAsUser('primaryMember');
    
    // Member should not see admin functions
    await page.goto('/dashboard/settings');
    await expect(page.locator('[data-testid="org-settings"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="user-management"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="billing-settings"]')).not.toBeVisible();
    
    // But should see personal settings
    await expect(page.locator('[data-testid="personal-settings"]')).toBeVisible();

    // Step 4: Test API-level permission enforcement
    const adminOnlyResponse = await page.request.get('/api/admin/users');
    expect(adminOnlyResponse.status()).toBe(403); // Forbidden for member

    const ownerOnlyResponse = await page.request.get('/api/admin/billing');
    expect(ownerOnlyResponse.status()).toBe(403); // Forbidden for member
  });

  test('should prevent cross-tenant data access via direct API calls', async ({ page }) => {
    const org1 = getTestOrg('primary');
    const org2 = getTestOrg('secondary');

    // Step 1: Create transaction in Org1
    await authHelper.loginAsUser('primaryOwner');
    
    const emailData = getEmailSample('starbucksCoffee');
    await emailHelper.sendTestEmail(emailData);
    await emailHelper.waitForEmailProcessing(emailData.messageId);
    
    const transaction = await emailHelper.verifyTransactionCreated(emailData.messageId, emailData);
    const org1TransactionId = transaction.id;

    await authHelper.logout();

    // Step 2: Login as Org2 user and attempt to access Org1 transaction
    await authHelper.loginAsUser('secondaryOwner');

    // Direct API access should be blocked by RLS
    const unauthorizedResponse = await page.request.get(`/api/transactions/${org1TransactionId}`);
    expect(unauthorizedResponse.status()).toBe(404); // Not found due to RLS

    // Attempt to update Org1 transaction should fail
    const updateResponse = await page.request.put(`/api/transactions/${org1TransactionId}`, {
      data: { category: 'Hacked Category' },
    });
    expect(updateResponse.status()).toBe(404); // Not found due to RLS

    // Attempt to delete Org1 transaction should fail
    const deleteResponse = await page.request.delete(`/api/transactions/${org1TransactionId}`);
    expect(deleteResponse.status()).toBe(404); // Not found due to RLS

    // Step 3: Verify Org1 transaction is still intact
    await authHelper.logout();
    await authHelper.loginAsUser('primaryOwner');

    const verifyResponse = await page.request.get(`/api/transactions/${org1TransactionId}`);
    expect(verifyResponse.status()).toBe(200);
    
    const verifyData = await verifyResponse.json();
    expect(verifyData.data.category).toBe('Food & Dining'); // Original category, not hacked
  });

  test('should isolate rate limiting between organizations', async ({ page }) => {
    // This test would verify that rate limits are applied per organization
    // and one org hitting limits doesn't affect another org
    
    const org1 = getTestOrg('primary');
    const org2 = getTestOrg('secondary');

    // Step 1: Hit rate limit for Org1
    await authHelper.loginAsUser('primaryOwner');
    
    // Send many emails quickly to trigger rate limit
    const rapidEmails = Array.from({ length: 20 }, (_, i) => ({
      ...getEmailSample('starbucksCoffee'),
      messageId: `rapid-${i}@test.com`,
      to: org1.inboxAlias,
    }));

    const rapidPromises = rapidEmails.map(email => emailHelper.sendTestEmail(email));
    const rapidResponses = await Promise.all(rapidPromises);

    // Some should succeed, some should be rate limited
    const successCount = rapidResponses.filter(r => r.status() === 200).length;
    const rateLimitedCount = rapidResponses.filter(r => r.status() === 429).length;
    
    expect(rateLimitedCount).toBeGreaterThan(0); // Some should be rate limited
    expect(successCount).toBeGreaterThan(0); // Some should succeed

    await authHelper.logout();

    // Step 2: Verify Org2 is not affected by Org1's rate limiting
    await authHelper.loginAsUser('secondaryOwner');
    
    const org2Email = {
      ...getEmailSample('wholeFoodsGrocery'),
      messageId: 'org2-after-rate-limit@test.com',
      to: org2.inboxAlias,
    };

    const org2Response = await emailHelper.sendTestEmail(org2Email);
    expect(org2Response.status()).toBe(200); // Should not be rate limited

    await emailHelper.waitForEmailProcessing(org2Email.messageId);
    await emailHelper.verifyTransactionCreated(org2Email.messageId, org2Email);
  });

  test('should maintain isolation during concurrent operations', async ({ page, context }) => {
    // Test isolation when multiple orgs are processing emails simultaneously
    
    const org1 = getTestOrg('primary');
    const org2 = getTestOrg('secondary');

    // Step 1: Create concurrent browser contexts for different orgs
    const org1Context = await context.browser()?.newContext();
    const org2Context = await context.browser()?.newContext();
    
    if (!org1Context || !org2Context) {
      throw new Error('Failed to create browser contexts');
    }

    const org1Page = await org1Context.newPage();
    const org2Page = await org2Context.newPage();

    const org1AuthHelper = new AuthHelper(org1Page);
    const org2AuthHelper = new AuthHelper(org2Page);
    const org1EmailHelper = new EmailHelper(org1Page);
    const org2EmailHelper = new EmailHelper(org2Page);

    // Step 2: Login to both orgs simultaneously
    await Promise.all([
      org1AuthHelper.loginAsUser('primaryOwner'),
      org2AuthHelper.loginAsUser('secondaryOwner'),
    ]);

    // Step 3: Send emails to both orgs simultaneously
    const org1Emails = Array.from({ length: 5 }, (_, i) => ({
      ...getEmailSample('starbucksCoffee'),
      messageId: `concurrent-org1-${i}@test.com`,
      to: org1.inboxAlias,
      expectedAmount: 10 + i,
    }));

    const org2Emails = Array.from({ length: 5 }, (_, i) => ({
      ...getEmailSample('wholeFoodsGrocery'),
      messageId: `concurrent-org2-${i}@test.com`,
      to: org2.inboxAlias,
      expectedAmount: 20 + i,
    }));

    const allEmailPromises = [
      ...org1Emails.map(email => org1EmailHelper.sendTestEmail(email)),
      ...org2Emails.map(email => org2EmailHelper.sendTestEmail(email)),
    ];

    const allResponses = await Promise.all(allEmailPromises);
    allResponses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    // Step 4: Wait for all processing to complete
    const allProcessingPromises = [
      ...org1Emails.map(email => org1EmailHelper.waitForEmailProcessing(email.messageId)),
      ...org2Emails.map(email => org2EmailHelper.waitForEmailProcessing(email.messageId)),
    ];

    const allProcessingResults = await Promise.all(allProcessingPromises);
    allProcessingResults.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Step 5: Verify each org only sees their own transactions
    await org1Page.goto('/dashboard/transactions');
    const org1Transactions = org1Page.locator('[data-testid^="transaction-"]');
    await expect(org1Transactions).toHaveCount(5);

    await org2Page.goto('/dashboard/transactions');
    const org2Transactions = org2Page.locator('[data-testid^="transaction-"]');
    await expect(org2Transactions).toHaveCount(5);

    // Step 6: Verify dashboard stats are isolated
    const org1ExpectedTotal = org1Emails.reduce((sum, email) => sum + (email.expectedAmount || 0), 0);
    const org2ExpectedTotal = org2Emails.reduce((sum, email) => sum + (email.expectedAmount || 0), 0);

    await org1Page.goto('/dashboard');
    await expect(org1Page.locator('[data-testid="mtd-total"]')).toContainText(`$${org1ExpectedTotal}`);

    await org2Page.goto('/dashboard');
    await expect(org2Page.locator('[data-testid="mtd-total"]')).toContainText(`$${org2ExpectedTotal}`);

    // Cleanup
    await org1Context.close();
    await org2Context.close();
  });
});