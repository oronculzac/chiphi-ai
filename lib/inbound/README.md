# Inbound Email Provider Abstraction

This module provides a unified interface for handling inbound emails from different providers (Cloudflare Workers Email Routing, Amazon SES, etc.).

## Overview

The inbound email provider abstraction allows the system to switch between different email providers through configuration without code changes. All providers implement a common interface and normalize their payloads to a standard format.

## Core Components

### Interfaces

- **`InboundEmailProvider`**: Core interface that all providers must implement
- **`InboundEmailPayload`**: Normalized email payload structure
- **`ProviderConfig`**: Configuration interface for providers
- **`EmailProcessingContext`**: Context for tracking email processing

### Error Handling

- **`ProviderError`**: Base error class for provider-related errors
- **`ProviderVerificationError`**: HMAC/signature verification failures
- **`ProviderParsingError`**: Payload parsing failures
- **`ProviderConfigurationError`**: Configuration validation failures

### Validation

All payloads are validated using Zod schemas:
- `InboundEmailPayloadSchema`: Validates normalized email payloads
- `CloudflarePayloadSchema`: Validates Cloudflare-specific payloads
- `SESPayloadSchema`: Validates SES SNS notification payloads

## Usage

### Basic Provider Implementation

```typescript
import { InboundEmailProvider, InboundEmailPayload } from '@/lib/inbound';

export class MyProvider implements InboundEmailProvider {
  async verify(req: Request): Promise<boolean> {
    // Implement HMAC verification
    return true;
  }

  async parse(req: Request): Promise<InboundEmailPayload> {
    // Parse provider-specific format
    const body = await req.json();
    return this.normalizePayload(body);
  }

  getName(): string {
    return 'my-provider';
  }

  private normalizePayload(body: any): InboundEmailPayload {
    // Convert to normalized format
    return {
      alias: body.to,
      messageId: body.id,
      from: body.sender,
      to: body.recipient,
      text: body.content,
      // ... other fields
    };
  }
}
```

### Provider Registration

```typescript
import { globalProviderRegistry } from '@/lib/inbound';

// Register a provider
globalProviderRegistry.register('my-provider', new MyProvider());

// Get a provider
const provider = globalProviderRegistry.get('my-provider');

// List all providers
const providers = globalProviderRegistry.list();
```

### Email Processing

```typescript
import { 
  createProcessingContext,
  validateEmailPayload,
  extractOrgSlugFromAlias 
} from '@/lib/inbound';

// Create processing context
const payload = await provider.parse(request);
const context = createProcessingContext(payload, 'my-provider');

// Validate payload
const validatedPayload = validateEmailPayload(payload, 'my-provider');

// Extract organization
const orgSlug = extractOrgSlugFromAlias(payload.alias);
```

## Supported Providers

### Cloudflare Workers Email Routing

- Handles Cloudflare's email routing webhook format
- Supports HMAC verification (when configured)
- Normalizes attachment data from base64 content

### Amazon SES Receive

- Handles SES SNS notification format
- Supports SNS signature verification
- Extracts email data from nested mail object

## Configuration

Providers are configured through environment variables:

```env
# Provider selection
INBOUND_PROVIDER=cloudflare

# Provider-specific secrets
CLOUDFLARE_EMAIL_SECRET=your-webhook-secret
SES_WEBHOOK_SECRET=your-sns-secret
```

## Validation and Security

### Input Validation

All payloads are validated using Zod schemas:
- Email addresses must be valid
- Aliases must match `u_<slug>@inbox.chiphi.ai` format
- Message IDs must be alphanumeric with limited special characters
- Content must be sanitized for security

### Security Features

- HMAC signature verification for all providers
- Content sanitization to remove scripts and malicious content
- PII redaction utilities
- Request correlation tracking
- Error context logging

## Utilities

### Content Normalization

```typescript
import { normalizeEmailContent, sanitizeEmailContent } from '@/lib/inbound';

// Normalize whitespace and formatting
const normalized = normalizeEmailContent(rawContent);

// Sanitize for security
const sanitized = sanitizeEmailContent(htmlContent);
```

### Attachment Handling

```typescript
import { normalizeAttachments } from '@/lib/inbound';

// Normalize attachments from different providers
const attachments = normalizeAttachments(rawAttachments, 'cloudflare');
```

### Error Handling

```typescript
import { 
  ProviderError, 
  createErrorContext,
  calculateProcessingMetrics 
} from '@/lib/inbound';

try {
  // Process email
} catch (error) {
  if (error instanceof ProviderError) {
    const errorContext = createErrorContext(error, processingContext);
    // Log with context
  }
}
```

## Testing

The module includes comprehensive tests:

```bash
# Run all inbound provider tests
npm test lib/inbound/__tests__

# Run specific test file
npm test lib/inbound/__tests__/types.test.ts
npm test lib/inbound/__tests__/utils.test.ts
```

## File Structure

```
lib/inbound/
├── index.ts           # Main exports
├── types.ts           # Core types and interfaces
├── utils.ts           # Utility functions
├── validation.ts      # Validation helpers
├── registry.ts        # Provider registry
├── README.md          # This documentation
└── __tests__/         # Test files
    ├── types.test.ts
    └── utils.test.ts
```

## Next Steps

After implementing this abstraction layer, you can:

1. Create specific provider adapters (CloudflareAdapter, SESAdapter)
2. Implement the provider factory for runtime switching
3. Update the inbound API route to use the abstraction
4. Add provider-specific health checks and monitoring

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **2.1**: Unified InboundEmailProvider interface
- **2.2**: Provider configuration management with ProviderConfig
- **2.3**: Payload normalization utilities and validation schemas
- **Error handling**: Provider-specific error types and handling interfaces
- **Validation**: Zod schemas for all provider payloads