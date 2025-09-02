import { createAdminClient } from '@/lib/supabase/admin';
import { aiProcessingPipeline } from './ai-processing-pipeline';
import { transactionProcessor } from './transaction-processor';
import { errorHandler } from './error-handler';
import { loggingService } from './logging-service';
import { retryService } from './retry-service';
import { notificationService } from './notification-service';
import { advancedEmailProcessor } from './advanced-email-processor';
import { parseEmail } from './email-parser';
import { ProcessingError, ProcessingErrorType, Transaction, ParsedEmail } from '@/lib/types';

/**
 * Enhanced Email Processor with Comprehensive Error Handling
 * 
 * This service orchestrates the complete email-to-transaction processing pipeline
 * with comprehensive error handling, logging, retry mechanisms, and user notifications.
 * 
 * Requirements covered:
 * - 10.1: Log all processing steps with timestamps
 * - 10.2: Create retry mechanisms for transient AI service failures
 * - 10.3: Log detailed error information for debugging
 * - 10.4: Log security events
 * - 10.5: Alert administrators on system performance degradation
 */

export interface EmailProcessingResult {
  success: boolean;
  transaction?: Transaction;
  error?: ProcessingError;
  processingTimeMs: number;
  steps: Array<{
    step: string;
    status: 'completed' | 'failed' | 'skipped';
    timeMs: number;
    details?: Record<string, any>;
  }>;
}

export class EnhancedEmailProcessor {
  private supabase;

  constructor() {
    this.supabase = createAdminClient();
  }

  /**
   * Process email to transaction with comprehensive error handling and advanced features
   */
  async processEmailToTransaction(
    emailId: string,
    orgId: string,
    emailContent: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    const correlationId = loggingService.generateCorrelationId();
    const steps: EmailProcessingResult['steps'] = [];

    try {
      // Log processing start
      await loggingService.logProcessingStep({
        orgId,
        emailId,
        step: 'email_processing_start',
        status: 'started',
        details: {
          emailContentLength: emailContent.length,
          userId,
          correlationId,
          ...metadata,
        },
        correlationId,
      });

      // Step 1: Validate input
      const validationStep = await this.executeStep(
        'input_validation',
        () => this.validateInput(emailId, orgId, emailContent),
        { orgId, emailId, correlationId }
      );
      steps.push(validationStep);

      if (validationStep.status === 'failed') {
        throw new Error('Input validation failed');
      }

      // Step 2: Parse email content to structured format
      const emailParsingStep = await this.executeStep(
        'email_parsing',
        () => this.parseEmailContent(emailContent),
        { orgId, emailId, correlationId }
      );
      steps.push(emailParsingStep);

      if (emailParsingStep.status === 'failed') {
        throw new Error('Email parsing failed');
      }

      const parsedEmail = emailParsingStep.details?.result as ParsedEmail;

      // Step 3: Advanced email processing (duplicate detection, security scanning, etc.)
      const advancedProcessingStep = await this.executeStep(
        'advanced_email_processing',
        () => advancedEmailProcessor.processAdvancedEmail(parsedEmail, orgId, correlationId),
        { orgId, emailId, correlationId }
      );
      steps.push(advancedProcessingStep);

      if (advancedProcessingStep.status === 'failed') {
        throw new Error('Advanced email processing failed');
      }

      const advancedResult = advancedProcessingStep.details?.result;

      // If email is duplicate, return early
      if (advancedResult.isDuplicate) {
        await loggingService.logProcessingStep({
          orgId,
          emailId,
          step: 'email_processing_duplicate',
          status: 'completed',
          details: {
            reason: 'Email identified as duplicate',
            existingEmailId: advancedResult.existingEmailId,
            totalProcessingTimeMs: Date.now() - startTime,
            correlationId,
          },
          processingTimeMs: Date.now() - startTime,
          correlationId,
        });

        return {
          success: true,
          processingTimeMs: Date.now() - startTime,
          steps,
        };
      }

      // Combine email content with attachment texts for AI processing
      const combinedContent = this.combineEmailContent(
        advancedResult.processedEmail,
        advancedResult.attachmentTexts
      );

      // Step 4: AI Processing Pipeline with enhanced content
      const aiProcessingStep = await this.executeStep(
        'ai_processing',
        () => aiProcessingPipeline.processReceiptText(combinedContent, orgId, emailId),
        { orgId, emailId, correlationId }
      );
      steps.push(aiProcessingStep);

      if (aiProcessingStep.status === 'failed') {
        throw new Error('AI processing failed');
      }

      const processingResult = aiProcessingStep.details?.result;
      if (!processingResult) {
        throw new Error('AI processing returned no result');
      }

      // Log AI usage for cost tracking
      await this.logAIUsage(orgId, emailId, processingResult, correlationId);

      // Step 5: Transaction Creation with security context
      const transactionStep = await this.executeStep(
        'transaction_creation',
        () => this.createTransactionFromResult(
          emailId, 
          orgId, 
          processingResult, 
          userId,
          {
            securityFlags: advancedResult.securityFlags,
            sanitizationActions: advancedResult.sanitizationActions,
            forwardedChain: advancedResult.forwardedChain,
          }
        ),
        { orgId, emailId, correlationId }
      );
      steps.push(transactionStep);

      if (transactionStep.status === 'failed') {
        throw new Error('Transaction creation failed');
      }

      const transaction = transactionStep.details?.result as Transaction;

      // Step 6: Post-processing notifications with security alerts
      const notificationStep = await this.executeStep(
        'notifications',
        () => this.sendProcessingNotifications(
          userId, 
          orgId, 
          emailId, 
          transaction, 
          processingResult,
          advancedResult.securityFlags
        ),
        { orgId, emailId, correlationId }
      );
      steps.push(notificationStep);

      const totalProcessingTime = Date.now() - startTime;

      // Log successful completion with advanced processing details
      await loggingService.logProcessingStep({
        orgId,
        emailId,
        step: 'email_processing_complete',
        status: 'completed',
        details: {
          transactionId: transaction.id,
          totalProcessingTimeMs: totalProcessingTime,
          stepsCompleted: steps.length,
          confidence: transaction.confidence,
          securityFlagsCount: advancedResult.securityFlags.length,
          sanitizationActionsCount: advancedResult.sanitizationActions.length,
          attachmentTextsExtracted: advancedResult.attachmentTexts.length,
          hasForwardedChain: !!advancedResult.forwardedChain,
          correlationId,
        },
        processingTimeMs: totalProcessingTime,
        correlationId,
      });

      // Record overall performance metric
      await loggingService.recordPerformanceMetric({
        orgId,
        metricType: 'processing_time',
        metricValue: totalProcessingTime,
        metricUnit: 'ms',
        context: {
          operation: 'email_to_transaction',
          confidence: transaction.confidence,
          stepsCount: steps.length,
          securityFlagsCount: advancedResult.securityFlags.length,
          correlationId,
        },
      });

      return {
        success: true,
        transaction,
        processingTimeMs: totalProcessingTime,
        steps,
      };

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;

      // Handle the error comprehensively
      const processingError = await errorHandler.handleProcessingError(error as Error, {
        orgId,
        emailId,
        step: 'email_processing',
        userId,
        metadata: {
          totalProcessingTimeMs: totalProcessingTime,
          stepsCompleted: steps.length,
          correlationId,
          ...metadata,
        },
      });

      // Log processing failure
      await loggingService.logProcessingStep({
        orgId,
        emailId,
        step: 'email_processing_failed',
        status: 'failed',
        details: {
          errorType: processingError.type,
          totalProcessingTimeMs: totalProcessingTime,
          stepsCompleted: steps.length,
          correlationId,
        },
        errorMessage: processingError.message,
        processingTimeMs: totalProcessingTime,
        correlationId,
      });

      return {
        success: false,
        error: processingError,
        processingTimeMs: totalProcessingTime,
        steps,
      };
    }
  }

