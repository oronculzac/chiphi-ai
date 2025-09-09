import crypto from 'crypto';
import https from 'https';
import {
  InboundEmailProvider,
  InboundEmailPayload,
  ProviderVerificationError,
  ProviderParsingError,
  ProviderConfigurationError,
  SESPayloadSchema,
  SESMailSchema,
  SESLambdaPayloadSchema,
  normalizeEmailContent,
  sanitizeMetadata,
  generateCorrelationId,
} from '../types';
import { config } from '@/lib/config';

/**
 * Amazon SES (Simple Email Service) adapter
 * Handles email processing from Amazon SES via SNS notifications and Lambda-processed payloads
 */
export class SESAdapter implements InboundEmailProvider {
  private readonly webhookSecret: string;
  private readonly sharedSecret: string;
  private readonly timeoutMs: number;
  private readonly verifySignature: boolean;

  constructor(
    webhookSecret?: string, 
    timeoutMs: number = 30000,
    verifySignature: boolean = true,
    sharedSecret?: string
  ) {
    this.webhookSecret = webhookSecret || config.inboundProvider.sesSecret || '';
    this.sharedSecret = sharedSecret || config.inboundProvider.sharedSecret || '';
    this.timeoutMs = timeoutMs;
    this.verifySignature = verifySignature;

    // Skip validation during build time
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                       process.env.NODE_ENV === undefined;

    if (!isBuildTime && config.app.isProduction && this.verifySignature) {
      if (!this.webhookSecret && !this.sharedSecret) {
        throw new ProviderConfigurationError('ses', {
          message: 'Either SES_WEBHOOK_SECRET or SHARED_SECRET is required in production when signature verification is enabled',
        });
      }
    }
  }

  getName(): string {
    return 'ses';
  }

