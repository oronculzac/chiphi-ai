# AI Processing Services

This document describes the AI processing pipeline services implemented for ChiPhi AI.

## Overview

The AI processing pipeline consists of three main services that work together to process receipt emails:

1. **LanguageNormalizer** - Detects language and translates non-English receipts
2. **DataExtractor** - Extracts structured data from receipt text
3. **AIProcessingPipeline** - Orchestrates the complete processing workflow

## Services

### LanguageNormalizer

Located: `lib/services/ai-language-normalizer.ts`

**Purpose**: Handles language detection and translation of receipt text to English.

**Key Methods**:
- `detectLanguage(text: string)` - Detects the language of receipt text
- `translateToEnglish(text: string, sourceLanguage: string)` - Translates text to English
- `normalizeText(text: string)` - Complete normalization pipeline

**Requirements Satisfied**:
- 2.1: Language detection for non-English receipts
- 2.2: Translation to English before extraction
- 2.3: Preservation of original and translated versions

### DataExtractor

Located: `lib/services/ai-data-extractor.ts`

**Purpose**: Extracts structured JSON data from normalized receipt text.

**Key Methods**:
- `extractReceiptData(text: string)` - Extract structured data from receipt
- `extractReceiptDataWithRetry(text: string, maxRetries: number)` - Extract with retry logic

**Security Features**:
- PAN (Primary Account Number) detection and rejection
- Last4 digits validation
- Sensitive data redaction

**Requirements Satisfied**:
- 3.1: Structured JSON extraction
- 3.2: Required data fields (date, amount, currency, merchant, etc.)
- 3.3: PAN redaction and last4 storage
- 3.4: Confidence scoring (0-100)
- 3.5: Explanation generation

### AIProcessingPipeline

Located: `lib/services/ai-processing-pipeline.ts`

**Purpose**: Orchestrates the complete AI processing workflow.

**Key Methods**:
- `processReceiptText(text: string)` - Complete processing pipeline
- `processReceiptTextRobust(text: string)` - Processing with partial result handling
- `validateProcessingResult(result: ProcessingResult)` - Result validation
- `getProcessingStats(result: ProcessingResult)` - Processing statistics

**Features**:
- Error handling and recovery
- Processing time tracking
- Partial result handling
- Result validation

## Data Structures

### ReceiptData
```typescript
interface ReceiptData {
  date: string;           // YYYY-MM-DD format
  amount: number;         // Positive number
  currency: string;       // 3-letter currency code
  merchant: string;       // Merchant name
  last4: string | null;   // Last 4 digits of card (if available)
  category: string;       // Primary category
  subcategory: string | null; // Optional subcategory
  notes: string | null;   // Additional notes
  confidence: number;     // 0-100 confidence score
  explanation: string;    // AI decision explanation
}
```

### TranslationResult
```typescript
interface TranslationResult {
  translatedText: string; // English translation
  originalText: string;   // Original text
  sourceLanguage: string; // Detected source language
  confidence: number;     // Translation confidence (0-1)
}
```

### ProcessingResult
```typescript
interface ProcessingResult {
  receiptData: ReceiptData;
  translationResult: TranslationResult;
  processingTimeMs: number;
}
```

## Configuration

The AI services use configuration from `lib/config.ts`:

```typescript
config.openai: {
  apiKey: string;    // OpenAI API key
  model: string;     // Model to use (default: gpt-4o-mini)
  maxTokens: number; // Maximum tokens per request
}
```

## Error Handling

### Language Detection Errors
- Empty text validation
- API failure handling
- Invalid JSON response handling

### Translation Errors
- Graceful fallback to original text
- Confidence scoring reflects failures
- Error logging for debugging

### Data Extraction Errors
- Schema validation with Zod
- PAN detection and security violations
- Retry logic for transient failures
- Input validation

### Pipeline Errors
- Stage-specific error identification
- Partial result preservation
- Processing time tracking
- Comprehensive error logging

## Security Features

### PAN Protection
- Automatic detection of credit card numbers (13-19 digits)
- Rejection of responses containing full PANs
- Validation of last4 format (exactly 4 digits)
- Security violation logging

### Input Validation
- Empty string rejection
- Text length validation
- Schema validation with Zod
- Type safety with TypeScript

## Usage Examples

### Basic Processing
```typescript
import { aiProcessingPipeline } from '@/lib/services/ai-processing-pipeline';

const result = await aiProcessingPipeline.processReceiptText(receiptText);
console.log('Extracted data:', result.receiptData);
console.log('Translation:', result.translationResult);
```

### Robust Processing with Error Handling
```typescript
const result = await aiProcessingPipeline.processReceiptTextRobust(receiptText);

if ('receiptData' in result) {
  // Success
  console.log('Processing completed:', result);
} else {
  // Error with partial results
  console.log('Processing failed at stage:', result.stage);
  console.log('Partial results:', result.partialResult);
}
```

### Individual Service Usage
```typescript
import { languageNormalizer } from '@/lib/services/ai-language-normalizer';
import { dataExtractor } from '@/lib/services/ai-data-extractor';

// Language normalization
const translation = await languageNormalizer.normalizeText(receiptText);

// Data extraction
const receiptData = await dataExtractor.extractReceiptData(translation.translatedText);
```

## Testing

The AI services include comprehensive input validation and error handling. They have been tested for:

- Service instantiation and method availability
- Input validation (empty strings, invalid data)
- Error handling and recovery
- Security features (PAN detection)
- Integration with Next.js environment

## Integration Points

The AI services integrate with:

- **Email Processing Pipeline**: Processes parsed email content
- **Database Storage**: Stores extracted transaction data
- **MerchantMap Learning**: Updates merchant categorization
- **Real-time Dashboard**: Provides processed data for display
- **Export Functions**: Formats data for external systems

## Performance Considerations

- **Parallel Processing**: Translation and extraction can be optimized
- **Caching**: Translation results can be cached for duplicate content
- **Retry Logic**: Exponential backoff for transient failures
- **Timeout Handling**: Configurable timeouts for AI API calls
- **Rate Limiting**: Respects OpenAI API rate limits

## Monitoring and Logging

- Processing time tracking
- Confidence score monitoring
- Error rate tracking
- API usage logging
- Security violation alerts