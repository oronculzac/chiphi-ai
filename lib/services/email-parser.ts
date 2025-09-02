import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { ParsedEmail, EmailAttachment, ProcessingErrorType } from '@/lib/types';
import { config } from '@/lib/config';

/**
 * Parses raw MIME email content using mailparser
 * Extracts text, HTML, attachments, and headers
 */
export async function parseEmail(mimeContent: string): Promise<ParsedEmail> {
  try {
    // Check email size limit
    const sizeInMB = Buffer.byteLength(mimeContent, 'utf8') / (1024 * 1024);
    if (sizeInMB > config.email.maxSizeMB) {
      throw new Error(`Email size ${sizeInMB.toFixed(2)}MB exceeds limit of ${config.email.maxSizeMB}MB`);
    }
    
    // Parse the MIME content
    const parsed: ParsedMail = await simpleParser(mimeContent);
    
    // Extract and process attachments
    const attachments: EmailAttachment[] = [];
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const attachment of parsed.attachments) {
        attachments.push(processAttachment(attachment));
      }
    }
    
    // Extract headers as key-value pairs
    const headers: Record<string, string> = {};
    if (parsed.headers) {
      parsed.headers.forEach((value, key) => {
        // Convert header values to strings
        if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          headers[key] = JSON.stringify(value);
        } else {
          headers[key] = String(value || '');
        }
      });
    }
    
    // Build the parsed email object
    const parsedEmail: ParsedEmail = {
      messageId: parsed.messageId || generateFallbackMessageId(),
      from: extractEmailAddress(parsed.from),
      to: extractEmailAddress(parsed.to),
      subject: parsed.subject || '',
      text: cleanTextContent(parsed.text || ''),
      html: parsed.html || '',
      attachments,
      headers,
    };
    
    return parsedEmail;
    
  } catch (error) {
    console.error('Email parsing failed:', error);
    throw new Error(`Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Processes an attachment from mailparser
 */
function processAttachment(attachment: Attachment): EmailAttachment {
  return {
    filename: attachment.filename || undefined,
    contentType: attachment.contentType || 'application/octet-stream',
    size: attachment.size || attachment.content?.length || 0,
    content: attachment.content || Buffer.alloc(0),
  };
}

/**
 * Extracts email address from parsed address object or string
 */
function extractEmailAddress(addressField: any): string {
  if (!addressField) return '';
  
  // Handle array of addresses (take first one)
  if (Array.isArray(addressField)) {
    addressField = addressField[0];
  }
  
  // Handle address object with 'address' property
  if (typeof addressField === 'object' && addressField.address) {
    return addressField.address;
  }
  
  // Handle string addresses
  if (typeof addressField === 'string') {
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = addressField.match(/<([^>]+)>/);
    if (emailMatch) {
      return emailMatch[1];
    }
    return addressField;
  }
  
  return '';
}

/**
 * Cleans and normalizes text content
 * Removes excessive whitespace and normalizes line endings
 */
function cleanTextContent(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')   // Handle old Mac line endings
    .replace(/\n{3,}/g, '\n\n') // Reduce excessive line breaks
    .replace(/[ \t]+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Generates a fallback message ID if none is present
 */
function generateFallbackMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `fallback-${timestamp}-${random}@chiphi.ai`;
}

/**
 * Validates that the email contains receipt-like content
 * This is a basic heuristic check to filter out non-receipt emails
 */
export function isLikelyReceipt(parsedEmail: ParsedEmail): boolean {
  const content = (parsedEmail.text + ' ' + parsedEmail.subject).toLowerCase();
  
  // Receipt indicators
  const receiptKeywords = [
    'receipt', 'invoice', 'bill', 'payment', 'purchase', 'order',
    'transaction', 'charge', 'total', 'amount', 'paid', 'due',
    'thank you for your purchase', 'your order', 'confirmation',
    '$', '€', '£', '¥', 'usd', 'eur', 'gbp', 'jpy'
  ];
  
  // Check if content contains receipt-like keywords
  const hasReceiptKeywords = receiptKeywords.some(keyword => 
    content.includes(keyword)
  );
  
  // Check for currency patterns
  const hasCurrencyPattern = /[\$€£¥]\s*\d+|\d+\s*(?:usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)/i.test(content);
  
  // Check for date patterns (common in receipts)
  const hasDatePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(content);
  
  return hasReceiptKeywords || hasCurrencyPattern || hasDatePattern;
}

/**
 * Extracts potential receipt text from email content
 * Prioritizes plain text over HTML and cleans up formatting
 */
export function extractReceiptText(parsedEmail: ParsedEmail): string {
  // Prefer plain text if available and substantial
  if (parsedEmail.text && parsedEmail.text.length > 50) {
    return parsedEmail.text;
  }
  
  // Fall back to HTML content (would need HTML-to-text conversion in production)
  if (parsedEmail.html) {
    // Basic HTML tag removal (in production, use a proper HTML-to-text library)
    return parsedEmail.html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return '';
}