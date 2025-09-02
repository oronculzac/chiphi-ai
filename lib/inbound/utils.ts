import { 
  InboundEmailPayload, 
  EmailProcessingContext, 
  generateCorrelationId,
  extractOrgSlugFromAlias,
  normalizeEmailContent,
  sanitizeMetadata,
  ProviderError,
  ProviderParsingError
} from './types';

/**
 * Email payload normalization utilities
 */

/**
 * Create processing context from email payload
 */
export function createProcessingContext(
  payload: InboundEmailPayload,
  provider: string
): EmailProcessingContext {
  return {
    correlationId: generateCorrelationId(),
    provider,
    orgSlug: extractOrgSlugFromAlias(payload.alias),
    messageId: payload.messageId,
    receivedAt: payload.receivedAt || new Date(),
    processingStartedAt: new Date(),
    metadata: payload.metadata ? sanitizeMetadata(payload.metadata) : undefined,
  };
}

/**
 * Normalize attachment data from different provider formats
 */
export function normalizeAttachments(
  attachments: any[],
  provider: string
): InboundEmailPayload['attachments'] {
  if (!attachments || !Array.isArray(attachments)) {
    return undefined;
  }

  try {
    return attachments.map((attachment, index) => {
      // Handle different provider formats
      switch (provider) {
        case 'cloudflare':
          if (!attachment.filename && !attachment.name) {
            throw new Error(`Missing attachment name at index ${index}`);
          }
          return {
            name: attachment.filename || `attachment_${index}`,
            contentType: attachment.type || 'application/octet-stream',
            size: attachment.content ? Buffer.from(attachment.content, 'base64').length : 0,
            key: attachment.key,
          };
        
        case 'ses':
          if (!attachment.name && !attachment.filename) {
            throw new Error(`Missing attachment name at index ${index}`);
          }
          return {
            name: attachment.name || attachment.filename || `attachment_${index}`,
            contentType: attachment.contentType || attachment.type || 'application/octet-stream',
            size: attachment.size || 0,
            key: attachment.key,
          };
        
        default:
          // Generic normalization
          if (!attachment.name && !attachment.filename) {
            throw new Error(`Missing attachment name at index ${index}`);
          }
          return {
            name: attachment.name || attachment.filename || `attachment_${index}`,
            contentType: attachment.contentType || attachment.type || 'application/octet-stream',
            size: attachment.size || 0,
            key: attachment.key,
          };
      }
    });
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: 'Failed to normalize attachments',
      details: error instanceof Error ? error.message : 'Unknown error',
      attachmentCount: attachments.length,
    });
  }
}

/**
 * Extract email content from different provider formats
 */
