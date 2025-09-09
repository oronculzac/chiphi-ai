import { z } from 'zod';

/**
 * Normalized email payload structure used internally
 * All providers must convert their specific formats to this structure
 */
export interface InboundEmailPayload {
  /** Email alias in format u_<slug>@inbox.chiphi.ai */
  alias: string;
  /** Unique message identifier from the provider */
  messageId: string;
  /** Sender email address */
  from: string;
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject?: string;
  /** Plain text content */
  text?: string;
  /** HTML content */
  html?: string;
  /** Email attachments */
  attachments?: Array<{
    name: string;
    contentType: string;
    size: number;
    /** Storage key when raw MIME is saved */
    key?: string;
  }>;
  /** Storage key for raw MIME content */
  rawRef?: string;
  /** Timestamp when email was received */
  receivedAt?: Date;
  /** Provider-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Provider interface that all email providers must implement
 */
export interface InboundEmailProvider {
  /**
   * Verify the authenticity of the incoming request
   * Should validate HMAC signatures or other provider-specific authentication
   */
  verify(req: Request): Promise<boolean>;
  
  /**
   * Parse the provider-specific payload into normalized format
   * Should handle provider-specific formats and convert to InboundEmailPayload
   */
  parse(req: Request): Promise<InboundEmailPayload>;
  
  /**
   * Get provider name for logging and identification
   */
  getName(): string;
}

/**
 * Configuration interface for email providers
 */
export interface ProviderConfig {
  /** Provider name (e.g., 'cloudflare', 'ses') */
  name: string;
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Provider-specific configuration */
  config: Record<string, any>;
  /** Optional webhook secret for HMAC verification */
  webhookSecret?: string;
  /** Optional timeout for provider operations */
  timeoutMs?: number;
}

/**
 * Provider-specific error types
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderVerificationError extends ProviderError {
  constructor(provider: string, details?: Record<string, any>) {
    super('Provider verification failed', provider, 'VERIFICATION_FAILED', details);
    this.name = 'ProviderVerificationError';
  }
}

export class ProviderParsingError extends ProviderError {
  constructor(provider: string, details?: Record<string, any>) {
    super('Provider payload parsing failed', provider, 'PARSING_FAILED', details);
    this.name = 'ProviderParsingError';
  }
}

export class ProviderConfigurationError extends ProviderError {
  constructor(provider: string, details?: Record<string, any>) {
    const message = details?.message || 'Provider configuration invalid';
    super(message, provider, 'CONFIGURATION_ERROR', details);
    this.name = 'ProviderConfigurationError';
  }
}

/**
 * Zod validation schemas for provider payloads
 */

// Email attachment schema
const AttachmentSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().min(0),
  key: z.string().optional(),
});

// Main email payload schema
export const InboundEmailPayloadSchema = z.object({
  alias: z.string().regex(/^u_[a-zA-Z0-9_-]+@inbox\.chiphi\.ai$/, 'Invalid alias format'),
  messageId: z.string().min(1),
  from: z.string().email('Invalid sender email'),
  to: z.string().email('Invalid recipient email'),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  rawRef: z.string().optional(),
  receivedAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => data.text || data.html,
  {
    message: 'Email must have either text or html content',
    path: ['text', 'html'],
  }
);

// Provider configuration schema
export const ProviderConfigSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.any()),
  webhookSecret: z.string().optional(),
  timeoutMs: z.number().min(1000).max(60000).optional(),
});

// Cloudflare-specific payload schema
export const CloudflarePayloadSchema = z.object({
  personalizations: z.array(z.object({
    to: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
    })),
  })),
  from: z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }),
  subject: z.string().optional(),
  content: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).optional(),
  headers: z.record(z.string()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    type: z.string(),
    content: z.string(),
    disposition: z.string().optional(),
  })).optional(),
});

// SES SNS notification schema
export const SESPayloadSchema = z.object({
  Type: z.literal('Notification'),
  MessageId: z.string(),
  TopicArn: z.string(),
  Subject: z.string().optional(),
  Message: z.string(),
  Timestamp: z.string(),
  SignatureVersion: z.string(),
  Signature: z.string(),
  SigningCertURL: z.string(),
  UnsubscribeURL: z.string().optional(),
});

