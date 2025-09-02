import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/server';
import { errorHandler } from '@/lib/services/error-handler';
import { loggingService } from '@/lib/services/logging-service';
import { enhancedEmailProcessor } from '@/lib/services/enhanced-email-processor';
import { 
  ProviderFactory, 
  getDefaultProvider 
} from '@/lib/inbound/provider-factory';
import { 
  InboundEmailPayload,
  ProviderError,
  ProviderVerificationError,
  ProviderParsingError,
  generateCorrelationId,
  extractOrgSlugFromAlias,
  createProcessingContext
} from '@/lib/inbound/types';
import { 
  normalizeAlias,
  verifyIdempotency,
  enqueueProcessJob
} from '@/lib/inbound/utils';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  let orgId: string | undefined;
  let emailId: string | undefined;
  let provider: any;
  
  try {
    // Get the configured provider
    provider = getDefaultProvider();
    const providerName = provider.getName();
    
    // Log provider selection
    await loggingService.logProcessingStep({
      orgId: '',
      emailId: '',
      step: 'provider_selected',
      status: 'completed',
      details: {
        provider: providerName,
        correlationId,
      },
      correlationId,
    });
    
    // Verify request authenticity using provider
    const isValidRequest = await errorHandler.executeWithRetry(
      () => provider.verify(request),
      {
        orgId: '',
        operationName: 'provider_verification',
        step: 'provider_verification',
        metadata: { 
          provider: providerName,
          correlationId 
        },
      }
    );
    
    if (!isValidRequest) {
      // Log security event
      await loggingService.logSecurityEvent(
        'provider_verification_failed',
        'high',
        {
          description: `Provider verification failed for ${providerName}`,
          metadata: {
            provider: providerName,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            correlationId,
          },
        }
      );
      
      return NextResponse.json(
        { error: 'Invalid request signature' },
        { status: 401 }
      );
    }
    
    // Parse email payload using provider
    const emailPayload = await errorHandler.executeWithRetry(
      () => provider.parse(request),
      {
        orgId: '',
        operationName: 'provider_parsing',
        step: 'provider_parsing',
        metadata: { 
          provider: providerName,
          correlationId 
        },
      }
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
      // Log security event for invalid recipient
      await loggingService.logSecurityEvent(
        'invalid_recipient',
        'medium',
        {
          description: 'Email sent to invalid or inactive inbox alias',
          metadata: {
            alias: normalizedAlias,
            orgSlug,
            sender: emailPayload.from,
            messageId: emailPayload.messageId,
            provider: providerName,
            error: aliasError?.message,
            correlationId,
          },
        }
      );
      
      return NextResponse.json(
        { error: 'Invalid recipient' },
        { status: 404 }
      );
    }
    
    orgId = (aliasData as any).org_id;
    
    // Log email reception with provider context
    await loggingService.logProcessingStep({
      orgId,
      emailId: '',
      step: 'email_received_via_provider',
      status: 'completed',
      details: {
        messageId: emailPayload.messageId,
        sender: emailPayload.from,
        recipient: emailPayload.to,
        subject: emailPayload.subject,
        provider: providerName,
        orgSlug,
        correlationId,
      },
      correlationId,
    });
    
    // Check idempotency to prevent duplicate processing
    const idempotencyCheck = await verifyIdempotency(
      emailPayload.messageId,
      orgId,
      supabase
    );
    
    if (idempotencyCheck.isDuplicate) {
      // Log duplicate detection
      await loggingService.logProcessingStep({
        orgId,
        emailId: idempotencyCheck.existingEmailId || '',
        step: 'duplicate_email_detected',
        status: 'completed',
        details: {
          messageId: emailPayload.messageId,
          existingEmailId: idempotencyCheck.existingEmailId,
          provider: providerName,
          correlationId,
        },
        correlationId,
      });
      
      return NextResponse.json({
        success: true,
        message: 'Email already processed',
        emailId: idempotencyCheck.existingEmailId,
        correlationId,
      });
    }
    
    // Check rate limits with enhanced logging
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      org_uuid: orgId,
      endpoint_name: 'inbound_email',
      max_requests: config.rateLimit.perOrgPerHour,
      window_minutes: config.rateLimit.windowMinutes,
    } as any);
    
    if (!rateLimitOk) {
      // Handle rate limit with comprehensive error handling
      const rateLimitError = new Error('Rate limit exceeded for organization');
      await errorHandler.handleProcessingError(rateLimitError, {
        orgId,
        step: 'rate_limit_check',
        metadata: {
          endpoint: 'inbound_email',
          provider: providerName,
          correlationId,
        },
      });
      
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    // Enqueue processing job using unified pipeline
    const processingResult = await errorHandler.executeWithRetry(
      () => enqueueProcessJob(emailPayload, orgId!, correlationId),
      {
        orgId: orgId!,
        operationName: 'email_processing_enqueue',
        step: 'email_processing_enqueue',
        metadata: { 
          provider: providerName,
          correlationId 
        },
      }
    );
    
    emailId = processingResult.emailId;
    
    // Log successful processing enqueue
    await loggingService.logProcessingStep({
      orgId,
      emailId,
      step: 'email_processing_enqueued',
      status: 'completed',
      details: {
        messageId: emailPayload.messageId,
        sender: emailPayload.from,
        subject: emailPayload.subject,
        provider: providerName,
        processingTimeMs: Date.now() - startTime,
        correlationId,
      },
      processingTimeMs: Date.now() - startTime,
      correlationId,
    });
    
    console.log('Email processed via provider abstraction', {
      emailId,
      orgId,
      messageId: emailPayload.messageId,
      provider: providerName,
      processingTimeMs: Date.now() - startTime,
      correlationId,
    });
    
    return NextResponse.json({
      success: true,
      emailId,
      message: 'Email received and queued for processing',
      provider: providerName,
      correlationId,
    });
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const providerName = provider?.getName() || 'unknown';
    
    // Handle provider-specific errors
    if (error instanceof ProviderVerificationError) {
      await loggingService.logSecurityEvent(
        'provider_verification_error',
        'high',
        {
          description: `Provider verification error: ${error.message}`,
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
        step: 'provider_parsing_error',
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
        step: 'provider_error',
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
        step: 'email_webhook_processing',
        metadata: {
          provider: providerName,
          processingTimeMs,
          correlationId,
        },
      });
    } else {
      // Log error without org context
      console.error('Email webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        provider: providerName,
        processingTimeMs,
        correlationId,
      });
    }
    
    // For other errors, return generic error to avoid leaking information
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