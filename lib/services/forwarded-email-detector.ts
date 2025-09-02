import { ParsedEmail } from '@/lib/types';
import { ForwardedEmailChain } from './advanced-email-processor';

/**
 * Service for detecting and processing forwarded email chains
 * Handles nested receipts and extracts original content
 */
export class ForwardedEmailDetector {
  
  /**
   * Detects if an email is part of a forwarded chain and extracts the chain structure
   */
  async detectForwardedChain(email: ParsedEmail): Promise<ForwardedEmailChain | null> {
    try {
      // Check for forwarded email indicators
      const isForwarded = this.isForwardedEmail(email);
      if (!isForwarded) {
        return null;
      }
      
      // Extract forwarded chain information
      const chain = await this.extractForwardedChain(email);
      return chain;
      
    } catch (error) {
      console.error('Forwarded email detection failed:', error);
      return null;
    }
  }
  
  /**
   * Checks if an email appears to be forwarded
   */
  private isForwardedEmail(email: ParsedEmail): boolean {
    const subject = email.subject.toLowerCase();
    const content = (email.text + ' ' + email.html).toLowerCase();
    
    // Check for forwarded indicators in subject
    const forwardedSubjectPatterns = [
      /^fwd?:/i,
      /^fw:/i,
      /forwarded/i,
      /\[fwd\]/i,
    ];
    
    const hasForwardedSubject = forwardedSubjectPatterns.some(pattern => 
      pattern.test(subject)
    );
    
    // Check for forwarded indicators in content
    const forwardedContentPatterns = [
      /---------- forwarded message ----------/i,
      /begin forwarded message/i,
      /original message/i,
      /from:.*sent:.*to:.*subject:/i,
      /de:.*enviado:.*para:.*assunto:/i, // Spanish
      /von:.*gesendet:.*an:.*betreff:/i, // German
      /de:.*envoyé:.*à:.*objet:/i, // French
    ];
    
    const hasForwardedContent = forwardedContentPatterns.some(pattern => 
      pattern.test(content)
    );
    
    return hasForwardedSubject || hasForwardedContent;
  }
  
  /**
   * Extracts the forwarded email chain structure
   */
  private async extractForwardedChain(email: ParsedEmail): Promise<ForwardedEmailChain> {
    const content = email.text + '\n' + email.html;
    
    // Extract original sender and forwarding chain
    const originalSender = this.extractOriginalSender(content);
    const forwardedBy = this.extractForwardingChain(content, email.from);
    const originalDate = this.extractOriginalDate(content);
    const extractedContent = this.extractOriginalContent(content);
    
    return {
      originalSender: originalSender || 'unknown',
      forwardedBy,
      originalDate,
      chainDepth: forwardedBy.length,
      extractedContent,
    };
  }
  
  /**
   * Extracts the original sender from forwarded email headers
   */
  private extractOriginalSender(content: string): string | null {
    const patterns = [
      /from:\s*([^\n\r<]+(?:<[^>]+>)?)/i,
      /de:\s*([^\n\r<]+(?:<[^>]+>)?)/i, // Spanish
      /von:\s*([^\n\r<]+(?:<[^>]+>)?)/i, // German
      /de:\s*([^\n\r<]+(?:<[^>]+>)?)/i, // French
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return this.cleanEmailAddress(match[1]);
      }
    }
    
