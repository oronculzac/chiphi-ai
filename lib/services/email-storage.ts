import { createServiceClient } from '@/lib/supabase/server';
import { ParsedEmail, InsertEmail } from '@/lib/types';

export interface StoreEmailParams {
  orgId: string;
  messageId: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  rawContent: string;
  parsedContent: ParsedEmail;
}

/**
 * Stores raw email data in the database with proper org association
 * Returns the created email ID for further processing
 */
export async function storeRawEmail(params: StoreEmailParams): Promise<string> {
  const supabase = createServiceClient();
  
  try {
    // Prepare email data for insertion
    const emailData: InsertEmail = {
      org_id: params.orgId,
      message_id: params.messageId,
      from_email: params.fromEmail,
      to_email: params.toEmail,
      subject: params.subject,
      raw_content: params.rawContent,
      parsed_content: params.parsedContent,
      processed_at: null, // Will be updated when AI processing completes
    };
    
    // Insert email record
    const { data, error } = await supabase
      .from('emails')
      .insert(emailData as any)
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to store email in database:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data?.id) {
      throw new Error('Failed to get email ID from database insert');
    }
    
    console.log('Email stored successfully', {
      emailId: (data as any).id,
      orgId: params.orgId,
      messageId: params.messageId,
    });
    
    return (data as any).id;
    
  } catch (error) {
    console.error('Email storage failed:', error);
    throw error;
  }
}

/**
 * Updates email record to mark it as processed
 * Called after AI processing pipeline completes
 */
export async function markEmailAsProcessed(emailId: string): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    const { error } = await supabase
      .from('emails')
      .update({ 
        processed_at: new Date().toISOString() 
      } as any)
      .eq('id', emailId);
    
    if (error) {
      console.error('Failed to mark email as processed:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log('Email marked as processed', { emailId });
    
  } catch (error) {
    console.error('Failed to update email processed status:', error);
    throw error;
  }
}

/**
 * Retrieves email by ID with org validation
 * Ensures the email belongs to the specified organization
 */
export async function getEmailById(emailId: string, orgId: string): Promise<any> {
  const supabase = createServiceClient();
  
  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .eq('org_id', orgId)
      .single();
    
    if (error) {
      console.error('Failed to retrieve email:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('Email retrieval failed:', error);
    throw error;
  }
}

/**
 * Retrieves unprocessed emails for an organization
 * Used for batch processing or retry mechanisms
 */
export async function getUnprocessedEmails(orgId: string, limit: number = 10): Promise<any[]> {
  const supabase = createServiceClient();
  
  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('org_id', orgId)
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Failed to retrieve unprocessed emails:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return data || [];
    
  } catch (error) {
    console.error('Unprocessed emails retrieval failed:', error);
    throw error;
  }
}

/**
 * Checks if an email with the given message ID already exists
 * Prevents duplicate processing of the same email
 */
export async function emailExists(messageId: string): Promise<boolean> {
  const supabase = createServiceClient();
  
  try {
    const { data, error } = await supabase
      .from('emails')
      .select('id')
      .eq('message_id', messageId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Failed to check email existence:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return !!data;
    
  } catch (error) {
    console.error('Email existence check failed:', error);
    return false; // Assume doesn't exist on error to avoid blocking processing
  }
}

/**
 * Deletes old processed emails based on retention policy
 * Should be called periodically to manage storage
 */
export async function cleanupOldEmails(orgId: string, retentionDays: number = 90): Promise<number> {
  const supabase = createServiceClient();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const { data, error } = await supabase
      .from('emails')
      .delete()
      .eq('org_id', orgId)
      .not('processed_at', 'is', null)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) {
      console.error('Failed to cleanup old emails:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    const deletedCount = data?.length || 0;
    console.log('Old emails cleaned up', { orgId, deletedCount, retentionDays });
    
    return deletedCount;
    
  } catch (error) {
    console.error('Email cleanup failed:', error);
    throw error;
  }
}