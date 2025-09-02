import { ParsedEmail, EmailAttachment, ProcessingError, ProcessingErrorType } from '@/lib/types';
import { config } from '@/lib/config';
import { loggingService } from './logging-service';
import { emailExists } from './email-storage';
import { pdfProcessor } from './pdf-processor';
import { forwardedEmailDetector } from './forwarded-email-detector';
import { duplicateDetector } from './duplicate-detector';
import { emailSanitizer, SecurityFlag, SanitizationAction } from './email-sanitizer';

/**
 * Advanced email processing service that handles:
 * - PDF attachment processing
 * - Forwarded email chains
 * - Duplicate detection
 * - Content sanitization and security scanning
 */
export class AdvancedEmailProcessor {
  
  /**
   * Processes email with advanced features including attachment handling,
   * duplicate detection, and security scanning
   */
  async processAdvancedEmail(
    parsedEmail: ParsedEmail,
    orgId: string,
    correlationId: string
  ): Promise<{
    processedEmail: ParsedEmail;
    attachmentTexts: string[];
    isDuplicate: boolean;
    securityFlags: SecurityFlag[];
    sanitizationActions: SanitizationAction[];
    forwardedChain?: ForwardedEmailChain;
  }> {
    const startTime = Date.now();
    
    try {
      // 1. Enhanced duplicate detection with multiple strategies
      const duplicateResult = await duplicateDetector.isDuplicate(
        parsedEmail,
        orgId,
        correlationId
      );
      
      if (duplicateResult.isDuplicate) {
        await loggingService.logProcessingStep({
          orgId,
          emailId: '',
          step: 'duplicate_detection',
          status: 'completed',
          details: {
            messageId: parsedEmail.messageId,
            isDuplicate: true,
            reason: duplicateResult.reason,
            confidence: duplicateResult.confidence,
            existingEmailId: duplicateResult.existingEmailId,
          },
          correlationId,
        });
        
        return {
          processedEmail: parsedEmail,
          attachmentTexts: [],
          isDuplicate: true,
          securityFlags: [],
          sanitizationActions: [],
        };
      }
      
      // 2. Comprehensive security scanning and content sanitization
      const sanitizationResult = await emailSanitizer.sanitizeEmail(
        parsedEmail,
        orgId,
        correlationId
      );
      
      const sanitizedEmail = sanitizationResult.sanitizedEmail;
      const securityFlags = sanitizationResult.securityFlags;
      const sanitizationActions = sanitizationResult.sanitizationActions;
      
      // 3. Process attachments (especially PDFs) with enhanced security
      const attachmentTexts = await this.processAttachments(
        sanitizedEmail.attachments,
        orgId,
        correlationId
      );
      
      // 4. Detect and process forwarded email chains
      const forwardedChain = await this.detectForwardedChain(sanitizedEmail);
      
      // 5. Enhanced content extraction from forwarded chains
      if (forwardedChain) {
        const enhancedContent = await this.extractFromForwardedChain(
          forwardedChain,
          sanitizedEmail
        );
        sanitizedEmail.text = enhancedContent.text;
        sanitizedEmail.html = enhancedContent.html;
      }
      
      // 6. Final validation and quality checks
      const qualityFlags = await this.performQualityChecks(sanitizedEmail, orgId);
      securityFlags.push(...qualityFlags);
      
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'advanced_email_processing',
        status: 'completed',
        details: {
          messageId: parsedEmail.messageId,
          attachmentCount: sanitizedEmail.attachments.length,
          attachmentTextsExtracted: attachmentTexts.length,
          securityFlagsCount: securityFlags.length,
          sanitizationActionsCount: sanitizationActions.length,
          hasForwardedChain: !!forwardedChain,
          processingTimeMs: Date.now() - startTime,
        },
        processingTimeMs: Date.now() - startTime,
        correlationId,
      });
      
