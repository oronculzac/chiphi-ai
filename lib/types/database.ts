export interface Database {
  public: {
    Tables: {
      orgs: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
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
    };
  };
}