// SES mail object schema (inside SNS message)
export const SESMailSchema = z.object({
  timestamp: z.string(),
  messageId: z.string(),
  source: z.string(),
  sourceArn: z.string().optional(),
  sourceIp: z.string().optional(),
  callerIdentity: z.string().optional(),
  sendingAccountId: z.string().optional(),
  destination: z.array(z.string()),
  headersTruncated: z.boolean().optional(),
  headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  commonHeaders: z.object({
    from: z.array(z.string()).optional(),
    to: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    sender: z.array(z.string()).optional(),
    'reply-to': z.array(z.string()).optional(),
    returnPath: z.string().optional(),
    messageId: z.string().optional(),
    date: z.string().optional(),
    subject: z.string().optional(),
  }).optional(),
});

// Lambda-processed SES payload schema (compact JSON format)
export const SESLambdaPayloadSchema = z.object({
  alias: z.string(),
  messageId: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  rawRef: z.string().optional(),
  receivedAt: z.string().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    contentType: z.string(),
    size: z.number(),
    key: z.string().optional(),
  })).optional(),
});

/**
 * Utility functions for payload normalization
 */

/**
 * Extract organization slug from email alias
 * @param alias Email alias in format u_<slug>@inbox.chiphi.ai
 * @returns Organization slug
 */
export function extractOrgSlugFromAlias(alias: string): string {
  const match = alias.match(/^u_([a-zA-Z0-9_-]+)@inbox\.chiphi\.ai$/);
  if (!match) {
    throw new Error(`Invalid alias format: ${alias}`);
  }
  return match[1];
}

/**
 * Validate email alias format
 * @param alias Email alias to validate
 * @returns True if valid, false otherwise
 */
export function isValidAlias(alias: string): boolean {
  return /^u_[a-zA-Z0-9_-]+@inbox\.chiphi\.ai$/.test(alias);
}

/**
 * Normalize email content by removing common email artifacts
 * @param content Raw email content
 * @returns Cleaned content
 */
export function normalizeEmailContent(content: string): string {
  if (!content) return '';
  
  return content
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove email headers and signatures
    .replace(/^(From|To|Subject|Date|Cc|Bcc):.*$/gm, '')
    // Remove common email footers
    .replace(/--\s*$/gm, '')
    // Remove forwarding headers
    .replace(/^>.*$/gm, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize provider metadata to remove sensitive information
 * @param metadata Raw metadata object
 * @returns Sanitized metadata
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized = { ...metadata };
  
  // Remove sensitive keys
  const sensitiveKeys = [
    'authorization',
    'x-api-key',
    'x-auth-token',
    'cookie',
    'set-cookie',
    'x-forwarded-for',
    'x-real-ip',
  ];
  
  sensitiveKeys.forEach(key => {
    delete sanitized[key];
    delete sanitized[key.toLowerCase()];
    delete sanitized[key.toUpperCase()];
  });
  
  return sanitized;
}

/**
 * Generate a correlation ID for request tracking
 * @returns Unique correlation ID
 */
export function generateCorrelationId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type guards for provider payloads
 */

export function isCloudflarePayload(payload: any): payload is z.infer<typeof CloudflarePayloadSchema> {
  return CloudflarePayloadSchema.safeParse(payload).success;
}

export function isSESPayload(payload: any): payload is z.infer<typeof SESPayloadSchema> {
  return SESPayloadSchema.safeParse(payload).success;
}

/**
 * Provider registry type for managing multiple providers
 */
export interface ProviderRegistry {
  register(name: string, provider: InboundEmailProvider): void;
  get(name: string): InboundEmailProvider | undefined;
  list(): string[];
  isRegistered(name: string): boolean;
}

/**
 * Email processing context for tracking requests
 */
export interface EmailProcessingContext {
  correlationId: string;
  provider: string;
  orgSlug: string;
  messageId: string;
  receivedAt: Date;
  processingStartedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Provider health check interface
 */
export interface ProviderHealthCheck {
  provider: string;
  healthy: boolean;
  lastChecked: Date;
  responseTimeMs?: number;
  error?: string;
  details?: Record<string, any>;
}