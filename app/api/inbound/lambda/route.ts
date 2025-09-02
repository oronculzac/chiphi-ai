import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/server';
import { errorHandler } from '@/lib/services/error-handler';
import { loggingService } from '@/lib/services/logging-service';
import { 
  generateCorrelationId,
  extractOrgSlugFromAlias,
} from '@/lib/inbound/types';
import { 
  normalizeAlias,
  verifyIdempotency,
  enqueueProcessJob
} from '@/lib/inbound/utils';

// Interface for Lambda-processed email payload
interface LambdaEmailPayload {
  alias: string;
  messageId: string;
  to: string;
  from: string;
  subject: string;
  text: string | null;
  html: string | null;
  rawRef: string; // S3 bucket/key reference
  receivedAt: string;
  attachments: Array<{
    name: string;
    contentType: string;
    size: number;
  }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  let orgId: string | undefined;
  let emailId: string | undefined;
  
  try {
    // Verify shared secret for Lambda authentication
    const sharedSecret = request.headers.get('x-shared-secret');
    if (!sharedSecret || sharedSecret !== process.env.SHARED_SECRET) {
      await loggingService.logSecurityEvent(
        'lambda_auth_failed',
        'high',
        {
          description: 'Lambda authentication failed - invalid shared secret',
          metadata: {
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            correlationId,
          },
        }
      );
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse Lambda payload
    const lambdaPayload: LambdaEmailPayload = await request.json();
    
    // Validate required fields
    if (!lambdaPayload.alias || !lambdaPayload.messageId || !lambdaPayload.from) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Normalize and validate alias
    const normalizedAlias = normalizeAlias(lambdaPayload.alias);
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
      await loggingService.logSecurityEvent(
        'invalid_recipient_lambda',
        'medium',
        {
          description: 'Lambda email sent to invalid or inactive inbox alias',
          metadata: {
            alias: normalizedAlias,
            orgSlug,
            sender: lambdaPayload.from,
            messageId: lambdaPayload.messageId,
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
    
    // Log email reception from Lambda
    await loggingService.logProcessingStep({
      orgId,
      emailId: '',
      step: 'email_received_via_lambda',
      status: 'completed',
      details: {
        messageId: lambdaPayload.messageId,
        sender: lambdaPayload.from,
        recipient: lambdaPayload.to,
        subject: lambdaPayload.subject,
        rawRef: lambdaPayload.rawRef,
        orgSlug,
        correlationId,
      },
      correlationId,
    });
    
    // Check idempotency to prevent duplicate processing
    const idempotencyCheck = await verifyIdempotency(
      lambdaPayload.messageId,
      orgId,
      supabase
    );
    
    if (idempotencyCheck.isDuplicate) {
      await loggingService.logProcessingStep({
        orgId,
        emailId: idempotencyCheck.existingEmailId || '',
        step: 'duplicate_email_detected_lambda',
        status: 'completed',
        details: {
          messageId: lambdaPayload.messageId,
          existingEmailId: idempotencyCheck.existingEmailId,
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
    
    // Check rate limits
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      org_uuid: orgId,
      endpoint_name: 'inbound_email',
      max_requests: config.rateLimit.perOrgPerHour,
      window_minutes: config.rateLimit.windowMinutes,
    } as any);
    
    if (!rateLimitOk) {
      const rateLimitError = new Error('Rate limit exceeded for organization');
      await errorHandler.handleProcessingError(rateLimitError, {
        orgId,
        step: 'rate_limit_check_lambda',
        metadata: {
          endpoint: 'inbound_email_lambda',
          correlationId,
        },
      });
      
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    // Convert Lambda payload to standard InboundEmailPayload format
    const emailPayload = {
      alias: normalizedAlias,
      messageId: lambdaPayload.messageId,
      from: lambdaPayload.from,
      to: lambdaPayload.to,
      subject: lambdaPayload.subject,
      text: lambdaPayload.text || undefined,
      html: lambdaPayload.html || undefined,
      attachments: lambdaPayload.attachments.length > 0 ? lambdaPayload.attachments : undefined,
      receivedAt: new Date(lambdaPayload.receivedAt),
      metadata: {
        provider: 'lambda-ses',
        correlationId,
        rawRef: lambdaPayload.rawRef,
        processedByLambda: true,
        lambdaProcessedAt: new Date().toISOString(),
      },
    };
    
    // Enqueue processing job
    const processingResult = await errorHandler.executeWithRetry(
      () => enqueueProcessJob(emailPayload, orgId!, correlationId),
      {
        orgId: orgId!,
        operationName: 'lambda_email_processing_enqueue',
        step: 'lambda_email_processing_enqueue',
        metadata: { 
          correlationId,
          rawRef: lambdaPayload.rawRef,
        },
      }
    );
    
    emailId = processingResult.emailId;
    
    // Log successful processing enqueue
    await loggingService.logProcessingStep({
      orgId,
      emailId,
      step: 'lambda_email_processing_enqueued',
      status: 'completed',
      details: {
        messageId: lambdaPayload.messageId,
        sender: lambdaPayload.from,
        subject: lambdaPayload.subject,
        rawRef: lambdaPayload.rawRef,
        processingTimeMs: Date.now() - startTime,
        correlationId,
      },
      processingTimeMs: Date.now() - startTime,
      correlationId,
    });
    
    console.log('Email processed via Lambda', {
      emailId,
      orgId,
      messageId: lambdaPayload.messageId,
      rawRef: lambdaPayload.rawRef,
      processingTimeMs: Date.now() - startTime,
      correlationId,
    });
    
    return NextResponse.json({
      success: true,
      emailId,
      message: 'Email received from Lambda and queued for processing',
      correlationId,
    });
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    
    if (orgId) {
      await errorHandler.handleProcessingError(error as Error, {
        orgId,
        emailId,
        step: 'lambda_email_webhook_processing',
        metadata: {
          processingTimeMs,
          correlationId,
        },
      });
    } else {
      console.error('Lambda email webhook processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
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