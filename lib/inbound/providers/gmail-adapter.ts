import { google } from 'googleapis';
import {
  InboundEmailProvider,
  InboundEmailPayload,
  ProviderVerificationError,
  ProviderParsingError,
  ProviderConfigurationError,
  normalizeEmailContent,
  sanitizeMetadata,
  generateCorrelationId,
} from '../types';
import { config } from '@/lib/config';

/**
 * Gmail API adapter for receiving emails via webhook simulation
 * Simplified version for personal Gmail accounts without Pub/Sub
 */
export class GmailAdapter implements InboundEmailProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;

  constructor(options?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  }) {
    this.clientId = options?.clientId || process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = options?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    this.refreshToken = options?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || '';

    // Skip validation during build time
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                       process.env.NODE_ENV === undefined;
    
    if (!isBuildTime && (!this.clientId || !this.clientSecret)) {
      throw new ProviderConfigurationError('gmail', {
        message: 'Google OAuth credentials are required',
        requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      });
    }
  }

  getName(): string {
    return 'gmail';
  }

  /**
   * Verify request from n8n or test mode
   */
  async verify(req: Request): Promise<boolean> {
    try {
      // Check for n8n workflow header
      const n8nWorkflow = req.headers.get('x-n8n-workflow');
      const n8nAiAgent = req.headers.get('x-n8n-ai-agent');
      if (n8nWorkflow === 'true' || n8nAiAgent === 'true') {
        return true;
      }

      // In development or test mode, allow bypass
      const testMode = req.headers.get('x-test-mode');
      if (testMode === 'true' && config.app.isDevelopment) {
        return true;
      }

      // In development, skip verification if no credentials
      if (!this.clientId && config.app.isDevelopment) {
        return true;
      }

      // For production, you might want to add webhook signature verification
      // For now, just check if it's valid JSON
      const body = await req.clone().text();
      try {
        JSON.parse(body);
        return true;
      } catch {
        throw new ProviderVerificationError('gmail', {
          message: 'Invalid JSON in request body',
        });
      }
    } catch (error) {
      if (error instanceof ProviderVerificationError) {
        throw error;
      }
      
      throw new ProviderVerificationError('gmail', {
        message: 'Verification failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse email payload (simplified for testing)
   */
  async parse(req: Request): Promise<InboundEmailPayload> {
    try {
      const correlationId = generateCorrelationId();
      const body = await req.text();
      
      if (!body) {
        throw new ProviderParsingError('gmail', {
          message: 'Empty request body',
          correlationId,
        });
      }

      let emailPayload: any;
      try {
        emailPayload = JSON.parse(body);
      } catch (parseError) {
        throw new ProviderParsingError('gmail', {
          message: 'Invalid JSON in request body',
          correlationId,
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }

      // For testing, accept direct email payload format
      if (emailPayload.alias && emailPayload.messageId) {
        // Direct email payload - just validate and return
        return {
          alias: emailPayload.alias,
          messageId: emailPayload.messageId,
          from: emailPayload.from,
          to: emailPayload.to,
          subject: emailPayload.subject || '',
          text: emailPayload.text,
          html: emailPayload.html,
          attachments: emailPayload.attachments,
          receivedAt: new Date(emailPayload.receivedAt || Date.now()),
          metadata: {
            ...emailPayload.metadata,
            provider: 'gmail',
            correlationId,
          },
        };
      }

      // If it's a Gmail API notification, we'd fetch from Gmail API here
      // For now, throw error for unsupported format
      throw new ProviderParsingError('gmail', {
        message: 'Unsupported email payload format',
        correlationId,
      });
    } catch (error) {
      if (error instanceof ProviderParsingError) {
        throw error;
      }
      
      throw new ProviderParsingError('gmail', {
        message: 'Parsing failed with unexpected error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fetch email content from Gmail API
   */
  private async fetchEmailFromGmail(messageId: string, correlationId: string): Promise<InboundEmailPayload> {
    try {
      // Set up Google Auth
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: this.clientEmail,
          private_key: this.privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      });

      const gmail = google.gmail({ version: 'v1', auth });

      // Fetch email message
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message) {
        throw new Error('Failed to fetch email from Gmail API');
      }

      // Parse email headers
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('from');
      const to = getHeader('to');
      const subject = getHeader('subject');
      const messageIdHeader = getHeader('message-id');

      // Extract email content
      const { text, html } = this.extractEmailContent(message.payload);

      // Extract attachments info
      const attachments = this.extractAttachments(message.payload);

      // Determine which alias this email was sent to
      const alias = this.extractAlias(to, headers);

      const metadata = sanitizeMetadata({
        provider: 'gmail',
        correlationId,
        gmailMessageId: messageId,
        threadId: message.threadId,
        labelIds: message.labelIds,
        historyId: message.historyId,
        internalDate: message.internalDate,
      });

      return {
        alias,
        messageId: messageIdHeader || `gmail_${messageId}`,
        from,
        to,
        subject,
        text: text || undefined,
        html: html || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        receivedAt: new Date(parseInt(message.internalDate || '0')),
        metadata,
      };
    } catch (error) {
      throw new ProviderParsingError('gmail', {
        message: 'Failed to fetch email from Gmail API',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extract text and HTML content from Gmail message payload
   */
  private extractEmailContent(payload: any): { text: string; html: string } {
    let text = '';
    let html = '';

    const extractFromPart = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += Buffer.from(part.body.data, 'base64').toString();
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html += Buffer.from(part.body.data, 'base64').toString();
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload?.parts) {
      payload.parts.forEach(extractFromPart);
    } else if (payload?.body?.data) {
      // Single part message
      if (payload.mimeType === 'text/plain') {
        text = Buffer.from(payload.body.data, 'base64').toString();
      } else if (payload.mimeType === 'text/html') {
        html = Buffer.from(payload.body.data, 'base64').toString();
      }
    }

    return {
      text: normalizeEmailContent(text),
      html: normalizeEmailContent(html),
    };
  }

  /**
   * Extract attachment information from Gmail message payload
   */
  private extractAttachments(payload: any): Array<{
    name: string;
    contentType: string;
    size: number;
    key?: string;
  }> {
    const attachments: any[] = [];

    const extractFromPart = (part: any) => {
      if (part.filename && part.body?.size) {
        attachments.push({
          name: part.filename,
          contentType: part.mimeType || 'application/octet-stream',
          size: parseInt(part.body.size),
          // Note: In a real implementation, you'd download and store the attachment
          key: undefined,
        });
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload?.parts) {
      payload.parts.forEach(extractFromPart);
    }

    return attachments;
  }

  /**
   * Extract the alias email from the To header
   */
  private extractAlias(to: string, headers: any[]): string {
    // Try to find the specific alias from the To header
    // This might need customization based on your email setup
    const toAddresses = to.split(',').map(addr => addr.trim());
    
    // Look for addresses matching your domain
    const domainPattern = /@(.*\.)?oronculzac\.com$/i;
    const matchingAddress = toAddresses.find(addr => domainPattern.test(addr));
    
    return matchingAddress || to;
  }

  /**
   * Health check for Gmail provider
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
      const hasCredentials = !!(this.clientEmail && this.privateKey && this.projectId);
      
      if (!hasCredentials && !config.app.isDevelopment) {
        return {
          healthy: false,
          responseTimeMs: Date.now() - startTime,
          error: 'Missing Google service account credentials',
          details: {
            hasClientEmail: !!this.clientEmail,
            hasPrivateKey: !!this.privateKey,
            hasProjectId: !!this.projectId,
          },
        };
      }

      // In development, consider it healthy if we have basic config
      return {
        healthy: true,
        responseTimeMs: Date.now() - startTime,
        details: {
          hasCredentials,
          projectId: this.projectId,
          topicName: this.topicName,
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
 * Factory function to create GmailAdapter with configuration
 */
export function createGmailAdapter(options?: {
  clientEmail?: string;
  privateKey?: string;
  projectId?: string;
  topicName?: string;
}): GmailAdapter {
  return new GmailAdapter(options);
}