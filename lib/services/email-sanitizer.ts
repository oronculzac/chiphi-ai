import { ParsedEmail, EmailAttachment } from '@/lib/types';
import { loggingService } from './logging-service';

/**
 * Service for sanitizing email content and performing security scanning
 * Removes malicious content, redacts sensitive data, and validates attachments
 */
export class EmailSanitizer {
  
  /**
   * Sanitizes email content and attachments for security
   */
  async sanitizeEmail(
    email: ParsedEmail,
    orgId: string,
    correlationId: string
  ): Promise<{
    sanitizedEmail: ParsedEmail;
    securityFlags: SecurityFlag[];
    sanitizationActions: SanitizationAction[];
  }> {
    const startTime = Date.now();
    const securityFlags: SecurityFlag[] = [];
    const sanitizationActions: SanitizationAction[] = [];
    
    try {
      // Create a copy of the email for sanitization
      const sanitizedEmail: ParsedEmail = {
        ...email,
        text: email.text,
        html: email.html,
        attachments: [...email.attachments],
      };
      
      // 1. Scan and sanitize text content
      const textResult = await this.sanitizeTextContent(sanitizedEmail.text, orgId);
      sanitizedEmail.text = textResult.sanitizedContent;
      securityFlags.push(...textResult.securityFlags);
      sanitizationActions.push(...textResult.actions);
      
      // 2. Scan and sanitize HTML content
      const htmlResult = await this.sanitizeHtmlContent(sanitizedEmail.html, orgId);
      sanitizedEmail.html = htmlResult.sanitizedContent;
      securityFlags.push(...htmlResult.securityFlags);
      sanitizationActions.push(...htmlResult.actions);
      
      // 3. Scan and sanitize subject
      const subjectResult = await this.sanitizeTextContent(sanitizedEmail.subject, orgId);
      sanitizedEmail.subject = subjectResult.sanitizedContent;
      securityFlags.push(...subjectResult.securityFlags);
      sanitizationActions.push(...subjectResult.actions);
      
      // 4. Validate and sanitize attachments
      const attachmentResult = await this.sanitizeAttachments(
        sanitizedEmail.attachments,
        orgId,
        correlationId
      );
      sanitizedEmail.attachments = attachmentResult.sanitizedAttachments;
      securityFlags.push(...attachmentResult.securityFlags);
      sanitizationActions.push(...attachmentResult.actions);
      
      // 5. Validate sender and headers
      const headerFlags = await this.validateHeaders(sanitizedEmail, orgId);
      securityFlags.push(...headerFlags);
      
      // Log sanitization results
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'email_sanitization',
        status: 'completed',
        details: {
          messageId: email.messageId,
          securityFlagsCount: securityFlags.length,
          sanitizationActionsCount: sanitizationActions.length,
          highSeverityFlags: securityFlags.filter(f => f.severity === 'high').length,
          processingTimeMs: Date.now() - startTime,
        },
        processingTimeMs: Date.now() - startTime,
        correlationId,
      });
      
