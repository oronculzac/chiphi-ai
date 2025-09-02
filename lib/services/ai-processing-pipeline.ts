import { languageNormalizer, type TranslationResult } from './ai-language-normalizer';
import { dataExtractor, type ReceiptData } from './ai-data-extractor';
import { merchantMapService } from './merchant-map';
import { errorHandler } from './error-handler';
import { loggingService } from './logging-service';
import { retryService } from './retry-service';
import { performanceMonitor, measureAsync } from './performance-monitor';

export interface ProcessingResult {
  receiptData: ReceiptData;
  translationResult: TranslationResult;
  processingTimeMs: number;
  appliedMapping?: boolean;
}

export interface ProcessingError {
  stage: 'language_detection' | 'translation' | 'data_extraction';
  error: string;
  originalText: string;
  partialResult?: Partial<ProcessingResult>;
}

export class AIProcessingPipeline {
  /**
   * Process receipt text through the complete AI pipeline
   * This orchestrates language detection, translation, data extraction, and merchant mapping
   * 
   * Requirements covered:
   * - 2.1: Language detection
   * - 2.2: Translation to English
   * - 2.3: Preserve original and translated versions
   * - 3.1-3.5: Structured data extraction with confidence and explanation
   * - 4.3: Apply learned mappings to new receipts
   * - 10.1: Log all processing steps with timestamps
   * - 10.2: Create retry mechanisms for transient AI service failures
   */
  async processReceiptText(
    originalText: string, 
    orgId?: string, 
    emailId?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const correlationId = loggingService.generateCorrelationId();

    if (!originalText.trim()) {
      throw new Error('Receipt text cannot be empty');
    }

    try {
      // Log processing start
      if (orgId) {
        await loggingService.logProcessingStep({
          orgId,
          emailId: emailId || '',
          step: 'ai_processing_pipeline',
          status: 'started',
          details: {
            textLength: originalText.length,
            correlationId,
          },
          correlationId,
        });
      }

      // Step 1: Language normalization with retry logic and performance monitoring
      console.log('Starting language normalization...');
      const translationResult = await measureAsync(
        () => retryService.executeWithRetry(
          () => languageNormalizer.normalizeText(originalText),
          {
            orgId: orgId || 'unknown',
            emailId,
            operationName: 'language_normalization',
            step: 'language_normalization',
            correlationId,
          },
          'ai_service'
        ),
        (duration, result, error) => {
          performanceMonitor.recordAIMetrics({
            service: 'openai',
            operation: 'language_normalization',
            responseTime: duration,
            success: !error,
            error: error?.message
          }, orgId);
        }
      );

      if (!translationResult.success || !translationResult.result) {
        throw translationResult.error || new Error('Language normalization failed');
      }

      const translation = translationResult.result;
      
      // Step 2: Data extraction with retry logic and performance monitoring
      console.log('Starting data extraction...');
      const extractionResult = await measureAsync(
        () => retryService.executeWithRetry(
          () => dataExtractor.extractReceiptDataWithRetry(translation.translatedText),
          {
            orgId: orgId || 'unknown',
            emailId,
            operationName: 'data_extraction',
            step: 'data_extraction',
            correlationId,
          },
          'ai_service'
        ),
        (duration, result, error) => {
          performanceMonitor.recordAIMetrics({
            service: 'openai',
            operation: 'data_extraction',
            responseTime: duration,
            success: !error,
            error: error?.message
          }, orgId);
        }
      );

      if (!extractionResult.success || !extractionResult.result) {
        throw extractionResult.error || new Error('Data extraction failed');
      }

      let receiptData = extractionResult.result;

      // Step 3: Apply merchant mapping if organization ID is provided
      let appliedMapping = false;
      if (orgId) {
        console.log('Applying merchant mapping...');
        try {
          const originalReceiptData = { ...receiptData };
          receiptData = await measureAsync(
            () => merchantMapService.applyMapping(receiptData, orgId),
            (duration, result, error) => {
              performanceMonitor.recordDatabaseMetrics({
                query: 'merchant_map_lookup',
                executionTime: duration,
                rowsAffected: 1,
                success: !error,
                error: error?.message
              }, orgId);
            }
          );
          appliedMapping = receiptData.category !== originalReceiptData.category || 
                          receiptData.subcategory !== originalReceiptData.subcategory;
          
          if (appliedMapping) {
            await loggingService.logProcessingStep({
              orgId,
              emailId: emailId || '',
              step: 'merchant_mapping_applied',
              status: 'completed',
              details: {
                merchant: receiptData.merchant,
                originalCategory: originalReceiptData.category,
                mappedCategory: receiptData.category,
                correlationId,
              },
              correlationId,
            });
          }
        } catch (mappingError) {
          // Log mapping error but don't fail the entire process
          await errorHandler.handleProcessingError(mappingError as Error, {
            orgId,
            emailId,
            step: 'merchant_mapping',
            metadata: { correlationId },
          });
          console.warn('Merchant mapping failed, continuing with AI categorization:', mappingError);
        }
      }

      const processingTimeMs = Date.now() - startTime;

      // Log successful completion
      if (orgId) {
        await loggingService.logProcessingStep({
          orgId,
          emailId: emailId || '',
          step: 'ai_processing_pipeline',
          status: 'completed',
          details: {
            processingTimeMs,
            appliedMapping,
            confidence: receiptData.confidence,
            wasTranslated: translation.sourceLanguage.toLowerCase() !== 'english',
            correlationId,
          },
          processingTimeMs,
          correlationId,
        });

        // Record performance metrics
        await loggingService.recordPerformanceMetric({
          orgId,
          metricType: 'processing_time',
          metricValue: processingTimeMs,
          metricUnit: 'ms',
          context: {
            step: 'ai_processing_pipeline',
            confidence: receiptData.confidence,
            appliedMapping,
            correlationId,
          },
        });
      }

      console.log(`AI processing completed in ${processingTimeMs}ms${appliedMapping ? ' (with mapping applied)' : ''}`);

      return {
        receiptData,
        translationResult: translation,
        processingTimeMs,
        appliedMapping
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      
      // Handle error with comprehensive logging
      const processingError = orgId ? await errorHandler.handleProcessingError(error as Error, {
        orgId,
        emailId,
        step: 'ai_processing_pipeline',
        metadata: { 
          processingTimeMs,
          textLength: originalText.length,
          correlationId,
        },
      }) : {
        type: 'extraction_failed' as any,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { processingTimeMs },
        retryable: false,
      };

      console.error(`AI processing failed after ${processingTimeMs}ms:`, error);
      
      // Determine which stage failed based on the error
      let stage: ProcessingError['stage'] = 'language_detection';
      if (error instanceof Error) {
        if (error.message.includes('translation')) {
          stage = 'translation';
        } else if (error.message.includes('extraction')) {
          stage = 'data_extraction';
        }
      }

      const finalError: ProcessingError = {
        stage,
        error: processingError.message,
        originalText
      };

      throw finalError;
    }
  }

  /**
   * Process receipt text with enhanced error handling and partial results
   * This version attempts to return partial results even if some stages fail
   */
  async processReceiptTextRobust(originalText: string, orgId?: string): Promise<ProcessingResult | ProcessingError> {
    const startTime = Date.now();

    if (!originalText.trim()) {
      throw new Error('Receipt text cannot be empty');
    }

    let translationResult: TranslationResult | null = null;
    let receiptData: ReceiptData | null = null;

    try {
      // Step 1: Language normalization
      console.log('Starting robust language normalization...');
      translationResult = await languageNormalizer.normalizeText(originalText);
      
      // Step 2: Data extraction
      console.log('Starting robust data extraction...');
      receiptData = await dataExtractor.extractReceiptDataWithRetry(
        translationResult.translatedText
      );

      // Step 3: Apply merchant mapping if organization ID is provided
      let appliedMapping = false;
      if (orgId && receiptData) {
        try {
          console.log('Applying merchant mapping...');
          const originalReceiptData = { ...receiptData };
          receiptData = await merchantMapService.applyMapping(receiptData, orgId);
          appliedMapping = receiptData.category !== originalReceiptData.category || 
                          receiptData.subcategory !== originalReceiptData.subcategory;
        } catch (mappingError) {
          console.warn('Merchant mapping failed, continuing with original data:', mappingError);
        }
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        receiptData,
        translationResult,
        processingTimeMs,
        appliedMapping
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      console.error(`Robust AI processing failed after ${processingTimeMs}ms:`, error);
      
      // Determine stage and create partial result
      let stage: ProcessingError['stage'] = 'language_detection';
      const partialResult: Partial<ProcessingResult> = {
        processingTimeMs
      };

      if (translationResult) {
        partialResult.translationResult = translationResult;
        stage = 'data_extraction';
      }

      if (error instanceof Error) {
        if (error.message.includes('translation')) {
          stage = 'translation';
        } else if (error.message.includes('extraction')) {
          stage = 'data_extraction';
        }
      }

      return {
        stage,
        error: error instanceof Error ? error.message : 'Unknown error',
        originalText,
        partialResult
      };
    }
  }

  /**
   * Validate processing result completeness
   */
  validateProcessingResult(result: ProcessingResult): boolean {
    try {
      // Check translation result
      if (!result.translationResult.translatedText || 
          !result.translationResult.originalText ||
          result.translationResult.confidence < 0) {
        return false;
      }

      // Check receipt data
      if (!result.receiptData.date ||
          result.receiptData.amount <= 0 ||
          !result.receiptData.currency ||
          !result.receiptData.merchant ||
          !result.receiptData.category ||
          result.receiptData.confidence < 0 ||
          result.receiptData.confidence > 100 ||
          !result.receiptData.explanation) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Processing result validation failed:', error);
      return false;
    }
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStats(result: ProcessingResult): {
    translationConfidence: number;
    extractionConfidence: number;
    processingTimeMs: number;
    wasTranslated: boolean;
    sourceLanguage: string;
  } {
    return {
      translationConfidence: result.translationResult.confidence,
      extractionConfidence: result.receiptData.confidence,
      processingTimeMs: result.processingTimeMs,
      wasTranslated: result.translationResult.sourceLanguage.toLowerCase() !== 'english',
      sourceLanguage: result.translationResult.sourceLanguage
    };
  }
}

// Export singleton instance
export const aiProcessingPipeline = new AIProcessingPipeline();