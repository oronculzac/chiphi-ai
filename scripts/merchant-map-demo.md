# MerchantMap Learning System Demonstration

This document demonstrates how the MerchantMap learning system works to improve receipt categorization accuracy through user corrections.

## System Overview

The MerchantMap learning system implements the following requirements:
- **4.1**: Merchant mapping lookup service with database queries
- **4.2**: Merchant mapping update functionality for user corrections  
- **4.3**: Automatic application of learned mappings to new receipts
- **4.4**: Tenant-scoped merchant mapping to ensure multi-tenant isolation
- **7.2**: Multi-tenant data isolation

## Workflow Demonstration

### Step 1: Initial AI Categorization (Before Learning)

```typescript
// AI processes a receipt and makes initial categorization
const initialReceiptData: ReceiptData = {
  date: '2024-01-15',
  amount: 4.99,
  currency: 'USD',
  merchant: 'Starbucks Coffee',
  last4: null,
  category: 'Miscellaneous', // ❌ AI categorizes incorrectly
  subcategory: null,
  notes: 'Coffee purchase',
  confidence: 75, // Lower confidence due to uncertainty
  explanation: 'AI categorized based on limited context'
};
```

### Step 2: Check for Existing Mapping

```typescript
// System checks if a learned mapping exists for this merchant
const existingMapping = await merchantMapService.lookupMapping(
  'Starbucks Coffee',
  orgId
);
// Result: null (no mapping exists yet)
```

### Step 3: User Correction (Learning Phase)

```typescript
// User corrects the categorization through the UI
const userCorrection = {
  merchant: 'Starbucks Coffee',
  category: 'Food & Dining',     // ✅ Correct category
  subcategory: 'Coffee Shops'    // ✅ More specific subcategory
};

// System stores the correction as a learned mapping
const mapping = await merchantMapService.updateMapping(
  'Starbucks Coffee',
  'Food & Dining',
  'Coffee Shops',
  orgId,
  userId
);
```

**Database Storage (with RLS):**
```sql
INSERT INTO merchant_map (
  org_id,           -- Tenant isolation
  merchant_name,    -- Normalized: 'starbucks'
  category,         -- 'Food & Dining'
  subcategory,      -- 'Coffee Shops'
  created_by,       -- User who made the correction
  updated_at        -- Timestamp for most recent correction
) VALUES (...);
```

### Step 4: Apply Learned Mapping to New Receipt

```typescript
// New receipt from the same merchant (with slight name variation)
const newReceiptData: ReceiptData = {
  date: '2024-01-20',
  amount: 6.50,
  currency: 'USD',
  merchant: 'Starbucks Corporation', // Slightly different name
  last4: null,
  category: 'Miscellaneous',         // AI still categorizes incorrectly
  subcategory: null,
  confidence: 70,
  explanation: 'AI categorized based on limited context'
};

// System automatically applies learned mapping
const improvedData = await merchantMapService.applyMapping(newReceiptData, orgId);

// Result after applying mapping:
{
  ...newReceiptData,
  category: 'Food & Dining',        // ✅ Applied learned category
  subcategory: 'Coffee Shops',      // ✅ Applied learned subcategory
  confidence: 85,                   // ⬆️ Increased confidence (+15)
  explanation: 'Applied learned categorization from previous user correction. Original AI suggestion: Miscellaneous. User-corrected category: Food & Dining > Coffee Shops.'
}
```

### Step 5: Merchant Name Normalization

The system normalizes merchant names for consistent matching:

```typescript
// These variations all normalize to 'starbucks':
'STARBUCKS CORPORATION'     → 'starbucks'
'Starbucks Coffee Inc.'     → 'starbucks'
'starbucks corp'           → 'starbucks'
'Starbucks Company'        → 'starbucks'
```

This ensures that slight variations in merchant names still match existing mappings.

### Step 6: Tenant Isolation

```typescript
// Organization A's mapping
await merchantMapService.updateMapping('Starbucks', 'Food & Dining', 'Coffee', orgA, userA);

// Organization B cannot access Organization A's mapping
const mapping = await merchantMapService.lookupMapping('Starbucks', orgB);
// Result: null (RLS prevents cross-tenant access)
```

## Key Features Implemented

### ✅ Database Queries with RLS (Requirement 4.1)
- Efficient lookup using normalized merchant names
- Row-level security ensures tenant isolation
- Optimized queries with proper indexing

### ✅ User Correction Functionality (Requirement 4.2)
- Upsert operations handle both create and update scenarios
- Tracks who made the correction and when
- Supports both category and subcategory corrections

### ✅ Automatic Mapping Application (Requirement 4.3)
- Seamlessly integrates with AI processing pipeline
- Increases confidence scores when applying learned mappings
- Provides detailed explanations for transparency

### ✅ Multi-Tenant Isolation (Requirements 4.4, 7.2)
- All operations are scoped to organization ID
- RLS policies prevent cross-tenant data access
- Separate mapping tables per organization context

## API Endpoints

### GET /api/merchant-map
- Retrieve all mappings for an organization
- Includes mapping statistics and analytics

### POST /api/merchant-map
- Create or update a merchant mapping
- Validates user permissions and organization access

### GET /api/merchant-map/lookup
- Look up a specific merchant mapping
- Used by AI processing pipeline for automatic application

### DELETE /api/merchant-map
- Remove a merchant mapping (admin/owner only)
- Maintains audit trail of deletions

## React Components

### MerchantMapManager
- Full-featured management interface
- Search and filter mappings
- Add new mappings with validation
- Real-time updates via Supabase subscriptions

### useMerchantMap Hook
- React hook for merchant mapping operations
- Handles loading states and error management
- Provides real-time synchronization

## Integration with AI Pipeline

The MerchantMap service is integrated into the AI processing pipeline:

```typescript
// AI processing with merchant mapping
const result = await aiProcessingPipeline.processReceiptText(receiptText, orgId);

// Pipeline automatically:
// 1. Detects language and translates if needed
// 2. Extracts structured data using AI
// 3. Looks up learned merchant mappings
// 4. Applies mappings if found
// 5. Returns improved categorization with higher confidence
```

## Benefits

1. **Improved Accuracy**: System learns from user corrections and applies them automatically
2. **Reduced Manual Work**: Users only need to correct each merchant once
3. **Transparency**: All AI decisions include detailed explanations
4. **Security**: Multi-tenant isolation ensures data privacy
5. **Scalability**: Efficient database queries and caching support high volume
6. **Flexibility**: Supports both category and subcategory corrections

This implementation successfully fulfills all requirements for the MerchantMap learning system, providing a robust foundation for improving receipt categorization accuracy through machine learning from user feedback.