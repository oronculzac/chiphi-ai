# AI Processing and Learning Patterns

## AI Service Integration

### OpenAI API Usage
- Use `gpt-4o-mini` model for cost-effective processing
- Implement retry mechanisms with exponential backoff
- Monitor token usage and costs per organization
- Set appropriate timeout values for AI requests

### Confidence Scoring
- All AI decisions must include confidence scores (0-100)
- Flag transactions below 70% confidence for manual review
- Provide explanations for all categorization decisions
- Track confidence score accuracy over time

### Translation Pipeline
- Detect source language before translation
- Preserve both original and translated text
- Implement translation caching for common phrases
- Handle translation failures gracefully

## MerchantMap Learning System

### Learning from Corrections
```typescript
// When user corrects a transaction
await merchantMapService.updateMapping({
  orgId,
  merchantName,
  category: correctedCategory,
  subcategory: correctedSubcategory,
  confidence: 100, // User corrections have 100% confidence
  source: 'user_correction'
});
```

### Categorization Logic
1. Check MerchantMap for existing learned mappings
2. If no mapping exists, use AI categorization
3. Apply confidence scoring based on source
4. Provide explanation for categorization decision

### Multi-tenant Learning
- Merchant mappings are scoped to organizations
- User corrections only affect their organization's mappings
- No cross-tenant learning to maintain privacy
- Track learning effectiveness per organization

## Data Extraction Patterns

### Structured JSON Output
```typescript
interface TransactionData {
  date: string;           // ISO date format
  amount: number;         // Decimal amount
  currency: string;       // ISO currency code
  merchant: string;       // Merchant name
  last4?: string;        // Last 4 digits of payment method
  category: string;       // Primary category
  subcategory?: string;   // Optional subcategory
  notes?: string;        // Additional notes
  confidence: number;     // 0-100 confidence score
  explanation: string;    // Reasoning for categorization
}
```

### PII Redaction
- Automatically detect and redact full credit card numbers
- Store only last 4 digits when available
- Remove 2FA codes and authentication tokens
- Sanitize personal information from receipt text

### Error Handling in AI Processing
- Implement circuit breakers for AI service failures
- Provide fallback categorization when AI is unavailable
- Log AI processing errors with context
- Retry failed AI requests with backoff strategy

## Performance Optimization

### Caching Strategies
- Cache translation results for common phrases
- Cache merchant categorization mappings
- Implement request deduplication for similar receipts
- Use database indexes for fast merchant lookups

### Batch Processing
- Process multiple emails in batches when possible
- Implement queue-based processing for scalability
- Use connection pooling for database operations
- Monitor processing times and optimize bottlenecks

### Cost Management
- Track AI API usage and costs per organization
- Implement usage limits and alerts
- Optimize prompts for token efficiency
- Use caching to reduce redundant API calls

## Quality Assurance

### Accuracy Monitoring
- Track categorization accuracy over time
- Monitor user correction rates by category
- Implement A/B testing for prompt improvements
- Generate accuracy reports for system optimization

### Data Validation
- Validate extracted data against expected schemas
- Check for reasonable date ranges and amounts
- Verify currency codes and merchant names
- Flag suspicious or anomalous transactions

### Continuous Improvement
- Analyze user corrections to improve AI prompts
- Monitor confidence score calibration
- Track processing success rates
- Implement feedback loops for system learning