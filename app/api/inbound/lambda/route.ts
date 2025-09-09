import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/server';
import { errorHandler } from '@/lib/services/error-handler';
import { loggingService } from '@/lib/services/logging-service';
import { correlationService } from '@/lib/services/correlation-service';
import { idempotencyService } from '@/lib/services/idempotency-service';
import { providerPerformanceService } from '@/lib/services/provider-performance-service';
import { createSESAdapter } from '@/lib/inbound/providers/ses-adapter';
import { 
  InboundEmailPayload,
  ProviderError,
  ProviderVerificationError,
  ProviderParsingError,
  SESLambdaPayloadSchema,
  generateCorrelationId,
  extractOrgSlugFromAlias,
} from '@/lib/inbound/types';
import { 
  normalizeAlias,
  verifyIdempotency,
  enqueueProcessJob
} from '@/lib/inbound/utils';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let correlationContext: any;
  let orgId: string | undefined;
  let emailId: string | undefined;
  let sesAdapter: any;
  
  try {
    // Create SES adapter for Lambda endpoint processing
    sesAdapter = createSESAdapter({
      sharedSecret: config.inboundProvider.sharedSecret,
      verifySignature: true,
      timeoutMs: 30000,
    });
    
    // Parse payload first to get basic info for correlation context with performance tracking
    const parseStartTime = Date.now();
    const emailPayload = await errorHandler.executeWithRetry(
      () => sesAdapter.parse(request),
      {
        orgId: '',
        operationName: 'ses_lambda_parsing',
        step: 'ses_lambda_parsing',
        metadata: { 
          provider: 'ses-lambda',
        },
      }
    );
    const parseLatency = Date.now() - parseStartTime;

    // Create correlation context
    correlationContext = correlationService.createCorrelationContext(
      '', // Will be updated when we find the org
      emailPayload.messageId,
      'ses',
      emailPayload.alias,
      emailPayload.rawRef
    );

    // Start provider selection step
    await correlationService.startStep(
      correlationContext.correlationId,
      'provider_selected',
      { provider: 'ses-lambda' }
    );
    
    await correlationService.completeStep(
      correlationContext.correlationId,
      'provider_selected',
      { provider: 'ses-lambda' }
    );
    
    // Start verification step
    await correlationService.startStep(
      correlationContext.correlationId,
      'ses_lambda_verification',
      { provider: 'ses-lambda' }
    );

    // Verify request authenticity using SESAdapter with performance tracking
    const verificationStartTime = Date.now();
    const isValidRequest = await errorHandler.executeWithRetry(
      () => sesAdapter.verify(request),
      {
        orgId: '',
        operationName: 'ses_lambda_verification',
        step: 'ses_lambda_verification',
        metadata: { 
          provider: 'ses-lambda',
          correlationId: correlationContext.correlationId
        },
      }
    );
    const verificationLatency = Date.now() - verificationStartTime;
    
    if (!isValidRequest) {
      // Log provider performance metrics for failed verification
      await providerPerformanceService.logProviderMetrics({
        orgId: '',
        provider: 'ses',
        operation: 'verify',
        latencyMs: verificationLatency,
        success: false,
        errorType: 'invalid_shared_secret',
        errorMessage: 'Shared secret verification failed',
        correlationId: correlationContext.correlationId,
        metadata: {
          endpoint: 'lambda',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });

      await correlationService.failStep(
        correlationContext.correlationId,
        'ses_lambda_verification',
        new Error('Invalid shared secret')
      );

      // Log security event
      await loggingService.logSecurityEvent(
        'ses_lambda_verification_failed',
        'high',
        {
          description: 'SES Lambda verification failed - invalid shared secret',
          metadata: {
            provider: 'ses-lambda',
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            correlationId: correlationContext.correlationId,
            verificationLatency,
          },
        }
      );
      
      return NextResponse.json(
        { error: 'Invalid request signature' },
        { status: 401 }
      );
    }

    // Log successful verification performance
    await providerPerformanceService.logProviderMetrics({
      orgId: '',
      provider: 'ses',
      operation: 'verify',
      latencyMs: verificationLatency,
      success: true,
      correlationId: correlationContext.correlationId,
      metadata: {
        endpoint: 'lambda',
      },
    });

    await correlationService.completeStep(
      correlationContext.correlationId,
      'ses_lambda_verification'
    );

    // Start alias validation step
    await correlationService.startStep(
      correlationContext.correlationId,
      'alias_validation',
      { alias: emailPayload.alias }
    );

    // Normalize and validate alias
    const normalizedAlias = normalizeAlias(emailPayload.alias);
    const orgSlug = extractOrgSlugFromAlias(normalizedAlias);
    
    // Find organization by inbox alias
    const supabase = createServiceClient();
    const { data: aliasData, error: aliasError } = await supabase
      .from('inbox_aliases')
      .select('org_id, is_active')
      .eq('alias_email', normalizedAlias)
      .eq('is_active', true)
      .single();
    
    if (aliasError || !aliasData) {
      await correlationService.failStep(
        correlationContext.correlationId,
        'alias_validation',
        new Error(`Invalid or inactive alias: ${normalizedAlias}`)
      );

      await loggingService.logSecurityEvent(
        'invalid_recipient_lambda',
        'medium',
        {
          description: 'Lambda email sent to invalid or inactive inbox alias',
          metadata: {
            alias: normalizedAlias,
            orgSlug,
            sender: emailPayload.from,
            messageId: emailPayload.messageId,
            provider: 'ses-lambda',
            error: aliasError?.message,
            correlationId: correlationContext.correlationId,
          },
        }
      );
      
      return NextResponse.json(
        { error: 'Invalid recipient' },
        { status: 404 }
      );
    }
    
    orgId = (aliasData as any).org_id;
    
    // Update correlation context with org ID
    correlationContext.orgId = orgId;

    // Log successful parsing performance now that we have orgId
    await providerPerformanceService.logProviderMetrics({
      orgId,
      provider: 'ses',
      operation: 'parse',
      latencyMs: parseLatency,
      success: true,
      correlationId: correlationContext.correlationId,
      metadata: {
        endpoint: 'lambda',
        hasText: !!emailPayload.text,
        hasHtml: !!emailPayload.html,
        attachmentCount: emailPayload.attachments?.length || 0,
      },
    });
    
    await correlationService.completeStep(
      correlationContext.correlationId,
      'alias_validation',
      { orgId, orgSlug }
    );
    
    // Start idempotency check step
    await correlationService.startStep(
      correlationContext.correlationId,
      'idempotency_check',
      { messageId: emailPayload.messageId }
    );

    // Check idempotency using the new idempotency service
    const idempotencyResult = await idempotencyService.checkIdempotency(
      orgId,
      normalizedAlias,
      emailPayload.messageId,
      'ses',
      emailPayload.rawRef,
      correlationContext.correlationId
    );
    
    if (idempotencyResult.isDuplicate) {
      await correlationService.completeStep(
        correlationContext.correlationId,
        'idempotency_check',
        { 
          isDuplicate: true,
          existingEmailId: idempotencyResult.existingRecord?.emailId,
          reason: idempotencyResult.reason
        },
        idempotencyResult.existingRecord?.emailId
      );

      // Complete correlation as duplicate
      await correlationService.completeCorrelation(
        correlationContext.correlationId,
        true,
        { reason: 'duplicate_email', existingEmailId: idempotencyResult.existingRecord?.emailId }
      );
      
      return NextResponse.json({
        success: true,
        message: 'Email already processed',
        emailId: idempotencyResult.existingRecord?.emailId,
        correlationId: correlationContext.correlationId,
      });
    }

    await correlationService.completeStep(
      correlationContext.correlationId,
      'idempotency_check',
      { isDuplicate: false, reason: idempotencyResult.reason }
    );

    // Link correlation with idempotency record if one was created
    if (idempotencyResult.existingRecord) {
      await correlationService.linkWithIdempotencyRecord(
        correlationContext.correlationId,
        idempotencyResult.existingRecord.id
      );
    }
    
    // Start rate limit check step
    await correlationService.startStep(
      correlationContext.correlationId,
      'rate_limit_check',
      { endpoint: 'inbound_email_lambda' }
    );

    // Check rate limits
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      org_uuid: orgId,
      endpoint_name: 'inbound_email',
      max_requests: config.rateLimit.perOrgPerHour,
      window_minutes: config.rateLimit.windowMinutes,
    } as any);
    
    if (!rateLimitOk) {
      const rateLimitError = new Error('Rate limit exceeded for organization');
      
      await correlationService.failStep(
        correlationContext.correlationId,
        'rate_limit_check',
        rateLimitError
      );

      await errorHandler.handleProcessingError(rateLimitError, {
        orgId,
        step: 'rate_limit_check_lambda',
        metadata: {
          endpoint: 'inbound_email_lambda',
          provider: 'ses-lambda',
          correlationId: correlationContext.correlationId,
        },
      });
      
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    await correlationService.completeStep(
      correlationContext.correlationId,
      'rate_limit_check',
      { rateLimitOk: true }
    );
    
    // Start email processing enqueue step
    await correlationService.startStep(
      correlationContext.correlationId,
      'email_processing_enqueue',
      { provider: 'ses-lambda', rawRef: emailPayload.rawRef }
    );

    // Enqueue processing job using SESAdapter-processed payload
    const processingResult = await errorHandler.executeWithRetry(
      () => enqueueProcessJob(emailPayload, orgId!, correlationContext.correlationId),
      {
        orgId: orgId!,
        operationName: 'lambda_email_processing_enqueue',
        step: 'lambda_email_processing_enqueue',
        metadata: { 
          provider: 'ses-lambda',
          correlationId: correlationContext.correlationId,
          rawRef: emailPayload.rawRef,
        },
      }
    );
    
    emailId = processingResult.emailId;

    // Link correlation with email record
    await correlationService.linkWithEmailRecord(
      correlationContext.correlationId,
      emailId
    );

    await correlationService.completeStep(
      correlationContext.correlationId,
      'email_processing_enqueue',
      {
        emailId,
        queued: processingResult.queued,
        processingTimeMs: Date.now() - startTime,
      },
      emailId
    );
    
    // Complete correlation successfully
    const correlationSummary = await correlationService.completeCorrelation(
      correlationContext.correlationId,
      true,
      {
        emailId,
        messageId: emailPayload.messageId,
        rawRef: emailPayload.rawRef,
        provider: 'ses-lambda',
      }
    );

    // Log overall processing performance
    await providerPerformanceService.logProviderMetrics({
      orgId,
      provider: 'ses',
      operation: 'process',
      latencyMs: correlationSummary.totalProcessingTime,
      success: true,
      correlationId: correlationContext.correlationId,
      metadata: {
        endpoint: 'lambda',
        emailId,
        messageId: emailPayload.messageId,
        rawRef: emailPayload.rawRef,
        stepsCompleted: correlationSummary.stepsCompleted,
      },
    });

    console.log('Email processed via SES Lambda', {
      emailId,
      orgId,
      messageId: emailPayload.messageId,
      rawRef: emailPayload.rawRef,
      provider: 'ses-lambda',
      correlationId: correlationContext.correlationId,
      totalProcessingTime: correlationSummary.totalProcessingTime,
      stepsCompleted: correlationSummary.stepsCompleted,
    });
    
    return NextResponse.json({
      success: true,
      emailId,
      message: 'Email received from SES Lambda and queued for processing',
      provider: 'ses-lambda',
      correlationId: correlationContext.correlationId,
      processingTimeMs: correlationSummary.totalProcessingTime,
    });
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const providerName = sesAdapter?.getName() || 'ses-lambda';
    const correlationId = correlationContext?.correlationId || 'unknown';
    
    // Complete correlation with failure if context exists
    if (correlationContext) {
      try {
        await correlationService.completeCorrelation(
          correlationContext.correlationId,
          false,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTimeMs,
            provider: providerName,
          }
        );

        // Log failed processing performance
        if (orgId) {
          await providerPerformanceService.logProviderMetrics({
            orgId,
            provider: 'ses',
            operation: 'process',
            latencyMs: processingTimeMs,
            success: false,
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            correlationId: correlationContext.correlationId,
            metadata: {
              endpoint: 'lambda',
              provider: providerName,
            },
          });
        }
      } catch (correlationError) {
        console.error('Failed to complete correlation on error:', correlationError);
      }
    }
    
    // Handle provider-specific errors
    if (error instanceof ProviderVerificationError) {
      await loggingService.logSecurityEvent(
        'ses_lambda_verification_error',
        'high',
        {
          description: `SES Lambda verification error: ${error.message}`,
          metadata: {
            provider: error.provider,
            code: error.code,
            details: error.details,
            correlationId,
          },
        }
      );
      
      return NextResponse.json(
        { 
          error: 'Request verification failed',
          correlationId,
        },
        { status: 401 }
      );
    }
    
    if (error instanceof ProviderParsingError) {
      await loggingService.logProcessingStep({
        orgId: orgId || '',
        emailId: emailId || '',
        step: 'ses_lambda_parsing_error',
        status: 'failed',
        details: {
          provider: error.provider,
          code: error.code,
          details: error.details,
          correlationId,
        },
        errorMessage: error.message,
        correlationId,
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid email format',
          correlationId,
        },
        { status: 400 }
      );
    }
    
    if (error instanceof ProviderError) {
      await errorHandler.handleProcessingError(error, {
        orgId: orgId || '',
        emailId: emailId || '',
        step: 'ses_lambda_provider_error',
        metadata: {
          provider: error.provider,
          code: error.code,
          details: error.details,
          processingTimeMs,
          correlationId,
        },
      });
      
      return NextResponse.json(
        { 
          error: 'Provider processing error',
          correlationId,
        },
        { status: 500 }
      );
    }
    
    // Handle general errors with comprehensive logging
    if (orgId) {
      await errorHandler.handleProcessingError(error as Error, {
        orgId,
        emailId,
        step: 'ses_lambda_webhook_processing',
        metadata: {
          provider: providerName,
          processingTimeMs,
          correlationId,
        },
      });
    } else {
      console.error('SES Lambda email webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        provider: providerName,
        processingTimeMs,
        correlationId,
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        correlationId,
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}