      return {
        sanitizedEmail,
        securityFlags,
        sanitizationActions,
      };
      
    } catch (error) {
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'email_sanitization',
        status: 'failed',
        details: {
          messageId: email.messageId,
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
   * Sanitizes text content and detects security issues
   */
  private async sanitizeTextContent(
    content: string,
    orgId: string
  ): Promise<{
    sanitizedContent: string;
    securityFlags: SecurityFlag[];
    actions: SanitizationAction[];
  }> {
    if (!content) {
      return {
        sanitizedContent: '',
        securityFlags: [],
        actions: [],
      };
    }
    
    const securityFlags: SecurityFlag[] = [];
    const actions: SanitizationAction[] = [];
    let sanitizedContent = content;
    
    // 1. Detect and flag suspicious patterns
    const suspiciousPatterns = [
      {
        pattern: /(?:click|tap)\s+(?:here|now|this|link)/gi,
        type: 'suspicious_links' as SecurityFlagType,
        severity: 'medium' as const,
        description: 'Suspicious call-to-action language detected',
      },
      {
        pattern: /(?:urgent|immediate|act\s+now|expires?\s+(?:today|soon))/gi,
        type: 'phishing_attempt' as SecurityFlagType,
        severity: 'medium' as const,
        description: 'Urgency-based phishing language detected',
      },
      {
        pattern: /(?:verify|confirm|update)\s+(?:your\s+)?(?:account|identity|information)/gi,
        type: 'phishing_attempt' as SecurityFlagType,
        severity: 'high' as const,
        description: 'Account verification phishing attempt detected',
      },
      {
        pattern: /(?:wire\s+transfer|bitcoin|cryptocurrency|send\s+money)/gi,
        type: 'financial_fraud' as SecurityFlagType,
        severity: 'high' as const,
        description: 'Financial fraud indicators detected',
      },
    ];
    
    for (const { pattern, type, severity, description } of suspiciousPatterns) {
      if (pattern.test(content)) {
        securityFlags.push({
          type,
          severity,
          description,
          location: 'text_content',
        });
      }
    }
    
    // 2. Redact sensitive information
    const sensitivePatterns = [
      {
        pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})\b/g,
        replacement: '**** **** **** $1',
        description: 'Credit card number redacted (kept last 4 digits)',
      },
      {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: '***-**-****',
        description: 'Social Security Number redacted',
      },
      {
        pattern: /\b\d{3}[\s.-]?\d{3}[\s.-]?(\d{4})\b/g,
        replacement: '***-***-$1',
        description: 'Phone number redacted (kept last 4 digits)',
      },
      {
        pattern: /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
        replacement: '***@$1',
        description: 'Email address redacted (kept domain)',
      },
    ];
    
    for (const { pattern, replacement, description } of sensitivePatterns) {
      const originalContent = sanitizedContent;
      sanitizedContent = sanitizedContent.replace(pattern, replacement);
      
      if (originalContent !== sanitizedContent) {
        actions.push({
          type: 'redaction',
          description,
          location: 'text_content',
        });
      }
    }
    
    // 3. Remove or neutralize potentially dangerous content
    const dangerousPatterns = [
      {
        pattern: /javascript:[^"'\s]*/gi,
        replacement: 'javascript:void(0)',
        description: 'JavaScript URLs neutralized',
      },
      {
        pattern: /data:text\/html[^"'\s]*/gi,
        replacement: 'data:text/plain,',
        description: 'Data URLs neutralized',
      },
    ];
    
    for (const { pattern, replacement, description } of dangerousPatterns) {
      const originalContent = sanitizedContent;
      sanitizedContent = sanitizedContent.replace(pattern, replacement);
      
      if (originalContent !== sanitizedContent) {
        actions.push({
          type: 'neutralization',
          description,
          location: 'text_content',
        });
        
        securityFlags.push({
          type: 'malicious_code',
          severity: 'high',
          description: 'Potentially malicious content neutralized',
          location: 'text_content',
        });
      }
    }
    
    return {
      sanitizedContent,
      securityFlags,
      actions,
    };
  }
  
  /**
   * Sanitizes HTML content with enhanced security measures
   */
  private async sanitizeHtmlContent(
    content: string,
    orgId: string
  ): Promise<{
    sanitizedContent: string;
    securityFlags: SecurityFlag[];
    actions: SanitizationAction[];
  }> {
    if (!content) {
      return {
        sanitizedContent: '',
        securityFlags: [],
        actions: [],
      };
    }
    
    const securityFlags: SecurityFlag[] = [];
    const actions: SanitizationAction[] = [];
    let sanitizedContent = content;
    
    // 1. Remove dangerous script tags
    const scriptPattern = /<script[^>]*>.*?<\/script>/gis;
    if (scriptPattern.test(sanitizedContent)) {
      sanitizedContent = sanitizedContent.replace(scriptPattern, '');
      actions.push({
        type: 'removal',
        description: 'Script tags removed',
        location: 'html_content',
      });
      securityFlags.push({
        type: 'malicious_code',
        severity: 'high',
        description: 'Script tags detected and removed',
        location: 'html_content',
      });
    }
    
    // 2. Remove dangerous style tags with expressions
    const stylePattern = /<style[^>]*>.*?<\/style>/gis;
    const styleMatches = sanitizedContent.match(stylePattern);
    if (styleMatches) {
      for (const styleMatch of styleMatches) {
        if (styleMatch.includes('expression(') || styleMatch.includes('javascript:')) {
          sanitizedContent = sanitizedContent.replace(styleMatch, '');
          actions.push({
            type: 'removal',
            description: 'Dangerous style tag removed',
            location: 'html_content',
          });
          securityFlags.push({
            type: 'malicious_code',
            severity: 'high',
            description: 'Malicious CSS expressions detected and removed',
            location: 'html_content',
          });
        }
      }
    }
    
    // 3. Neutralize event handlers
    const eventHandlers = [
      'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown',
      'onkeyup', 'onkeypress',
    ];
    
    for (const handler of eventHandlers) {
      const handlerPattern = new RegExp(`\\s${handler}\\s*=\\s*["'][^"']*["']`, 'gi');
      if (handlerPattern.test(sanitizedContent)) {
        sanitizedContent = sanitizedContent.replace(handlerPattern, ` data-removed-${handler}=""`);
        actions.push({
          type: 'neutralization',
          description: `Event handler ${handler} neutralized`,
          location: 'html_content',
        });
        securityFlags.push({
          type: 'malicious_code',
          severity: 'medium',
          description: `Event handler ${handler} detected and neutralized`,
          location: 'html_content',
        });
      }
    }
    
    // 4. Neutralize dangerous attributes
    const dangerousAttributes = [
      { attr: 'href', pattern: /href\s*=\s*["']javascript:[^"']*["']/gi },
      { attr: 'src', pattern: /src\s*=\s*["']javascript:[^"']*["']/gi },
      { attr: 'action', pattern: /action\s*=\s*["']javascript:[^"']*["']/gi },
    ];
    
    for (const { attr, pattern } of dangerousAttributes) {
      if (pattern.test(sanitizedContent)) {
        sanitizedContent = sanitizedContent.replace(pattern, `${attr}="javascript:void(0)"`);
        actions.push({
          type: 'neutralization',
          description: `Dangerous ${attr} attribute neutralized`,
          location: 'html_content',
        });
      }
    }
    
    return {
      sanitizedContent,
      securityFlags,
      actions,
    };
  }
  
  /**
   * Validates and sanitizes email attachments
   */
  private async sanitizeAttachments(
    attachments: EmailAttachment[],
    orgId: string,
    correlationId: string
  ): Promise<{
    sanitizedAttachments: EmailAttachment[];
    securityFlags: SecurityFlag[];
    actions: SanitizationAction[];
  }> {
    const securityFlags: SecurityFlag[] = [];
    const actions: SanitizationAction[] = [];
    const sanitizedAttachments: EmailAttachment[] = [];
    
    for (const attachment of attachments) {
      const result = await this.validateAttachment(attachment, orgId);
      
      if (result.isValid) {
        sanitizedAttachments.push(attachment);
      } else {
        actions.push({
          type: 'removal',
          description: `Attachment ${attachment.filename} removed: ${result.reason}`,
          location: 'attachment',
        });
      }
      
      securityFlags.push(...result.securityFlags);
    }
    
    return {
      sanitizedAttachments,
      securityFlags,
      actions,
    };
  }
  
  /**
   * Validates individual attachment for security
   */
  private async validateAttachment(
    attachment: EmailAttachment,
    orgId: string
  ): Promise<{
    isValid: boolean;
    reason?: string;
    securityFlags: SecurityFlag[];
  }> {
    const securityFlags: SecurityFlag[] = [];
    
    // 1. Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (attachment.size > maxSize) {
      securityFlags.push({
        type: 'oversized_attachment',
        severity: 'medium',
        description: `Attachment ${attachment.filename} exceeds size limit (${Math.round(attachment.size / 1024 / 1024)}MB)`,
        location: 'attachment',
      });
      return {
        isValid: false,
        reason: 'File size exceeds limit',
        securityFlags,
      };
    }
    
    // 2. Check for dangerous file types
    const dangerousTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/vnd.microsoft.portable-executable',
      'application/x-sh',
      'application/x-csh',
      'text/x-script',
    ];
    
    if (dangerousTypes.includes(attachment.contentType)) {
      securityFlags.push({
        type: 'dangerous_file_type',
        severity: 'high',
        description: `Dangerous file type: ${attachment.contentType}`,
        location: 'attachment',
      });
      return {
        isValid: false,
        reason: 'Dangerous file type',
        securityFlags,
      };
    }
    
    // 3. Check for suspicious file extensions
    const filename = attachment.filename?.toLowerCase() || '';
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
      '.jar', '.app', '.deb', '.pkg', '.dmg', '.sh', '.csh',
    ];
    
    const hasDangerousExtension = dangerousExtensions.some(ext => filename.endsWith(ext));
    if (hasDangerousExtension) {
      securityFlags.push({
        type: 'dangerous_file_type',
        severity: 'high',
        description: `Dangerous file extension in: ${attachment.filename}`,
        location: 'attachment',
      });
      return {
        isValid: false,
        reason: 'Dangerous file extension',
        securityFlags,
      };
    }
    
    // 4. Basic content validation for known types
    if (attachment.contentType === 'application/pdf') {
      const isValidPDF = this.validatePDFContent(attachment.content);
      if (!isValidPDF) {
        securityFlags.push({
          type: 'malicious_code',
          severity: 'high',
          description: 'PDF contains potentially malicious content',
          location: 'attachment',
        });
        return {
          isValid: false,
          reason: 'PDF security validation failed',
          securityFlags,
        };
      }
    }
    
    return {
      isValid: true,
      securityFlags,
    };
  }
  
  /**
   * Validates PDF content for security issues
   */
  private validatePDFContent(buffer: Buffer): boolean {
    try {
      const pdfString = buffer.toString('latin1');
      
      // Check for JavaScript
      if (pdfString.includes('/JavaScript') || pdfString.includes('/JS')) {
        return false;
      }
      
      // Check for embedded files
      if (pdfString.includes('/EmbeddedFile')) {
        return false;
      }
      
      // Check for form submissions
      if (pdfString.includes('/SubmitForm')) {
        return false;
      }
      
      // Check for launch actions
      if (pdfString.includes('/Launch')) {
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('PDF validation failed:', error);
      return false;
    }
  }
  
  /**
   * Validates email headers for suspicious patterns
   */
  private async validateHeaders(
    email: ParsedEmail,
    orgId: string
  ): Promise<SecurityFlag[]> {
    const securityFlags: SecurityFlag[] = [];
    
    // 1. Check sender reputation
    const senderDomain = email.from.split('@')[1]?.toLowerCase();
    if (senderDomain) {
      // Check against known spam domains
      const spamDomains = [
        'tempmail.org', '10minutemail.com', 'guerrillamail.com',
        'mailinator.com', 'yopmail.com', 'throwaway.email',
      ];
      
      if (spamDomains.includes(senderDomain)) {
        securityFlags.push({
          type: 'suspicious_sender',
          severity: 'medium',
          description: `Email from temporary/disposable email domain: ${senderDomain}`,
          location: 'sender',
        });
      }
    }
    
    // 2. Check for spoofing indicators
    if (email.headers) {
      const receivedHeaders = Object.keys(email.headers)
        .filter(key => key.toLowerCase().includes('received'))
        .map(key => email.headers[key]);
      
      // Basic spoofing detection (simplified)
      const hasMultipleReceived = receivedHeaders.length > 10;
      if (hasMultipleReceived) {
        securityFlags.push({
          type: 'suspicious_sender',
          severity: 'low',
          description: 'Unusual number of received headers detected',
          location: 'sender',
        });
      }
    }
    
    return securityFlags;
  }
}

// Types for email sanitization
export interface SecurityFlag {
  type: SecurityFlagType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  location: 'text_content' | 'html_content' | 'attachment' | 'sender';
}

export type SecurityFlagType = 
  | 'phishing_attempt'
  | 'suspicious_links'
  | 'financial_fraud'
  | 'malicious_code'
  | 'oversized_attachment'
  | 'dangerous_file_type'
  | 'suspicious_sender';

export interface SanitizationAction {
  type: 'redaction' | 'removal' | 'neutralization';
  description: string;
  location: 'text_content' | 'html_content' | 'attachment';
}

// Export singleton instance
export const emailSanitizer = new EmailSanitizer();