    return null;
  }
  
  /**
   * Extracts the forwarding chain (who forwarded to whom)
   */
  private extractForwardingChain(content: string, currentSender: string): string[] {
    const chain: string[] = [];
    
    // Add current sender as the most recent forwarder
    chain.push(currentSender);
    
    // Look for additional forwarding indicators
    // This is a simplified implementation - in production, you might want more sophisticated parsing
    const forwardingPatterns = [
      /forwarded by:?\s*([^\n\r<]+(?:<[^>]+>)?)/gi,
      /sent by:?\s*([^\n\r<]+(?:<[^>]+>)?)/gi,
    ];
    
    for (const pattern of forwardingPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const forwarder = this.cleanEmailAddress(match[1]);
        if (forwarder && !chain.includes(forwarder)) {
          chain.push(forwarder);
        }
      }
    }
    
    return chain;
  }
  
  /**
   * Extracts the original date from forwarded email headers
   */
  private extractOriginalDate(content: string): Date | undefined {
    const patterns = [
      /sent:\s*([^\n\r]+)/i,
      /date:\s*([^\n\r]+)/i,
      /enviado:\s*([^\n\r]+)/i, // Spanish
      /gesendet:\s*([^\n\r]+)/i, // German
      /envoyé:\s*([^\n\r]+)/i, // French
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const dateStr = match[1].trim();
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (error) {
          // Continue to next pattern if date parsing fails
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extracts the original email content, removing forwarding headers
   */
  private extractOriginalContent(content: string): string {
    // Split content into lines for processing
    const lines = content.split(/\r?\n/);
    const originalContentLines: string[] = [];
    
    let inOriginalContent = false;
    let skipHeaderLines = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines at the beginning
      if (!inOriginalContent && !line) {
        continue;
      }
      
      // Detect start of original content
      if (!inOriginalContent) {
        if (this.isForwardingHeaderLine(line)) {
          inOriginalContent = true;
          skipHeaderLines = 5; // Skip next few lines which are usually headers
          continue;
        }
        
        // If we haven't found forwarding headers, include all content
        if (i > 10) { // After checking first 10 lines
          inOriginalContent = true;
        }
      }
      
      // Skip header lines after forwarding marker
      if (skipHeaderLines > 0) {
        if (this.isEmailHeaderLine(line)) {
          skipHeaderLines--;
          continue;
        } else {
          skipHeaderLines = 0; // Stop skipping if we hit non-header content
        }
      }
      
      // Include content lines
      if (inOriginalContent && skipHeaderLines === 0) {
        // Stop if we hit another forwarding marker (nested forwards)
        if (this.isForwardingHeaderLine(line) && originalContentLines.length > 0) {
          break;
        }
        
        originalContentLines.push(lines[i]); // Keep original formatting
      }
    }
    
    return originalContentLines.join('\n').trim();
  }
  
  /**
   * Checks if a line is a forwarding header marker
   */
  private isForwardingHeaderLine(line: string): boolean {
    const forwardingMarkers = [
      /---------- forwarded message ----------/i,
      /begin forwarded message/i,
      /original message/i,
      /mensaje original/i, // Spanish
      /ursprüngliche nachricht/i, // German
      /message d'origine/i, // French
    ];
    
    return forwardingMarkers.some(pattern => pattern.test(line));
  }
  
  /**
   * Checks if a line looks like an email header
   */
  private isEmailHeaderLine(line: string): boolean {
    const headerPatterns = [
      /^(from|to|cc|bcc|subject|date|sent):\s*/i,
      /^(de|para|cc|cco|asunto|fecha|enviado):\s*/i, // Spanish
      /^(von|an|cc|bcc|betreff|datum|gesendet):\s*/i, // German
      /^(de|à|cc|cci|objet|date|envoyé):\s*/i, // French
    ];
    
    return headerPatterns.some(pattern => pattern.test(line));
  }
  
  /**
   * Cleans and normalizes email addresses
   */
  private cleanEmailAddress(emailStr: string): string {
    // Remove extra whitespace
    emailStr = emailStr.trim();
    
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = emailStr.match(/<([^>]+)>/);
    if (emailMatch) {
      return emailMatch[1];
    }
    
    // Remove quotes and extra formatting
    return emailStr.replace(/['"]/g, '').trim();
  }
  
  /**
   * Enhanced content extraction that combines multiple forwarded receipts
   */
  async extractFromForwardedChain(
    chain: ForwardedEmailChain,
    email: ParsedEmail
  ): Promise<{ text: string; html: string }> {
    // Start with the extracted original content
    let combinedText = chain.extractedContent;
    let combinedHtml = email.html;
    
    // If we have multiple receipts in the chain, try to extract all of them
    const receiptSections = this.identifyReceiptSections(chain.extractedContent);
    
    if (receiptSections.length > 1) {
      // Combine multiple receipt sections
      combinedText = receiptSections.join('\n\n--- RECEIPT SEPARATOR ---\n\n');
    }
    
    // Add metadata about the forwarding chain
    const chainInfo = `\n\n[FORWARDING INFO: Original sender: ${chain.originalSender}, Forwarded by: ${chain.forwardedBy.join(' -> ')}, Chain depth: ${chain.chainDepth}]`;
    combinedText += chainInfo;
    
    return {
      text: combinedText,
      html: combinedHtml,
    };
  }
  
  /**
   * Identifies separate receipt sections within forwarded content
   */
  private identifyReceiptSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split(/\r?\n/);
    
    let currentSection: string[] = [];
    let inReceiptSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim().toLowerCase();
      
      // Receipt start indicators
      const receiptStartPatterns = [
        /receipt|invoice|bill/,
        /total|amount|subtotal/,
        /thank you for your purchase/,
        /order confirmation/,
        /transaction/,
      ];
      
      const isReceiptStart = receiptStartPatterns.some(pattern => 
        pattern.test(trimmedLine)
      );
      
      // Receipt end indicators
      const receiptEndPatterns = [
        /thank you|thanks for/,
        /visit us again/,
        /customer service/,
        /questions\?/,
      ];
      
      const isReceiptEnd = receiptEndPatterns.some(pattern => 
        pattern.test(trimmedLine)
      );
      
      if (isReceiptStart && !inReceiptSection) {
        // Start new receipt section
        if (currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
        }
        currentSection = [line];
        inReceiptSection = true;
      } else if (inReceiptSection) {
        currentSection.push(line);
        
        if (isReceiptEnd) {
          // End current receipt section
          sections.push(currentSection.join('\n'));
          currentSection = [];
          inReceiptSection = false;
        }
      } else if (!inReceiptSection && trimmedLine) {
        // Collect non-receipt content
        currentSection.push(line);
      }
    }
    
    // Add any remaining content
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
    
    // If no clear sections found, return original content
    return sections.length > 0 ? sections : [content];
  }
}

// Export singleton instance
export const forwardedEmailDetector = new ForwardedEmailDetector();