import { NextRequest, NextResponse } from 'next/server';
import { transactionProcessor } from '@/lib/services/transaction-processor';
import { transactionDb } from '@/lib/database/transaction-operations';
import { getUserSession } from '@/lib/database/utils';
import { z } from 'zod';

/**
 * Transaction API endpoints
 * 
 * Provides REST API for transaction operations with proper authentication
 * and validation. Supports creating, reading, updating, and deleting transactions.
 * 
 * Requirements covered:
 * - 3.1: Structured transaction data handling
 * - 3.2: Confidence scoring and explanation
 * - 7.3: RLS enforcement through user session
 * - 7.4: Input validation and sanitization
 */

// Validation schemas
const createTransactionSchema = z.object({
  emailId: z.string().uuid(),
  emailContent: z.string().min(1),
});

const updateTransactionSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
  merchant: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  subcategory: z.string().optional(),
  notes: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  explanation: z.string().optional(),
});

const getTransactionsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  sortBy: z.enum(['date', 'amount', 'confidence', 'created_at']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/transactions - Get transactions with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedParams = getTransactionsSchema.parse(queryParams);

    // Get transactions using database operations
    const result = await transactionDb.getTransactions(session.org.id, {
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      startDate: validatedParams.startDate,
      endDate: validatedParams.endDate,
      category: validatedParams.category,
      minConfidence: validatedParams.minConfidence,
      sortBy: validatedParams.sortBy,
      sortOrder: validatedParams.sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: result.transactions,
      pagination: {
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        total: result.total,
        totalPages: Math.ceil(result.total / validatedParams.limit),
      },
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions - Create transaction from email content
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    // Process email content to create transaction
    const transaction = await transactionProcessor.processEmailToTransaction(
      validatedData.emailId,
      session.org.id,
      validatedData.emailContent,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: transaction,
      message: 'Transaction created successfully',
    });

  } catch (error) {
    console.error('Error creating transaction:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    // Handle processing errors with appropriate status codes
    if (error instanceof Error) {
      if (error.message.includes('Confidence score') || 
          error.message.includes('below minimum threshold')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Low confidence extraction',
            message: error.message 
          },
          { status: 422 }
        );
      }

      if (error.message.includes('AI processing failed') ||
          error.message.includes('Translation failed')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Processing failed',
            message: error.message 
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}