  /**
   * Process multiple emails in batch with concurrency control
   */
  async batchProcessEmails(
    emailJobs: Array<{
      emailId: string;
      orgId: string;
      emailContent: string;
      userId?: string;
      metadata?: Record<string, any>;
    }>,
    concurrency = 3
  ): Promise<Array<EmailProcessingResult>> {
    const results: Array<EmailProcessingResult> = [];
    
    // Process emails in batches to control resource usage
    for (let i = 0; i < emailJobs.length; i += concurrency) {
      const batch = emailJobs.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(job => this.processEmailToTransaction(
          job.emailId,
          job.orgId,
          job.emailContent,
          job.userId,
          job.metadata
        ))
      );

      // Convert PromiseSettledResult to EmailProcessingResult
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: {
              type: ProcessingErrorType.DATABASE_ERROR,
              message: result.reason?.message || 'Batch processing failed',
              details: { batchError: true },
              retryable: false,
            },
            processingTimeMs: 0,
            steps: [],
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a processing step with error handling and timing
   */
  private async executeStep<T>(
    stepName: string,
    operation: () => Promise<T>,
    context: { orgId: string; emailId: string; correlationId: string }
  ): Promise<{
    step: string;
    status: 'completed' | 'failed';
    timeMs: number;
    details?: Record<string, any>;
  }> {
    const stepStart = Date.now();

    try {
      const result = await operation();
      const timeMs = Date.now() - stepStart;

      await loggingService.logProcessingStep({
        orgId: context.orgId,
        emailId: context.emailId,
        step: stepName,
        status: 'completed',
        details: {
          stepTimeMs: timeMs,
          correlationId: context.correlationId,
        },
        processingTimeMs: timeMs,
        correlationId: context.correlationId,
      });

      return {
        step: stepName,
        status: 'completed',
        timeMs,
        details: { result },
      };

    } catch (error) {
      const timeMs = Date.now() - stepStart;

      await errorHandler.handleProcessingError(error as Error, {
        orgId: context.orgId,
        emailId: context.emailId,
        step: stepName,
        metadata: {
          stepTimeMs: timeMs,
          correlationId: context.correlationId,
        },
      });

      return {
        step: stepName,
        status: 'failed',
        timeMs,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Validate input parameters
   */
  private async validateInput(
    emailId: string,
    orgId: string,
    emailContent: string
  ): Promise<void> {
    if (!emailId || !orgId || !emailContent) {
      throw new Error('Missing required parameters: emailId, orgId, or emailContent');
    }

    if (emailContent.length < 10) {
      throw new Error('Email content too short to process');
    }

    if (emailContent.length > 100000) { // 100KB limit
      throw new Error('Email content too large to process');
    }

    // Validate that email exists and belongs to org
    const { data: email, error } = await this.supabase
      .from('emails')
      .select('id, org_id')
      .eq('id', emailId)
      .eq('org_id', orgId)
      .single();

    if (error || !email) {
      throw new Error('Email not found or access denied');
    }
  }

  /**
   * Parse email content from raw MIME format
   */
  private async parseEmailContent(emailContent: string): Promise<ParsedEmail> {
    // If emailContent is already parsed text, create a minimal ParsedEmail structure
    if (!emailContent.includes('Content-Type:') && !emailContent.includes('MIME-Version:')) {
      return {
        messageId: `processed-${Date.now()}`,
        from: 'unknown@example.com',
        to: 'recipient@example.com',
        subject: 'Processed Email',
        text: emailContent,
        html: '',
        attachments: [],
        headers: {},
      };
    }

    // Parse actual MIME content
    return await parseEmail(emailContent);
  }

  /**
   * Combine email content with attachment texts for AI processing
   */
  private combineEmailContent(
    processedEmail: ParsedEmail,
    attachmentTexts: string[]
  ): string {
    let combinedContent = processedEmail.text || '';

    // Add HTML content if text is minimal
    if (combinedContent.length < 100 && processedEmail.html) {
      // Basic HTML to text conversion
      const htmlText = processedEmail.html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      
      combinedContent += '\n\n' + htmlText;
    }

    // Add attachment texts
    if (attachmentTexts.length > 0) {
      combinedContent += '\n\n--- ATTACHMENT CONTENT ---\n\n';
      combinedContent += attachmentTexts.join('\n\n--- NEXT ATTACHMENT ---\n\n');
    }

    return combinedContent.trim();
  }

  /**
   * Create transaction from AI processing result with security context
   */
  private async createTransactionFromResult(
    emailId: string,
    orgId: string,
    processingResult: any,
    userId?: string,
    securityContext?: {
      securityFlags: any[];
      sanitizationActions: any[];
      forwardedChain?: any;
    }
  ): Promise<Transaction> {
    const transaction = await transactionProcessor.processEmailToTransaction(
      emailId,
      orgId,
      processingResult.translationResult.originalText,
      userId
    );

    // Add security context to transaction notes if there are security concerns
    if (securityContext && securityContext.securityFlags.length > 0) {
      const securityNotes = securityContext.securityFlags
        .filter(flag => flag.severity === 'high' || flag.severity === 'medium')
        .map(flag => `[SECURITY] ${flag.description}`)
        .join('; ');

      if (securityNotes) {
        transaction.notes = transaction.notes 
          ? `${transaction.notes}\n\n${securityNotes}`
          : securityNotes;
      }
    }

    // Add forwarded chain information if present
    if (securityContext?.forwardedChain) {
      const chainInfo = `[FORWARDED] Original sender: ${securityContext.forwardedChain.originalSender}, Chain depth: ${securityContext.forwardedChain.chainDepth}`;
      transaction.notes = transaction.notes 
        ? `${transaction.notes}\n\n${chainInfo}`
        : chainInfo;
    }

    return transaction;
  }

  /**
   * Log AI usage for cost tracking
   */
  private async logAIUsage(
    orgId: string,
    emailId: string,
    processingResult: any,
    correlationId: string
  ): Promise<void> {
    try {
      // Log language detection usage
      await loggingService.logAIUsage({
        orgId,
        emailId,
        serviceType: 'language_detection',
        modelName: 'gpt-4o-mini',
        inputTokens: Math.ceil(processingResult.translationResult.originalText.length / 4),
        outputTokens: 10, // Estimated for language detection
        costUsd: 0.001, // Estimated cost
        processingTimeMs: Math.floor(processingResult.processingTimeMs * 0.2),
        success: true,
      });

      // Log translation usage if text was translated
      if (processingResult.translationResult.sourceLanguage.toLowerCase() !== 'english') {
        await loggingService.logAIUsage({
          orgId,
          emailId,
          serviceType: 'translation',
          modelName: 'gpt-4o-mini',
          inputTokens: Math.ceil(processingResult.translationResult.originalText.length / 4),
          outputTokens: Math.ceil(processingResult.translationResult.translatedText.length / 4),
          costUsd: 0.005, // Estimated cost
          processingTimeMs: Math.floor(processingResult.processingTimeMs * 0.3),
          success: true,
        });
      }

      // Log data extraction usage
      await loggingService.logAIUsage({
        orgId,
        emailId,
        serviceType: 'data_extraction',
        modelName: 'gpt-4o-mini',
        inputTokens: Math.ceil(processingResult.translationResult.translatedText.length / 4),
        outputTokens: Math.ceil(JSON.stringify(processingResult.receiptData).length / 4),
        costUsd: 0.008, // Estimated cost
        processingTimeMs: Math.floor(processingResult.processingTimeMs * 0.5),
        success: true,
      });

    } catch (error) {
      console.error('Failed to log AI usage:', error);
    }
  }

  /**
   * Send processing completion notifications with security alerts
   */
  private async sendProcessingNotifications(
    userId: string | undefined,
    orgId: string,
    emailId: string,
    transaction: Transaction,
    processingResult: any,
    securityFlags: any[] = []
  ): Promise<void> {
    if (!userId) return;

    try {
      // Send standard processing notification
      await notificationService.notifyProcessingComplete(
        userId,
        orgId,
        emailId,
        transaction.id,
        {
          processingTimeMs: processingResult.processingTimeMs,
          confidence: transaction.confidence,
          wasTranslated: processingResult.translationResult.sourceLanguage.toLowerCase() !== 'english',
          securityFlagsCount: securityFlags.length,
        }
      );

      // Send security alerts for high-severity flags
      const highSeverityFlags = securityFlags.filter(flag => flag.severity === 'high');
      if (highSeverityFlags.length > 0) {
        await notificationService.notifySecurityAlert(
          userId,
          orgId,
          emailId,
          transaction.id,
          {
            flagCount: highSeverityFlags.length,
            flags: highSeverityFlags.map(flag => ({
              type: flag.type,
              description: flag.description,
            })),
          }
        );
      }
    } catch (error) {
      console.error('Failed to send processing notifications:', error);
    }
  }

  /**
   * Get processing statistics for monitoring
   */
  async getProcessingStatistics(
    orgId: string,
    hoursBack = 24
  ): Promise<{
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    errorBreakdown: Array<{ errorType: string; count: number }>;
    costBreakdown: Array<{ serviceType: string; totalCost: number }>;
  }> {
    try {
      // Get error statistics
      const errorStats = await loggingService.getErrorStatistics(orgId, hoursBack);
      
      // Get AI usage costs
      const costStats = await loggingService.getAIUsageCosts(orgId, Math.ceil(hoursBack / 24));

      // Calculate basic statistics from processing logs
      const { data: processedEmails, error } = await this.supabase
        .from('processing_logs')
        .select('status, processing_time_ms')
        .eq('org_id', orgId)
        .eq('step', 'email_processing_complete')
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Failed to get processing statistics:', error);
        return {
          totalProcessed: 0,
          successRate: 0,
          averageProcessingTime: 0,
          errorBreakdown: [],
          costBreakdown: [],
        };
      }

      const totalProcessed = processedEmails?.length || 0;
      const successfulProcessed = processedEmails?.filter(e => e.status === 'completed').length || 0;
      const successRate = totalProcessed > 0 ? (successfulProcessed / totalProcessed) * 100 : 0;
      const averageProcessingTime = totalProcessed > 0 
        ? (processedEmails?.reduce((sum, e) => sum + (e.processing_time_ms || 0), 0) || 0) / totalProcessed 
        : 0;

      return {
        totalProcessed,
        successRate,
        averageProcessingTime,
        errorBreakdown: errorStats.map(stat => ({
          errorType: stat.errorType,
          count: stat.errorCount,
        })),
        costBreakdown: costStats.map(cost => ({
          serviceType: cost.serviceType,
          totalCost: cost.totalCostUsd,
        })),
      };

    } catch (error) {
      console.error('Error getting processing statistics:', error);
      return {
        totalProcessed: 0,
        successRate: 0,
        averageProcessingTime: 0,
        errorBreakdown: [],
        costBreakdown: [],
      };
    }
  }
}

// Export singleton instance
export const enhancedEmailProcessor = new EnhancedEmailProcessor();