      return {
        processedEmail: sanitizedEmail,
        attachmentTexts,
        isDuplicate: false,
        securityFlags,
        sanitizationActions,
        forwardedChain,
      };
      
    } catch (error) {
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'advanced_email_processing',
        status: 'failed',
        details: {
          messageId: parsedEmail.messageId,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: Date.now() - startTime,
        },
        processingTimeMs: Date.now() - startTime,
        correlationId,
      });
      
      throw error;
    }
  }
  
  /**
   * Performs quality checks on processed email content
   */
  private async performQualityChecks(
    email: ParsedEmail,
    orgId: string
  ): Promise<SecurityFlag[]> {
    const qualityFlags: SecurityFlag[] = [];
    
    // 1. Check if email appears to be a receipt
    const isLikelyReceipt = this.isLikelyReceiptContent(email);
    if (!isLikelyReceipt) {
      qualityFlags.push({
        type: 'suspicious_sender',
        severity: 'low',
        description: 'Email content does not appear to be a receipt',
        location: 'text_content',
      });
    }
    
    // 2. Check content length and quality
    const totalContentLength = (email.text || '').length + (email.html || '').length;
    if (totalContentLength < 50) {
      qualityFlags.push({
        type: 'suspicious_sender',
        severity: 'low',
        description: 'Email content is unusually short for a receipt',
        location: 'text_content',
      });
    }
    
    // 3. Check for excessive forwarding (potential spam)
    if (email.subject.toLowerCase().includes('fwd:') && 
        (email.subject.match(/fwd:/gi) || []).length > 3) {
      qualityFlags.push({
        type: 'suspicious_sender',
        severity: 'medium',
        description: 'Email has been forwarded multiple times',
        location: 'sender',
      });
    }
    
    return qualityFlags;
  }
  
  /**
   * Checks if email content appears to be receipt-related
   */
  private isLikelyReceiptContent(email: ParsedEmail): boolean {
    const content = `${email.subject} ${email.text}`.toLowerCase();
    
    const receiptKeywords = [
      'receipt', 'invoice', 'bill', 'payment', 'purchase', 'order',
      'transaction', 'charge', 'total', 'amount', 'paid', 'due',
      'thank you for your purchase', 'your order', 'confirmation',
    ];
    
    const currencyPatterns = /[\$€£¥]\s*\d+|\d+\s*(?:usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)/i;
    
    const hasReceiptKeywords = receiptKeywords.some(keyword => 
      content.includes(keyword)
    );
    
    const hasCurrency = currencyPatterns.test(content);
    
    return hasReceiptKeywords || hasCurrency;
  }
  
  /**
   * Processes attachments, especially PDF receipts
   */
  private async processAttachments(
    attachments: EmailAttachment[],
    orgId: string,
    correlationId: string
  ): Promise<string[]> {
    try {
      // Process PDF attachments
      const pdfTexts = await pdfProcessor.processPDFAttachments(attachments, orgId, correlationId);
      
      // Process other attachment types (placeholder for future expansion)
      const otherTexts = await this.processOtherAttachments(attachments, orgId, correlationId);
      
      return [...pdfTexts, ...otherTexts];
      
    } catch (error) {
      console.error('Attachment processing failed:', error);
      return [];
    }
  }
  
  /**
   * Processes non-PDF attachments (placeholder for future expansion)
   */
  private async processOtherAttachments(
    attachments: EmailAttachment[],
    orgId: string,
    correlationId: string
  ): Promise<string[]> {
    const texts: string[] = [];
    
    for (const attachment of attachments) {
      // Skip PDFs as they're handled separately
      if (attachment.contentType === 'application/pdf') {
        continue;
      }
      
      // Handle image attachments (placeholder for OCR)
      if (attachment.contentType.startsWith('image/')) {
        // Future: Implement OCR for receipt images
        await loggingService.logProcessingStep({
          orgId,
          emailId: '',
          step: 'image_attachment_processing',
          status: 'skipped',
          details: {
            filename: attachment.filename,
            contentType: attachment.contentType,
            reason: 'Image OCR not implemented in this version',
          },
          correlationId,
        });
      }
      
      // Handle text attachments
      if (attachment.contentType.startsWith('text/')) {
        try {
          const text = attachment.content.toString('utf-8');
          texts.push(text);
        } catch (error) {
          console.error(`Failed to process text attachment ${attachment.filename}:`, error);
        }
      }
    }
    
    return texts;
  }
  
  /**
   * Detects and processes forwarded email chains
   */
  private async detectForwardedChain(email: ParsedEmail): Promise<ForwardedEmailChain | null> {
    return await forwardedEmailDetector.detectForwardedChain(email);
  }
  
  /**
   * Extracts enhanced content from forwarded email chains
   */
  private async extractFromForwardedChain(
    chain: ForwardedEmailChain,
    email: ParsedEmail
  ): Promise<{ text: string; html: string }> {
    return await forwardedEmailDetector.extractFromForwardedChain(chain, email);
  }
  

}

// Types for advanced email processing
export interface ForwardedEmailChain {
  originalSender: string;
  forwardedBy: string[];
  originalDate?: Date;
  chainDepth: number;
  extractedContent: string;
}

// Export singleton instance
export const advancedEmailProcessor = new AdvancedEmailProcessor();