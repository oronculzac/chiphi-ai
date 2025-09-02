# Email Provider Abstraction Patterns

## Provider Interface Requirements
- All providers must implement `InboundEmailProvider` interface
- Payload normalization is mandatory for consistent processing
- HMAC verification must be provider-specific but standardized
- Error handling should include provider context

## Configuration Management
- Use `INBOUND_PROVIDER` environment variable for provider selection
- Provider-specific secrets should be clearly named
- Support runtime provider switching for testing
- Validate provider configuration on startup

## Testing Provider Implementations
- Create contract tests for each provider adapter
- Use synthetic payloads that match real provider formats
- Test idempotency enforcement across providers
- Verify error handling and fallback mechanisms

## Provider Migration Strategy
- Deploy with feature flags to enable gradual rollout
- Monitor error rates and performance during migration
- Maintain backward compatibility during transitions
- Document provider-specific configuration requirements

## Implementation Patterns

### Provider Interface
```typescript
export interface InboundEmailProvider {
  verify(req: Request): Promise<boolean>;
  parse(req: Request): Promise<InboundEmailPayload>;
}
```

### Provider Factory Pattern
```typescript
export class ProviderFactory {
  static createProvider(providerName: string): InboundEmailProvider {
    switch (providerName) {
      case 'cloudflare': return new CloudflareAdapter();
      case 'ses': return new SESAdapter();
      default: throw new Error(`Unknown provider: ${providerName}`);
    }
  }
}
```

### Error Handling
- Log provider-specific errors with context
- Implement fallback mechanisms when available
- Use correlation IDs for request tracing
- Sanitize error messages for security

### Idempotency Enforcement
- Check message ID uniqueness per organization
- Use database constraints for duplicate prevention
- Log duplicate attempts for monitoring
- Return success for already-processed messages