import { EmailAttachment } from '@/lib/types';
import { loggingService } from './logging-service';

/**
 * PDF processing service for extracting text from PDF receipt attachments
 * Note: This is a basic implementation. In production, you would use a proper PDF parsing library
 * like pdf-parse, pdf2pic, or a cloud service like AWS Textract
 */
export class PDFProcessor {
  
  /**
   * Processes PDF attachments and extracts text content
   */
  async processPDFAttachments(
    attachments: EmailAttachment[],
    orgId: string,
    correlationId: string
  ): Promise<string[]> {
    const pdfTexts: string[] = [];
    
    for (const attachment of attachments) {
      if (this.isPDFAttachment(attachment)) {
        try {
          const extractedText = await this.extractTextFromPDF(attachment, orgId, correlationId);
          if (extractedText.trim()) {
            pdfTexts.push(extractedText);
          }
        } catch (error) {
          console.error(`Failed to process PDF attachment ${attachment.filename}:`, error);
          
          await loggingService.logProcessingStep({
            orgId,
            emailId: '',
            step: 'pdf_processing',
            status: 'failed',
            details: {
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            correlationId,
          });
        }
      }
    }
    
    return pdfTexts;
  }
  
  /**
   * Checks if an attachment is a PDF file
   */
  private isPDFAttachment(attachment: EmailAttachment): boolean {
    return (
      attachment.contentType === 'application/pdf' ||
      (attachment.filename && attachment.filename.toLowerCase().endsWith('.pdf'))
    );
  }
  
  /**
   * Extracts text from PDF attachment
   * This is a placeholder implementation - in production, use a proper PDF library
   */
  private async extractTextFromPDF(
    attachment: EmailAttachment,
    orgId: string,
    correlationId: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Basic PDF header validation
      if (!this.isValidPDF(attachment.content)) {
        throw new Error('Invalid PDF file format');
      }
      
      // For now, we'll use a simple text extraction approach
      // In production, replace this with a proper PDF parsing library
      const extractedText = await this.basicPDFTextExtraction(attachment.content);
      
      await loggingService.logProcessingStep({
        orgId,
        emailId: '',
        step: 'pdf_text_extraction',
        status: 'completed',
        details: {
          filename: attachment.filename,
          size: attachment.size,
          extractedLength: extractedText.length,
          processingTimeMs: Date.now() - startTime,
        },
        processingTimeMs: Date.now() - startTime,
        correlationId,
      });
      
      return extractedText;
      
    } catch (error) {
      throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Enhanced PDF validation with security checks
   */
  private isValidPDF(buffer: Buffer): boolean {
    if (buffer.length < 8) return false;
    
    // Check for PDF magic number
    const header = buffer.subarray(0, 4).toString('ascii');
    if (header !== '%PDF') return false;
    
    // Check PDF version (should be 1.0 to 2.0)
    const versionMatch = buffer.subarray(0, 20).toString('ascii').match(/%PDF-(\d+\.\d+)/);
    if (!versionMatch) return false;
    
    const version = parseFloat(versionMatch[1]);
    if (version < 1.0 || version > 2.0) return false;
    
    // Basic security check - look for suspicious content
    const pdfString = buffer.toString('latin1');
    
    // Check for potentially malicious JavaScript
    if (pdfString.includes('/JavaScript') || pdfString.includes('/JS')) {
      console.warn('PDF contains JavaScript - potential security risk');
      return false;
    }
    
    // Check for embedded files
    if (pdfString.includes('/EmbeddedFile')) {
      console.warn('PDF contains embedded files - potential security risk');
      return false;
    }
    
    // Check for forms with submit actions
    if (pdfString.includes('/SubmitForm')) {
      console.warn('PDF contains form submission - potential security risk');
      return false;
    }
    
    return true;
  }
  
  /**
   * Basic PDF text extraction (placeholder implementation)
   * In production, replace with proper PDF parsing library like pdf-parse
   */
  private async basicPDFTextExtraction(buffer: Buffer): Promise<string> {
    try {
      // This is a very basic approach that looks for text streams in PDF
      // In production, use a proper PDF parsing library
      const pdfString = buffer.toString('latin1');
      
      // Look for text streams between stream/endstream markers
      const streamRegex = /stream\s*(.*?)\s*endstream/gs;
      const textRegex = /\((.*?)\)/g;
      
      let extractedText = '';
      let match;
      
      while ((match = streamRegex.exec(pdfString)) !== null) {
        const streamContent = match[1];
        let textMatch;
        
        while ((textMatch = textRegex.exec(streamContent)) !== null) {
          const text = textMatch[1];
          // Basic cleanup of PDF text
          const cleanText = text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\(.)/g, '$1');
          
          extractedText += cleanText + ' ';
        }
      }
      
      // Clean up the extracted text
      return extractedText
        .replace(/\s+/g, ' ')
        .trim();
        
    } catch (error) {
      console.error('Basic PDF text extraction failed:', error);
      return '';
    }
  }
  
  /**
   * Enhanced PDF processing using OCR for image-based PDFs
   * This is a placeholder for future OCR integration
   */
  async processImageBasedPDF(
    attachment: EmailAttachment,
    orgId: string,
    correlationId: string
  ): Promise<string> {
    // Placeholder for OCR processing
    // In production, integrate with services like:
    // - AWS Textract
    // - Google Cloud Vision API
    // - Azure Computer Vision
    // - Tesseract.js for client-side OCR
    
    await loggingService.logProcessingStep({
      orgId,
      emailId: '',
      step: 'pdf_ocr_processing',
      status: 'skipped',
      details: {
        filename: attachment.filename,
        reason: 'OCR processing not implemented in this version',
      },
      correlationId,
    });
    
    return '';
  }
  
  /**
   * Validates PDF content for receipt-like information
   */
  isLikelyReceiptPDF(extractedText: string): boolean {
    const content = extractedText.toLowerCase();
    
    const receiptIndicators = [
      'receipt', 'invoice', 'bill', 'total', 'amount', 'paid',
      'subtotal', 'tax', 'tip', 'gratuity', 'purchase',
      'transaction', 'order', 'payment', 'charge'
    ];
    
    const currencyPatterns = /[\$€£¥]\s*\d+|\d+\s*(?:usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)/i;
    
    const hasReceiptKeywords = receiptIndicators.some(keyword => 
      content.includes(keyword)
    );
    
    const hasCurrency = currencyPatterns.test(content);
    
    return hasReceiptKeywords || hasCurrency;
  }
}

// Export singleton instance
export const pdfProcessor = new PDFProcessor();