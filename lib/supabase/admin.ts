import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

// Admin client with service role key for server-side operations
export const createAdminClient = () =>
  createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );