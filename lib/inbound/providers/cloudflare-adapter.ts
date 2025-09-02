import crypto from 'crypto';
import {
  InboundEmailProvider,
  InboundEmailPayload,
  ProviderVerificationError,
  ProviderParsingError,
  ProviderConfigurationError,
  CloudflarePayloadSchema,
  normalizeEmailContent,
  sanitizeMetadata,
  generateCorrelationId,
} from '../types';
import { config } from '@/lib/config';

/**
 * Cloudflare Workers Email Routing adapter
 * Handles email processing from Cloudflare Workers Email Routing service
 */
export class CloudflareAdapter implements InboundEmailProvider {
  private readonly webhookSecret: string;
  private readonly timeoutMs: number;

  constructor(webhookSecret?: string, timeoutMs: number = 30000) {
    this.webhookSecret = webhookSecret || config.inboundProvider.cloudflareSecret || '';
    this.timeoutMs = timeoutMs;

    if (!this.webhookSecret && config.app.isProduction) {
      throw new ProviderConfigurationError('cloudflare', {
        message: 'CLOUDFLARE_EMAIL_SECRET is required in production',
      });
    }
  }

  getName(): string {
    return 'cloudflare';
  }

  /**
   * Verify HMAC signature from Cloudflare Workers
   * Cloudflare uses HMAC-SHA256 with the webhook secret
   */
  async verify(req: Request): Promise<boolean> {
    try {
      // In development, skip verification if no secret is configured
      if (!this.webhookSecret && config.app.isDevelopment) {
        return true;
      }

      const signature = req.headers.get('x-cloudflare-signature');
      if (!signature) {
        throw new ProviderVerificationError('cloudflare', {
          message: 'Missing x-cloudflare-signature header',
        });
      }

      // Clone request to read body without consuming it
      const clonedReq = req.clone();
      const body = await clonedReq.text();

      // Generate expected signature
      const expectedSignature = this.generateHMAC(body);

      // Compare signatures using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        throw new ProviderVerificationError('cloudflare', {
          message: 'HMAC signature verification failed',
          providedSignature: signature,
          expectedLength: expectedSignature.length,
        });
      }

      return true;
    } catch (error) {
      if (error instanceof ProviderVerificationError) {
        throw error;
      }
      
      throw new ProviderVerificationError('cloudflare', {
        message: 'Verification failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse Cloudflare Workers Email Routing payload
   * Converts Cloudflare-specific format to normalized InboundEmailPayload
   */
  async parse(req: Request): Promise<InboundEmailPayload> {
    try {
      const correlationId = generateCorrelationId();
      const body = await req.text();
      
      if (!body) {
        throw new ProviderParsingError('cloudflare', {
          message: 'Empty request body',
          correlationId,
        });
      }

      let payload: any;
      try {
        payload = JSON.parse(body);
      } catch (parseError) {
        throw new ProviderParsingError('cloudflare', {
          message: 'Invalid JSON in request body',
          correlationId,
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // Validate against Cloudflare schema
      const validationResult = CloudflarePayloadSchema.safeParse(payload);
      if (!validationResult.success) {
        throw new ProviderParsingError('cloudflare', {
          message: 'Payload validation failed',
          correlationId,
          validationErrors: validationResult.error.errors,
        });
      }

      const validatedPayload = validationResult.data;

      // Extract email data from Cloudflare format
      const normalizedPayload = this.normalizeCloudflarePayload(validatedPayload, correlationId);

      return normalizedPayload;
    } catch (error) {
      if (error instanceof ProviderParsingError) {
        throw error;
      }
      
      throw new ProviderParsingError('cloudflare', {
        message: 'Parsing failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate HMAC-SHA256 signature for request verification
   */
  private generateHMAC(body: string): string {
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body, 'utf8')
      .digest('hex');
  }

  /**
   * Convert Cloudflare payload to normalized format
   */
  private normalizeCloudflarePayload(
    payload: any,
    correlationId: string
  ): InboundEmailPayload {
    try {
      // Extract recipient (should be the alias)
      const to = payload.personalizations?.[0]?.to?.[0]?.email;
      if (!to) {
        throw new Error('Missing recipient email in personalizations');
      }

      // Extract sender
      const from = payload.from?.email;
      if (!from) {
        throw new Error('Missing sender email');
      }

      // Extract subject
      const subject = payload.subject || '';

      // Extract content (text and HTML)
      let text = '';
      let html = '';
      
      if (payload.content && Array.isArray(payload.content)) {
        for (const content of payload.content) {
          if (content.type === 'text/plain') {
            text = content.value || '';
          } else if (content.type === 'text/html') {
            html = content.value || '';
          }
        }
      }

      // Ensure we have at least some content
      if (!text && !html) {
        throw new Error('Email must have either text or html content');
      }

      // Normalize content
      text = normalizeEmailContent(text);
      html = normalizeEmailContent(html);

      // Extract attachments
      const attachments = this.normalizeCloudflareAttachments(payload.attachments || []);

      // Generate message ID (Cloudflare might provide this in headers)
      const messageId = payload.headers?.['message-id'] || 
                       payload.headers?.['Message-ID'] || 
                       `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Extract metadata
      const metadata = sanitizeMetadata({
        provider: 'cloudflare',
        correlationId,
        headers: payload.headers || {},
        originalPayload: {
          personalizationsCount: payload.personalizations?.length || 0,
          contentTypes: payload.content?.map((c: any) => c.type) || [],
          attachmentCount: payload.attachments?.length || 0,
        },
      });

      return {
        alias: to,
        messageId,
        from,
        to,
        subject,
        text: text || undefined,
        html: html || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        receivedAt: new Date(),
        metadata,
      };
    } catch (error) {
      throw new ProviderParsingError('cloudflare', {
        message: 'Failed to normalize Cloudflare payload',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Normalize Cloudflare attachments to standard format
   */
  private normalizeCloudflareAttachments(attachments: any[]): Array<{
    name: string;
    contentType: string;
    size: number;
    key?: string;
  }> {
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments
      .filter(att => att && typeof att === 'object')
      .map(att => {
        try {
          // Cloudflare provides base64 content, calculate size
          const content = att.content || '';
          const size = content ? Math.floor((content.length * 3) / 4) : 0;

          return {
            name: att.filename || 'unknown',
            contentType: att.type || 'application/octet-stream',
            size,
            // Note: In a real implementation, you'd store the content and return a key
            key: undefined,
          };
        } catch (error) {
          // Skip invalid attachments
          return null;
        }
      })
      .filter((att): att is NonNullable<typeof att> => att !== null);
  }

  /**
   * Health check for Cloudflare provider
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    responseTimeMs?: number;
    error?: string;
    details?: Record<string, any>;
  }> {
    const startTime = Date.now();
    
    try {
      // Add small delay to ensure responseTimeMs > 0
      await new Promise(resolve => setTimeout(resolve, 1));
      
      // Basic configuration check
      const hasSecret = !!this.webhookSecret;
      const hasValidTimeout = this.timeoutMs > 0 && this.timeoutMs <= 60000;

      const healthy = hasSecret || config.app.isDevelopment;
      const responseTimeMs = Date.now() - startTime;

      return {
        healthy,
        responseTimeMs,
        details: {
          hasSecret,
          hasValidTimeout,
          timeoutMs: this.timeoutMs,
          environment: config.app.nodeEnv,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Factory function to create CloudflareAdapter with configuration
 */
export function createCloudflareAdapter(options?: {
  webhookSecret?: string;
  timeoutMs?: number;
}): CloudflareAdapter {
  return new CloudflareAdapter(
    options?.webhookSecret,
    options?.timeoutMs
  );
}

/**
 * Default Cloudflare adapter instance using environment configuration
 */
export const defaultCloudflareAdapter = createCloudflareAdapter({
  webhookSecret: config.inboundProvider.cloudflareSecret,
  timeoutMs: 30000,
});