import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { config } from '@/lib/config';
import { createServiceClient } from '@/lib/supabase/server';
import { errorHandler } from '@/lib/services/error-handler';
import { loggingService } from '@/lib/services/logging-service';
import { 
  generateCorrelationId,
  extractOrgSlugFromAlias,
} from '@/lib/inbound/types';

// Zod schema for verification code storage
const VerificationCodeSchema = z.object({
  alias: z.string().regex(/^u_[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+$/, 'Invalid alias format'),
  code: z.string().regex(/^\d{6,7}$/, 'Code must be 6-7 digits'),
});

/**
 * POST /api/alias/verification
 * Store Gmail verification code for alias setup wizard
 * Used by Lambda function when processing Gmail forwarding confirmation emails
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  
  try {
    // Verify shared secret for Lambda authentication
    const sharedSecret = request.headers.get('x-shared-secret');
    if (!sharedSecret || sharedSecret !== config.inboundProvider.sharedSecret) {
      await loggingService.logSecurityEvent(
        'verification_code_auth_failed',
        'high',
        {
          description: 'Verification code storage authentication failed - invalid shared secret',
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

    // Parse and validate request body
    const body = await request.json();
    const validation = VerificationCodeSchema.safeParse(body);
    
    if (!validation.success) {
      await loggingService.logProcessingStep({
        orgId: '',
        emailId: '',
        step: 'verification_code_validation_failed',
        status: 'failed',
        details: {
          validationErrors: validation.error.errors,
          correlationId,
        },
        errorMessage: 'Invalid verification code payload',
        correlationId,
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { alias, code } = validation.data;
    const orgSlug = extractOrgSlugFromAlias(alias);

    // Create Supabase client
    const supabase = createServiceClient();

    // Verify the alias exists and is active
    const { data: aliasData, error: aliasError } = await supabase
      .from('inbox_aliases')
      .select('org_id, is_active')
      .eq('alias_email', alias)
      .eq('is_active', true)
      .single();
    
    if (aliasError || !aliasData) {
      await loggingService.logSecurityEvent(
        'verification_code_invalid_alias',
        'medium',
        {
          description: 'Verification code storage attempted for invalid or inactive alias',
          metadata: {
            alias,
            orgSlug,
            code: code.substring(0, 2) + '****', // Partially redact code
            error: aliasError?.message,
            correlationId,
          },
        }
      );
      
      return NextResponse.json(
        { error: 'Invalid or inactive alias' },
        { status: 404 }
      );
    }

    const orgId = (aliasData as any).org_id;

    // Store verification code with automatic expiration
    const { data: verificationData, error: insertError } = await supabase
      .from('verification_codes')
      .insert({
        alias,
        code,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      })
      .select('id, expires_at')
      .single();

    if (insertError) {
      await errorHandler.handleProcessingError(insertError, {
        orgId,
        step: 'verification_code_storage',
        metadata: {
          alias,
          orgSlug,
          correlationId,
        },
      });
      
      return NextResponse.json(
        { error: 'Failed to store verification code' },
        { status: 500 }
      );
    }

    // Log successful storage
    await loggingService.logProcessingStep({
      orgId,
      emailId: '',
      step: 'verification_code_stored',
      status: 'completed',
      details: {
        alias,
        orgSlug,
        verificationId: verificationData.id,
        expiresAt: verificationData.expires_at,
        processingTimeMs: Date.now() - startTime,
        correlationId,
      },
      processingTimeMs: Date.now() - startTime,
      correlationId,
    });

    console.log('Verification code stored successfully', {
      alias,
      orgSlug,
      verificationId: verificationData.id,
      expiresAt: verificationData.expires_at,
      processingTimeMs: Date.now() - startTime,
      correlationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Verification code stored successfully',
      id: verificationData.id,
      expiresAt: verificationData.expires_at,
      correlationId,
    });

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    
    console.error('Verification code storage failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs,
      correlationId,
    });
    
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
    { error: 'Method not allowed. Use GET /api/alias/verification-code to retrieve codes.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}