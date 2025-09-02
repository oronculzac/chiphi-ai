import { z } from 'zod';
import {
  InboundEmailPayload,
  InboundEmailPayloadSchema,
  ProviderConfig,
  ProviderConfigSchema,
  CloudflarePayloadSchema,
  SESPayloadSchema,
  ProviderParsingError,
  ProviderConfigurationError,
} from './types';

/**
 * Validation utilities for email provider payloads
 */

/**
 * Validate inbound email payload against schema
 */
export function validateEmailPayload(
  payload: unknown,
  provider: string
): InboundEmailPayload {
  try {
    return InboundEmailPayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ProviderParsingError(provider, {
        error: 'Email payload validation failed',
        validationErrors: error.errors,
        payload: typeof payload === 'object' ? payload : { raw: payload },
      });
    }
    throw new ProviderParsingError(provider, {
      error: 'Unknown validation error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(
  config: unknown,
  providerName: string
): ProviderConfig {
  try {
    return ProviderConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ProviderConfigurationError(providerName, {
        error: 'Provider configuration validation failed',
        validationErrors: error.errors,
        config: typeof config === 'object' ? config : { raw: config },
      });
    }
    throw new ProviderConfigurationError(providerName, {
      error: 'Unknown configuration validation error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate Cloudflare-specific payload
 */
export function validateCloudflarePayload(
  payload: unknown
): z.infer<typeof CloudflarePayloadSchema> {
  try {
    return CloudflarePayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ProviderParsingError('cloudflare', {
        error: 'Cloudflare payload validation failed',
        validationErrors: error.errors,
        payload: typeof payload === 'object' ? payload : { raw: payload },
      });
    }
    throw new ProviderParsingError('cloudflare', {
      error: 'Unknown Cloudflare validation error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate SES-specific payload
 */
export function validateSESPayload(
  payload: unknown
): z.infer<typeof SESPayloadSchema> {
  try {
    return SESPayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ProviderParsingError('ses', {
        error: 'SES payload validation failed',
        validationErrors: error.errors,
        payload: typeof payload === 'object' ? payload : { raw: payload },
      });
    }
    throw new ProviderParsingError('ses', {
      error: 'Unknown SES validation error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate email address format
 */
export function validateEmailAddress(
  email: string,
  fieldName: string,
  provider: string
): string {
  const emailSchema = z.string().email();
  
  try {
    return emailSchema.parse(email);
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: `Invalid ${fieldName} email address`,
      email,
      field: fieldName,
    });
  }
}

/**
 * Validate message ID format
 */
export function validateMessageIdFormat(
  messageId: string,
  provider: string
): string {
  if (!messageId || typeof messageId !== 'string') {
    throw new ProviderParsingError(provider, {
      error: 'Message ID must be a non-empty string',
      messageId,
    });
  }

  if (messageId.length < 1 || messageId.length > 255) {
    throw new ProviderParsingError(provider, {
      error: 'Message ID length must be between 1 and 255 characters',
      messageId,
      length: messageId.length,
    });
  }

  // Allow alphanumeric, dots, underscores, hyphens, and @ symbols
  if (!/^[a-zA-Z0-9._@-]+$/.test(messageId)) {
    throw new ProviderParsingError(provider, {
      error: 'Message ID contains invalid characters',
      messageId,
      allowedPattern: 'a-zA-Z0-9._@-',
    });
  }

  return messageId;
}

/**
 * Validate alias format and extract organization slug
 */
export function validateAliasFormat(
  alias: string,
  provider: string
): { alias: string; orgSlug: string } {
  const aliasSchema = z.string().regex(
    /^u_[a-zA-Z0-9_-]+@inbox\.chiphi\.ai$/,
    'Invalid alias format'
  );

  try {
    const validAlias = aliasSchema.parse(alias);
    const match = validAlias.match(/^u_([a-zA-Z0-9_-]+)@inbox\.chiphi\.ai$/);
    
    if (!match) {
      throw new Error('Failed to extract organization slug');
    }

    return {
      alias: validAlias,
      orgSlug: match[1],
    };
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: 'Invalid alias format',
      alias,
      expectedFormat: 'u_<slug>@inbox.chiphi.ai',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate attachment data
 */
export function validateAttachment(
  attachment: any,
  index: number,
  provider: string
): {
  name: string;
  contentType: string;
  size: number;
  key?: string;
} {
  try {
    const attachmentSchema = z.object({
      name: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().min(0),
      key: z.string().optional(),
    });

    return attachmentSchema.parse(attachment);
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: `Invalid attachment at index ${index}`,
      attachment,
      index,
      details: error instanceof z.ZodError ? error.errors : 'Unknown error',
    });
  }
}

/**
 * Validate content type
 */
export function validateContentType(
  contentType: string,
  provider: string
): string {
  if (!contentType || typeof contentType !== 'string') {
    throw new ProviderParsingError(provider, {
      error: 'Content type must be a non-empty string',
      contentType,
    });
  }

  // Basic MIME type validation
  const mimeTypeRegex = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*$/;
  
  if (!mimeTypeRegex.test(contentType)) {
    throw new ProviderParsingError(provider, {
      error: 'Invalid MIME type format',
      contentType,
      expectedFormat: 'type/subtype',
    });
  }

  return contentType;
}

/**
 * Validate timestamp format
 */
export function validateTimestamp(
  timestamp: string | Date,
  provider: string
): Date {
  try {
    if (timestamp instanceof Date) {
      if (isNaN(timestamp.getTime())) {
        throw new Error('Invalid Date object');
      }
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date string');
      }
      return date;
    }

    throw new Error('Timestamp must be a Date object or valid date string');
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: 'Invalid timestamp format',
      timestamp,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate webhook secret format
 */
export function validateWebhookSecret(
  secret: string,
  provider: string
): string {
  if (!secret || typeof secret !== 'string') {
    throw new ProviderConfigurationError(provider, {
      error: 'Webhook secret must be a non-empty string',
      secret: secret ? '[REDACTED]' : secret,
    });
  }

  if (secret.length < 16) {
    throw new ProviderConfigurationError(provider, {
      error: 'Webhook secret must be at least 16 characters long',
      secretLength: secret.length,
    });
  }

  return secret;
}

/**
 * Safe payload parsing with error handling
 */
export function safeParseJSON(
  jsonString: string,
  provider: string
): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: 'Failed to parse JSON payload',
      details: error instanceof Error ? error.message : 'Unknown error',
      payloadLength: jsonString.length,
    });
  }
}