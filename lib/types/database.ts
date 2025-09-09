export interface Database {
  public: {
    Tables: {
      orgs: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      org_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          created_at: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'member';
          created_at?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: 'owner' | 'admin' | 'member';
          created_at?: string;
        };
      };
      inbox_aliases: {
        Row: {
          id: string;
          org_id: string;
          alias_email: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          alias_email: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          alias_email?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      emails: {
        Row: {
          id: string;
          org_id: string;
          message_id: string;
          from_email: string;
          to_email: string;
          subject: string | null;
          raw_content: string;
          parsed_content: any | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          message_id: string;
          from_email: string;
          to_email: string;
          subject?: string | null;
          raw_content: string;
          parsed_content?: any | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          message_id?: string;
          from_email?: string;
          to_email?: string;
          subject?: string | null;
          raw_content?: string;
          parsed_content?: any | null;
          processed_at?: string | null;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          org_id: string;
          email_id: string;
          date: string;
          amount: number;
          currency: string;
          merchant: string;
          last4: string | null;
          category: string;
          subcategory: string | null;
          notes: string | null;
          confidence: number;
          explanation: string;
          original_text: string | null;
          translated_text: string | null;
          source_language: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email_id: string;
          date: string;
          amount: number;
          currency?: string;
          merchant: string;
          last4?: string | null;
          category: string;
          subcategory?: string | null;
          notes?: string | null;
          confidence: number;
          explanation: string;
          original_text?: string | null;
          translated_text?: string | null;
          source_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email_id?: string;
          date?: string;
          amount?: number;
          currency?: string;
          merchant?: string;
          last4?: string | null;
          category?: string;
          subcategory?: string | null;
          notes?: string | null;
          confidence?: number;
          explanation?: string;
          original_text?: string | null;
          translated_text?: string | null;
          source_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      merchant_map: {
        Row: {
          id: string;
          org_id: string;
          merchant_name: string;
          category: string;
          subcategory: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          merchant_name: string;
          category: string;
          subcategory?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          merchant_name?: string;
          category?: string;
          subcategory?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      processing_logs: {
        Row: {
          id: string;
          org_id: string;
          email_id: string;
          step: string;
          status: 'started' | 'completed' | 'failed';
          details: any | null;
          error_message: string | null;
          processing_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email_id: string;
          step: string;
          status: 'started' | 'completed' | 'failed';
          details?: any | null;
          error_message?: string | null;
          processing_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email_id?: string;
          step?: string;
          status?: 'started' | 'completed' | 'failed';
          details?: any | null;
          error_message?: string | null;
          processing_time_ms?: number | null;
          created_at?: string;
        };
      };
      rate_limits: {
        Row: {
          id: string;
          org_id: string;
          endpoint: string;
          requests_count: number;
          window_start: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          endpoint: string;
          requests_count?: number;
          window_start?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          endpoint?: string;
          requests_count?: number;
          window_start?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_idempotency_records: {
        Row: {
          id: string;
          org_id: string;
          alias: string;
          message_id: string;
          email_id: string | null;
          raw_ref: string | null;
          provider: 'ses' | 'cloudflare';
          correlation_id: string | null;
          processed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          alias: string;
          message_id: string;
          email_id?: string | null;
          raw_ref?: string | null;
          provider: 'ses' | 'cloudflare';
          correlation_id?: string | null;
          processed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          alias?: string;
          message_id?: string;
          email_id?: string | null;
          raw_ref?: string | null;
          provider?: 'ses' | 'cloudflare';
          correlation_id?: string | null;
          processed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      org_invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: 'admin' | 'member';
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role: 'admin' | 'member';
          token: string;
          invited_by?: string | null;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: 'admin' | 'member';
          token?: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications_prefs: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          receipt_processed: boolean;
          daily_summary: boolean;
          weekly_summary: boolean;
          summary_emails: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          receipt_processed?: boolean;
          daily_summary?: boolean;
          weekly_summary?: boolean;
          summary_emails?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          receipt_processed?: boolean;
          daily_summary?: boolean;
          weekly_summary?: boolean;
          summary_emails?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      email_verification_codes: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          code: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          code?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      generate_inbox_alias: {
        Args: { org_uuid: string };
        Returns: string;
      };
      get_or_create_user_profile: {
        Args: { 
          user_uuid: string; 
          user_email: string; 
          user_name?: string;
        };
        Returns: string;
      };
      update_merchant_mapping: {
        Args: {
          org_uuid: string;
          merchant_name_param: string;
          category_param: string;
          subcategory_param?: string;
          user_uuid?: string;
        };
        Returns: void;
      };
      log_processing_step: {
        Args: {
          org_uuid: string;
          email_uuid: string;
          step_name: string;
          step_status: string;
          step_details?: any;
          error_msg?: string;
          processing_time?: number;
          correlation_id_param?: string;
          raw_ref_param?: string;
          message_id_param?: string;
        };
        Returns: void;
      };
      check_rate_limit: {
        Args: {
          org_uuid: string;
          endpoint_name: string;
          max_requests?: number;
          window_minutes?: number;
        };
        Returns: boolean;
      };
      check_and_create_idempotency_record: {
        Args: {
          org_uuid: string;
          alias_param: string;
          message_id_param: string;
          provider_param: string;
          raw_ref_param?: string;
          correlation_id_param?: string;
        };
        Returns: Array<{
          is_duplicate: boolean;
          record_id: string;
          existing_email_id: string | null;
          existing_processed_at: string | null;
        }>;
      };
      update_idempotency_record_email_id: {
        Args: {
          record_uuid: string;
          email_uuid: string;
        };
        Returns: void;
      };
      get_idempotency_statistics: {
        Args: {
          org_uuid?: string;
          hours_back?: number;
        };
        Returns: Array<{
          total_records: number;
          provider_breakdown: any;
          recent_activity: any;
        }>;
      };
      cleanup_old_idempotency_records: {
        Args: {
          retention_days?: number;
        };
        Returns: number;
      };
      get_message_audit_trail: {
        Args: {
          org_uuid: string;
          message_id_param: string;
        };
        Returns: Array<{
          idempotency_record: any;
          processing_logs: any;
          raw_ref: string | null;
        }>;
      };
      get_processing_logs_with_audit: {
        Args: {
          org_uuid: string;
          message_id_param?: string;
          raw_ref_param?: string;
          limit_param?: number;
        };
        Returns: Array<{
          id: string;
          email_id: string;
          step: string;
          status: string;
          details: any;
          error_message: string | null;
          processing_time_ms: number | null;
          correlation_id: string | null;
          raw_ref: string | null;
          message_id: string | null;
          created_at: string;
        }>;
      };
      invite_org_member: {
        Args: {
          p_org_id: string;
          p_email: string;
          p_role: string;
          p_invited_by: string;
          p_expires_hours?: number;
        };
        Returns: string;
      };
      accept_org_invitation: {
        Args: {
          p_token: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      update_member_role: {
        Args: {
          p_org_id: string;
          p_user_id: string;
          p_new_role: string;
          p_updated_by: string;
        };
        Returns: boolean;
      };
      remove_org_member: {
        Args: {
          p_org_id: string;
          p_user_id: string;
          p_removed_by: string;
        };
        Returns: boolean;
      };
      update_organization_info: {
        Args: {
          p_org_id: string;
          p_name?: string;
          p_logo_url?: string;
          p_updated_by?: string;
        };
        Returns: {
          id: string;
          name: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}