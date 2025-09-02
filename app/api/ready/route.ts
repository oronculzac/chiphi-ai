import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/database/connection-pool';
import { config } from '@/lib/config';

// Readiness check - determines if the application is ready to serve traffic
export async function GET(): Promise<NextResponse> {
  try {
    // Check if all critical dependencies are available
    const checks = await Promise.allSettled([
      checkDatabaseHealth(),
      // Add other critical dependency checks here
      checkEnvironmentVariables(),
    ]);
    
    const failedChecks = checks.filter(check => check.status === 'rejected');
    
    if (failedChecks.length > 0) {
      return NextResponse.json(
        { 
          ready: false, 
          errors: failedChecks.map(check => 
            check.status === 'rejected' ? check.reason?.message || 'Unknown error' : null
          ).filter(Boolean),
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json({ ready: true }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json(
      { 
        ready: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

// Check that critical environment variables are set
async function checkEnvironmentVariables(): Promise<void> {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'NEXTAUTH_SECRET',
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Validate configuration can be loaded
  try {
    // This will throw if config validation fails
    config.supabase.url;
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}