export function extractEmailContent(
  payload: any,
  provider: string
): { text?: string; html?: string } {
  try {
    switch (provider) {
      case 'cloudflare':
        return extractCloudflareContent(payload);
      
      case 'ses':
        return extractSESContent(payload);
      
      default:
        // Generic extraction
        return {
          text: payload.text ? normalizeEmailContent(payload.text) : undefined,
          html: payload.html ? normalizeEmailContent(payload.html) : undefined,
        };
    }
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: 'Failed to extract email content',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extract content from Cloudflare email format
 */
function extractCloudflareContent(payload: any): { text?: string; html?: string } {
  const content = payload.content || [];
  let text: string | undefined;
  let html: string | undefined;

  for (const item of content) {
    if (item.type === 'text/plain') {
      text = normalizeEmailContent(item.value);
    } else if (item.type === 'text/html') {
      html = normalizeEmailContent(item.value);
    }
  }

  return { text, html };
}

/**
 * Extract content from SES email format
 */
function extractSESContent(payload: any): { text?: string; html?: string } {
  // SES provides content in the mail object within the SNS message
  const mail = typeof payload.Message === 'string' 
    ? JSON.parse(payload.Message) 
    : payload.Message;

  return {
    text: mail.content?.text ? normalizeEmailContent(mail.content.text) : undefined,
    html: mail.content?.html ? normalizeEmailContent(mail.content.html) : undefined,
  };
}

/**
 * Validate message ID format and uniqueness requirements
 */
export function validateMessageId(messageId: string, provider: string): void {
  if (!messageId || typeof messageId !== 'string') {
    throw new ProviderParsingError(provider, {
      error: 'Invalid message ID',
      messageId,
    });
  }

  if (messageId.length < 1 || messageId.length > 255) {
    throw new ProviderParsingError(provider, {
      error: 'Message ID length out of bounds',
      messageId,
      length: messageId.length,
    });
  }

  // Check for potentially problematic characters
  if (!/^[a-zA-Z0-9._@-]+$/.test(messageId)) {
    throw new ProviderParsingError(provider, {
      error: 'Message ID contains invalid characters',
      messageId,
    });
  }
}

/**
 * Extract sender and recipient information from provider payload
 */
export function extractEmailAddresses(
  payload: any,
  provider: string
): { from: string; to: string } {
  try {
    switch (provider) {
      case 'cloudflare':
        return extractCloudflareAddresses(payload);
      
      case 'ses':
        return extractSESAddresses(payload);
      
      default:
        return {
          from: payload.from || '',
          to: payload.to || '',
        };
    }
  } catch (error) {
    throw new ProviderParsingError(provider, {
      error: 'Failed to extract email addresses',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extract addresses from Cloudflare email format
 */
function extractCloudflareAddresses(payload: any): { from: string; to: string } {
  const from = payload.from?.email || '';
  const to = payload.personalizations?.[0]?.to?.[0]?.email || '';

  if (!from || !to) {
    throw new Error('Missing required email addresses in Cloudflare payload');
  }

  return { from, to };
}

/**
 * Extract addresses from SES email format
 */
function extractSESAddresses(payload: any): { from: string; to: string } {
  const mail = typeof payload.Message === 'string' 
    ? JSON.parse(payload.Message) 
    : payload.Message;

  const from = mail.mail?.source || mail.mail?.commonHeaders?.from?.[0] || '';
  const to = mail.mail?.destination?.[0] || mail.mail?.commonHeaders?.to?.[0] || '';

  if (!from || !to) {
    throw new Error('Missing required email addresses in SES payload');
  }

  return { from, to };
}

/**
 * Calculate processing metrics for monitoring
 */
export function calculateProcessingMetrics(context: EmailProcessingContext): {
  processingTimeMs: number;
  queueTimeMs?: number;
} {
  const now = new Date();
  const processingTimeMs = now.getTime() - context.processingStartedAt.getTime();
  const queueTimeMs = context.processingStartedAt.getTime() - context.receivedAt.getTime();

  return {
    processingTimeMs,
    queueTimeMs: queueTimeMs > 0 ? queueTimeMs : undefined,
  };
}

/**
 * Create error context for logging
 */
export function createErrorContext(
  error: Error,
  context: EmailProcessingContext,
  additionalData?: Record<string, any>
): Record<string, any> {
  return {
    correlationId: context.correlationId,
    provider: context.provider,
    orgSlug: context.orgSlug,
    messageId: context.messageId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    processingMetrics: calculateProcessingMetrics(context),
    ...additionalData,
  };
}

/**
 * Validate email alias and extract organization information
 */
export function validateAndParseAlias(alias: string): {
  orgSlug: string;
  isValid: boolean;
  domain: string;
} {
  const aliasRegex = /^u_([a-zA-Z0-9_-]+)@(inbox\.chiphi\.ai)$/;
  const match = alias.match(aliasRegex);

  if (!match) {
    return {
      orgSlug: '',
      isValid: false,
      domain: '',
    };
  }

  return {
    orgSlug: match[1],
    isValid: true,
    domain: match[2],
  };
}

/**
 * Sanitize email content for security
 */
export function sanitizeEmailContent(content: string): string {
  if (!content) return '';

  return content
    // Remove potential script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove potential style tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove potential link tags
    .replace(/<link\b[^>]*>/gi, '')
    // Remove potential meta tags
    .replace(/<meta\b[^>]*>/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (except images)
    .replace(/data:(?!image\/)/gi, 'data-removed:')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize email alias to standard format
 * Ensures consistent alias format for processing
 */
export function normalizeAlias(alias: string): string {
  if (!alias) return '';
  
  // Convert to lowercase and trim
  const normalized = alias.toLowerCase().trim();
  
  // Validate format
  if (!normalized.match(/^u_[a-zA-Z0-9_-]+@inbox\.chiphi\.ai$/)) {
    throw new Error(`Invalid alias format: ${alias}`);
  }
  
  return normalized;
}

/**
 * Verify idempotency by checking if message has already been processed
 * Prevents duplicate processing of the same email
 */
export async function verifyIdempotency(
  messageId: string,
  orgId: string,
  supabase: any
): Promise<{ isDuplicate: boolean; existingEmailId?: string }> {
  try {
    // Check if email with this message ID already exists for this org
    const { data: existingEmail, error } = await supabase
      .from('emails')
      .select('id, message_id')
      .eq('message_id', messageId)
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Database error during idempotency check: ${error.message}`);
    }

    if (existingEmail) {
      return {
        isDuplicate: true,
        existingEmailId: existingEmail.id,
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    // Log error but don't fail the request - assume not duplicate to avoid blocking
    console.error('Idempotency check failed:', error);
    return { isDuplicate: false };
  }
}

/**
 * Enqueue email processing job
 * Creates a unified processing pipeline for all providers
 */
export async function enqueueProcessJob(
  payload: InboundEmailPayload,
  orgId: string,
  correlationId: string
): Promise<{ emailId: string; queued: boolean }> {
  try {
    // Store the email in the database first
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase = createServiceClient();
    
    // Create email record
    const emailData = {
      org_id: orgId,
      message_id: payload.messageId,
      from_email: payload.from,
      to_email: payload.to,
      subject: payload.subject || null,
      raw_content: payload.rawRef || JSON.stringify(payload),
      parsed_content: {
        messageId: payload.messageId,
        from: payload.from,
        to: payload.to,
        subject: payload.subject || '',
        text: payload.text || '',
        html: payload.html || '',
        attachments: payload.attachments || [],
        headers: {},
      },
      processed_at: null,
    };

    const { data: emailRecord, error: insertError } = await supabase
      .from('emails')
      .insert(emailData as any)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to store email: ${insertError.message}`);
    }

    const emailId = (emailRecord as any).id;

    // Log email storage
    const { loggingService } = await import('@/lib/services/logging-service');
    await loggingService.logProcessingStep({
      orgId,
      emailId,
      step: 'email_stored_via_provider',
      status: 'completed',
      details: {
        messageId: payload.messageId,
        provider: 'provider_abstraction',
        correlationId,
      },
      correlationId,
    });

    // Trigger asynchronous processing
    setImmediate(async () => {
      try {
        const { enhancedEmailProcessor } = await import('@/lib/services/enhanced-email-processor');
        const emailContent = payload.text || payload.html || '';
        await enhancedEmailProcessor.processEmailToTransaction(
          emailId,
          orgId,
          emailContent,
          undefined, // No user ID available from webhook
          {
            messageId: payload.messageId,
            provider: 'provider_abstraction',
            correlationId,
          }
        );
      } catch (processingError) {
        console.error('Asynchronous email processing failed:', processingError);
        
        // Log processing failure
        await loggingService.logProcessingStep({
          orgId,
          emailId,
          step: 'async_processing_failed',
          status: 'failed',
          details: {
            error: processingError instanceof Error ? processingError.message : 'Unknown error',
            correlationId,
          },
          errorMessage: processingError instanceof Error ? processingError.message : 'Unknown error',
          correlationId,
        });
      }
    });

    return {
      emailId,
      queued: true,
    };
  } catch (error) {
    console.error('Failed to enqueue processing job:', error);
    throw error;
  }
}