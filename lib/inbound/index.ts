/**
 * Inbound Email Provider Abstraction
 * 
 * This module provides a unified interface for handling inbound emails
 * from different providers (Cloudflare Workers Email Routing, Amazon SES, etc.)
 */

// Core types and interfaces
export type {
  InboundEmailPayload,
  InboundEmailProvider,
  ProviderConfig,
  ProviderRegistry,
  EmailProcessingContext,
  ProviderHealthCheck,
} from './types';

// Error classes
export {
  ProviderError,
  ProviderVerificationError,
  ProviderParsingError,
  ProviderConfigurationError,
} from './types';

// Validation schemas
export {
  InboundEmailPayloadSchema,
  ProviderConfigSchema,
  CloudflarePayloadSchema,
  SESPayloadSchema,
  SESMailSchema,
} from './types';

// Utility functions from types
export {
  extractOrgSlugFromAlias,
  isValidAlias,
  normalizeEmailContent,
  sanitizeMetadata,
  generateCorrelationId,
  isCloudflarePayload,
  isSESPayload,
} from './types';

// Utility functions from utils
export {
  createProcessingContext,
  normalizeAttachments,
  extractEmailContent,
  validateMessageId,
  extractEmailAddresses,
  calculateProcessingMetrics,
  createErrorContext,
  validateAndParseAlias,
  sanitizeEmailContent,
} from './utils';

// Provider registry
export {
  EmailProviderRegistry,
  globalProviderRegistry,
} from './registry';

// Validation utilities
export {
  validateEmailPayload,
  validateProviderConfig,
  validateCloudflarePayload,
  validateSESPayload,
  validateEmailAddress,
  validateMessageIdFormat,
  validateAliasFormat,
  validateAttachment,
  validateContentType,
  validateTimestamp,
  validateWebhookSecret,
  safeParseJSON,
} from './validation';

// Provider implementations
export {
  CloudflareAdapter,
  SESAdapter,
  ProviderFactory,
  createCloudflareAdapter,
  createSESAdapter,
  defaultCloudflareAdapter,
  defaultSESAdapter,
  getCurrentProvider,
  checkProviderHealth,
  checkAllProvidersHealth,
} from './providers';

// Re-export for convenience
export * from './types';
export * from './utils';