  /**
   * Verify request authenticity using dual-path verification
   * - For /api/inbound/lambda: verify shared secret header
   * - For direct webhooks: verify SNS signature
   */
  async verify(req: Request): Promise<boolean> {
    try {
      // In development, skip verification if disabled
      if (!this.verifySignature && config.app.isDevelopment) {
        return true;
      }

      const url = new URL(req.url);
      const isLambdaPath = url.pathname.includes('/lambda');

      if (isLambdaPath) {
        // Lambda endpoint: verify shared secret
        return await this.verifySharedSecret(req);
      } else {
        // Direct webhook: verify SNS signature
        return await this.verifySNSSignature(req);
      }
    } catch (error) {
      if (error instanceof ProviderVerificationError) {
        throw error;
      }
      
      throw new ProviderVerificationError('ses', {
        message: 'Verification failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Verify shared secret for Lambda endpoint
   */
  private async verifySharedSecret(req: Request): Promise<boolean> {
    try {
      // In development, skip verification if no secret
      if (!this.sharedSecret && config.app.isDevelopment) {
        return true;
      }

      if (!this.sharedSecret) {
        throw new ProviderVerificationError('ses', {
          message: 'Shared secret not configured for Lambda endpoint verification',
        });
      }

      const providedSecret = req.headers.get('x-shared-secret');
      if (!providedSecret) {
        throw new ProviderVerificationError('ses', {
          message: 'Missing x-shared-secret header for Lambda endpoint',
        });
      }

      // Use constant-time comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(this.sharedSecret, 'utf8');
      const providedBuffer = Buffer.from(providedSecret, 'utf8');

      if (expectedBuffer.length !== providedBuffer.length) {
        throw new ProviderVerificationError('ses', {
          message: 'Shared secret verification failed',
        });
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
      if (!isValid) {
        throw new ProviderVerificationError('ses', {
          message: 'Shared secret verification failed',
        });
      }

      return true;
    } catch (error) {
      if (error instanceof ProviderVerificationError) {
        throw error;
      }
      
      throw new ProviderVerificationError('ses', {
        message: 'Shared secret verification failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Verify SNS signature for direct webhook
   */
  private async verifySNSSignature(req: Request): Promise<boolean> {
    try {
      // In development, skip verification if no secret
      if (!this.webhookSecret && config.app.isDevelopment) {
        return true;
      }

      if (!this.webhookSecret) {
        throw new ProviderVerificationError('ses', {
          message: 'Webhook secret not configured for SNS signature verification',
        });
      }

      // Clone request to read body without consuming it
      const clonedReq = req.clone();
      const body = await clonedReq.text();

      let snsMessage: any;
      try {
        snsMessage = JSON.parse(body);
      } catch (parseError) {
        throw new ProviderVerificationError('ses', {
          message: 'Invalid JSON in SNS message',
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // Validate SNS message structure
      const validationResult = SESPayloadSchema.safeParse(snsMessage);
      if (!validationResult.success) {
        throw new ProviderVerificationError('ses', {
          message: 'Invalid SNS message structure',
          validationErrors: validationResult.error.errors,
        });
      }

      // Verify SNS signature
      const isValid = await this.verifySNSSignatureInternal(snsMessage);
      if (!isValid) {
        throw new ProviderVerificationError('ses', {
          message: 'SNS signature verification failed',
          messageId: snsMessage.MessageId,
          topicArn: snsMessage.TopicArn,
        });
      }

      return true;
    } catch (error) {
      if (error instanceof ProviderVerificationError) {
        throw error;
      }
      
      throw new ProviderVerificationError('ses', {
        message: 'SNS signature verification failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse request payload using dual-path parsing
   * - For /api/inbound/lambda: parse compact JSON format from Lambda
   * - For direct webhooks: parse SNS notification format
   */
  async parse(req: Request): Promise<InboundEmailPayload> {
    try {
      const correlationId = generateCorrelationId();
      const url = new URL(req.url);
      const isLambdaPath = url.pathname.includes('/lambda');

      if (isLambdaPath) {
        // Lambda endpoint: parse compact JSON payload
        return await this.parseLambdaPayload(req, correlationId);
      } else {
        // Direct webhook: parse SNS payload
        return await this.parseSNSPayload(req, correlationId);
      }
    } catch (error) {
      if (error instanceof ProviderParsingError) {
        throw error;
      }
      
      throw new ProviderParsingError('ses', {
        message: 'Parsing failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse Lambda-processed compact JSON payload
   */
  private async parseLambdaPayload(req: Request, correlationId: string): Promise<InboundEmailPayload> {
    try {
      const body = await req.text();
      
      if (!body) {
        throw new ProviderParsingError('ses', {
          message: 'Empty request body',
          correlationId,
        });
      }

      let lambdaPayload: any;
      try {
        lambdaPayload = JSON.parse(body);
      } catch (parseError) {
        throw new ProviderParsingError('ses', {
          message: 'Invalid JSON in Lambda payload',
          correlationId,
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // Validate Lambda payload structure
      const validation = SESLambdaPayloadSchema.safeParse(lambdaPayload);
      if (!validation.success) {
        throw new ProviderParsingError('ses', {
          message: 'Lambda payload validation failed',
          correlationId,
          validationErrors: validation.error.errors,
        });
      }

      // Convert to normalized format
      return await this.normalizeLambdaPayload(lambdaPayload, correlationId);
    } catch (error) {
      if (error instanceof ProviderParsingError) {
        throw error;
      }
      
      throw new ProviderParsingError('ses', {
        message: 'Lambda payload parsing failed with unexpected error',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse SNS notification payload (legacy direct webhook)
   */
  private async parseSNSPayload(req: Request, correlationId: string): Promise<InboundEmailPayload> {
    try {
      const body = await req.text();
      
      if (!body) {
        throw new ProviderParsingError('ses', {
          message: 'Empty request body',
          correlationId,
        });
      }

      let snsMessage: any;
      try {
        snsMessage = JSON.parse(body);
      } catch (parseError) {
        throw new ProviderParsingError('ses', {
          message: 'Invalid JSON in SNS message',
          correlationId,
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // Validate SNS message structure
      const snsValidation = SESPayloadSchema.safeParse(snsMessage);
      if (!snsValidation.success) {
        throw new ProviderParsingError('ses', {
          message: 'SNS message validation failed',
          correlationId,
          validationErrors: snsValidation.error.errors,
        });
      }

      // Parse the inner SES message
      let sesMessage: any;
      try {
        sesMessage = JSON.parse(snsMessage.Message);
      } catch (parseError) {
        throw new ProviderParsingError('ses', {
          message: 'Invalid JSON in SES message content',
          correlationId,
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // Extract mail object from SES message
      const mailObject = sesMessage.mail;
      if (!mailObject) {
        throw new ProviderParsingError('ses', {
          message: 'Missing mail object in SES message',
          correlationId,
        });
      }

      // Validate mail object structure
      const mailValidation = SESMailSchema.safeParse(mailObject);
      if (!mailValidation.success) {
        throw new ProviderParsingError('ses', {
          message: 'SES mail object validation failed',
          correlationId,
          validationErrors: mailValidation.error.errors,
        });
      }

      // Convert to normalized format
      const normalizedPayload = await this.normalizeSESPayload(
        snsMessage,
        sesMessage,
        mailObject,
        correlationId
      );

      return normalizedPayload;
    } catch (error) {
      if (error instanceof ProviderParsingError) {
        throw error;
      }
      
      throw new ProviderParsingError('ses', {
        message: 'SNS payload parsing failed with unexpected error',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Verify SNS signature using AWS algorithm
   */
  private async verifySNSSignatureInternal(snsMessage: any): Promise<boolean> {
    try {
      const {
        Message,
        MessageId,
        Subject,
        Timestamp,
        TopicArn,
        Type,
        Signature,
        SigningCertURL,
        SignatureVersion,
      } = snsMessage;

      // Validate signature version
      if (SignatureVersion !== '1') {
        throw new Error(`Unsupported signature version: ${SignatureVersion}`);
      }

      // Build string to sign based on SNS specification
      const stringToSign = this.buildSNSStringToSign({
        Message,
        MessageId,
        Subject,
        Timestamp,
        TopicArn,
        Type,
      });

      // Download and verify certificate (in production, you'd cache this)
      const certificate = await this.downloadSNSCertificate(SigningCertURL);
      
      // Verify signature
      const verifier = crypto.createVerify('RSA-SHA1');
      verifier.update(stringToSign, 'utf8');
      
      return verifier.verify(certificate, Signature, 'base64');
    } catch (error) {
      throw new ProviderVerificationError('ses', {
        message: 'SNS signature verification failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Build string to sign for SNS signature verification
   */
  private buildSNSStringToSign(params: {
    Message: string;
    MessageId: string;
    Subject?: string;
    Timestamp: string;
    TopicArn: string;
    Type: string;
  }): string {
    const { Message, MessageId, Subject, Timestamp, TopicArn, Type } = params;
    
    let stringToSign = `Message\n${Message}\n`;
    stringToSign += `MessageId\n${MessageId}\n`;
    
    if (Subject) {
      stringToSign += `Subject\n${Subject}\n`;
    }
    
    stringToSign += `Timestamp\n${Timestamp}\n`;
    stringToSign += `TopicArn\n${TopicArn}\n`;
    stringToSign += `Type\n${Type}\n`;
    
    return stringToSign;
  }

  /**
   * Download SNS signing certificate
   */
  private async downloadSNSCertificate(certURL: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Validate certificate URL is from AWS
      if (!certURL.startsWith('https://sns.') || !certURL.includes('.amazonaws.com/')) {
        reject(new Error('Invalid certificate URL'));
        return;
      }

      https.get(certURL, { timeout: this.timeoutMs }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`Failed to download certificate: ${res.statusCode}`));
          }
        });
        
        res.on('error', (error) => {
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Convert Lambda-processed payload to normalized format
   */
  private async normalizeLambdaPayload(
    lambdaPayload: any,
    correlationId: string
  ): Promise<InboundEmailPayload> {
    try {
      // Lambda payload is already in a normalized format, just need to convert types
      const receivedAt = lambdaPayload.receivedAt ? new Date(lambdaPayload.receivedAt) : new Date();

      // Extract metadata
      const metadata = sanitizeMetadata({
        provider: 'ses',
        correlationId,
        source: 'lambda',
        rawRef: lambdaPayload.rawRef,
        originalPayload: {
          hasText: !!lambdaPayload.text,
          hasHtml: !!lambdaPayload.html,
          attachmentCount: lambdaPayload.attachments?.length || 0,
        },
      });

      return {
        alias: lambdaPayload.alias,
        messageId: lambdaPayload.messageId,
        from: lambdaPayload.from,
        to: lambdaPayload.to,
        subject: lambdaPayload.subject || undefined,
        text: lambdaPayload.text ? normalizeEmailContent(lambdaPayload.text) : undefined,
        html: lambdaPayload.html ? normalizeEmailContent(lambdaPayload.html) : undefined,
        attachments: lambdaPayload.attachments || undefined,
        rawRef: lambdaPayload.rawRef || undefined,
        receivedAt,
        metadata,
      };
    } catch (error) {
      throw new ProviderParsingError('ses', {
        message: 'Failed to normalize Lambda payload',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Convert SES payload to normalized format
   */
  private async normalizeSESPayload(
    snsMessage: any,
    sesMessage: any,
    mailObject: any,
    correlationId: string
  ): Promise<InboundEmailPayload> {
    try {
      // Extract recipient (first destination)
      const to = mailObject.destination?.[0];
      if (!to) {
        throw new Error('Missing destination email in mail object');
      }

      // Extract sender
      const from = mailObject.source;
      if (!from) {
        throw new Error('Missing source email in mail object');
      }

      // Extract subject from common headers
      const subject = mailObject.commonHeaders?.subject || '';

      // Extract message ID
      const messageId = mailObject.messageId || snsMessage.MessageId;

      // Parse timestamp
      const receivedAt = new Date(mailObject.timestamp);

      // For SES, we typically need to fetch the actual email content from S3
      // This is a simplified version - in production you'd fetch from S3
      const text = this.extractTextFromSESContent(sesMessage);
      const html = this.extractHTMLFromSESContent(sesMessage);

      // Extract attachments (if any)
      const attachments = this.normalizeSESAttachments(sesMessage.content?.attachments || []);

      // Extract metadata
      const metadata = sanitizeMetadata({
        provider: 'ses',
        correlationId,
        snsMessageId: snsMessage.MessageId,
        sesMessageId: messageId,
        topicArn: snsMessage.TopicArn,
        timestamp: snsMessage.Timestamp,
        headers: mailObject.headers || [],
        commonHeaders: mailObject.commonHeaders || {},
        originalPayload: {
          destinationCount: mailObject.destination?.length || 0,
          headerCount: mailObject.headers?.length || 0,
          hasCommonHeaders: !!mailObject.commonHeaders,
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
        receivedAt,
        metadata,
      };
    } catch (error) {
      throw new ProviderParsingError('ses', {
        message: 'Failed to normalize SES payload',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extract text content from SES message
   * In production, this would fetch from S3
   */
  private extractTextFromSESContent(sesMessage: any): string {
    // This is a simplified implementation
    // In production, you'd fetch the actual email content from S3 using the S3 object key
    const content = sesMessage.content?.text || sesMessage.receipt?.action?.objectKey || '';
    return normalizeEmailContent(content);
  }

  /**
   * Extract HTML content from SES message
   * In production, this would fetch from S3
   */
  private extractHTMLFromSESContent(sesMessage: any): string {
    // This is a simplified implementation
    // In production, you'd fetch the actual email content from S3 using the S3 object key
    const content = sesMessage.content?.html || '';
    return normalizeEmailContent(content);
  }

  /**
   * Normalize SES attachments to standard format
   */
  private normalizeSESAttachments(attachments: any[]): Array<{
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
          return {
            name: att.filename || att.name || 'unknown',
            contentType: att.contentType || att.type || 'application/octet-stream',
            size: att.size || 0,
            key: att.s3ObjectKey || att.key,
          };
        } catch (error) {
          // Skip invalid attachments
          return null;
        }
      })
      .filter((att): att is NonNullable<typeof att> => att !== null);
  }

  /**
   * Health check for SES provider
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    responseTimeMs?: number;
    error?: string;
    details?: Record<string, any>;
  }> {
    const startTime = Date.now();
    
    try {
      // Basic configuration check
      const hasWebhookSecret = !!this.webhookSecret;
      const hasSharedSecret = !!this.sharedSecret;
      const hasValidTimeout = this.timeoutMs > 0 && this.timeoutMs <= 60000;
      const signatureVerificationEnabled = this.verifySignature;

      // Healthy if we have at least one secret or we're in development with verification disabled
      const healthy = (hasWebhookSecret || hasSharedSecret) || 
                     (config.app.isDevelopment && !signatureVerificationEnabled);
      const responseTimeMs = Date.now() - startTime;

      return {
        healthy,
        responseTimeMs,
        details: {
          hasWebhookSecret,
          hasSharedSecret,
          hasValidTimeout,
          signatureVerificationEnabled,
          timeoutMs: this.timeoutMs,
          environment: config.app.nodeEnv,
          supportsDualPath: true,
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
 * Factory function to create SESAdapter with configuration
 */
export function createSESAdapter(options?: {
  webhookSecret?: string;
  timeoutMs?: number;
  verifySignature?: boolean;
  sharedSecret?: string;
}): SESAdapter {
  return new SESAdapter(
    options?.webhookSecret,
    options?.timeoutMs,
    options?.verifySignature,
    options?.sharedSecret
  );
}

/**
 * Default SES adapter instance using environment configuration
 */
export const defaultSESAdapter = createSESAdapter({
  webhookSecret: config.inboundProvider.sesSecret,
  sharedSecret: config.inboundProvider.sharedSecret,
  timeoutMs: 30000,
  verifySignature: true,
});