import { NextRequest, NextResponse } from 'next/server';
import { transactionProcessor } from '@/lib/services/transaction-processor';
import { transactionDb } from '@/lib/database/transaction-operations';
import { getUserSession } from '@/lib/database/utils';
import { z } from 'zod';

/**
 * Individual Transaction API endpoints
 * 
 * Provides REST API for individual transaction operations including
 * get, update, and delete operations with proper authentication.
 * 
 * Requirements covered:
 * - 3.1: Structured transaction data handling
 * - 3.2: Confidence scoring and explanation updates
 * - 7.3: RLS enforcement through user session
 * - 7.4: Input validation and sanitization
 */

// Validation schemas
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

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/transactions/[id] - Get single transaction by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate transaction ID format
    if (!params.id || !isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Get transaction with org access check via RLS
    const transaction = await transactionProcessor.getTransaction(
      params.id,
      session.org.id
    );

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transactions/[id] - Update transaction
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate transaction ID format
    if (!params.id || !isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateTransactionSchema.parse(body);

    // Check if transaction exists and user has access
    const existingTransaction = await transactionProcessor.getTransaction(
      params.id,
      session.org.id
    );

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Update transaction
    const updatedTransaction = await transactionProcessor.updateTransaction(
      params.id,
      validatedData,
      session.org.id,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: updatedTransaction,
      message: 'Transaction updated successfully',
    });

  } catch (error) {
    console.error('Error updating transaction:', error);
    
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

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions/[id] - Partially update transaction (for category corrections)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate transaction ID format
    if (!params.id || !isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateTransactionSchema.parse(body);

    // Check if transaction exists and user has access
    const existingTransaction = await transactionProcessor.getTransaction(
      params.id,
      session.org.id
    );

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // If category is being updated, update merchant mapping for learning
    if (validatedData.category && validatedData.category !== existingTransaction.category) {
      await transactionProcessor.updateTransactionWithLearning(
        params.id,
        validatedData,
        session.org.id,
        session.user.id
      );
    } else {
      // Regular update without learning
      await transactionProcessor.updateTransaction(
        params.id,
        validatedData,
        session.org.id,
        session.user.id
      );
    }

    // Get updated transaction
    const updatedTransaction = await transactionProcessor.getTransaction(
      params.id,
      session.org.id
    );

    return NextResponse.json({
      success: true,
      data: updatedTransaction,
      message: 'Transaction updated successfully',
    });

  } catch (error) {
    console.error('Error updating transaction:', error);
    
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

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id] - Delete transaction
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Get user session for authentication and org context
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate transaction ID format
    if (!params.id || !isValidUUID(params.id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Check if transaction exists and user has access
    const existingTransaction = await transactionProcessor.getTransaction(
      params.id,
      session.org.id
    );

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Delete transaction with audit logging
    await transactionProcessor.deleteTransaction(
      params.id,
      session.org.id
    );

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Utility function to validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}