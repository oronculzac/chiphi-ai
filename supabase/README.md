# ChiPhi AI Database Schema

This directory contains the database migrations and schema for the ChiPhi AI email receipt processing system.

## Overview

The database is designed with multi-tenant architecture using Row Level Security (RLS) policies to ensure data isolation between organizations. All tables include proper indexing for performance and comprehensive logging for debugging.

## Schema Structure

### Core Tables

1. **orgs** - Organizations for multi-tenancy
2. **users** - User profiles (extends Supabase auth.users)
3. **org_members** - Organization membership with roles
4. **inbox_aliases** - Email aliases for receipt forwarding
5. **emails** - Raw email storage with parsing results
6. **transactions** - Processed transaction data
7. **merchant_map** - Machine learning merchant categorization
8. **processing_logs** - Detailed processing logs for debugging
9. **rate_limits** - Rate limiting tracking per organization

### Security Features

- **Row Level Security (RLS)** enabled on all tables
- **Multi-tenant isolation** using org_id in RLS policies
- **Role-based access control** (owner, admin, member)
- **Audit logging** for all sensitive operations
- **Rate limiting** per organization

### Database Functions

- `generate_inbox_alias(org_uuid)` - Creates unique email aliases
- `get_or_create_user_profile(user_uuid, user_email, user_name)` - User onboarding
- `update_merchant_mapping(...)` - Machine learning updates
- `log_processing_step(...)` - Processing step logging
- `check_rate_limit(...)` - Rate limiting enforcement

## Migration Files

1. **001_initial_schema.sql** - Core table definitions
2. **002_rls_policies.sql** - Row Level Security policies
3. **003_indexes.sql** - Performance optimization indexes
4. **004_functions.sql** - Database functions and procedures

## Setup Instructions

### Local Development

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Initialize Supabase project:
   ```bash
   supabase init
   ```

3. Start local Supabase:
   ```bash
   supabase start
   ```

4. Apply migrations:
   ```bash
   supabase db reset
   ```

### Production Deployment

1. Create new Supabase project at https://supabase.com
2. Get project URL and keys from project settings
3. Update environment variables in `.env.local`
4. Apply migrations via Supabase dashboard or CLI:
   ```bash
   supabase db push
   ```

## Environment Variables

Required environment variables for database connection:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## RLS Policy Details

### User Access Patterns

- Users can only access data from organizations they belong to
- Organization owners can manage members and settings
- All queries automatically filter by organization membership
- Service role bypasses RLS for system operations

### Security Considerations

- PII data (credit card numbers) is automatically redacted
- All sensitive operations are logged
- Rate limiting prevents abuse
- HMAC verification for webhook security

## Performance Optimizations

### Indexes

- Composite indexes on frequently queried columns
- Organization-scoped indexes for RLS performance
- Date-based indexes for transaction queries
- Full-text search indexes for merchant names

### Query Patterns

- Use organization-scoped queries for best performance
- Leverage prepared statements for repeated queries
- Consider pagination for large result sets
- Use real-time subscriptions for live updates

## Monitoring and Debugging

### Processing Logs

All email processing steps are logged with:
- Step name and status
- Processing time in milliseconds
- Error messages and stack traces
- Detailed context for debugging

### Rate Limiting

Track API usage per organization:
- Configurable limits per endpoint
- Sliding window rate limiting
- Automatic cleanup of old rate limit records

## Data Retention

### Automatic Cleanup

Consider implementing automatic cleanup for:
- Old processing logs (>30 days)
- Expired rate limit records
- Soft-deleted organizations

### Backup Strategy

- Enable point-in-time recovery
- Regular database backups
- Export critical data for compliance

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Check user organization membership
2. **Performance Issues**: Review query patterns and indexes
3. **Rate Limiting**: Check organization limits and usage
4. **Migration Errors**: Verify schema dependencies

### Debug Queries

```sql
-- Check user organization access
SELECT * FROM org_members WHERE user_id = 'user-uuid';

-- View processing logs for debugging
SELECT * FROM processing_logs 
WHERE email_id = 'email-uuid' 
ORDER BY created_at;

-- Check rate limiting status
SELECT * FROM rate_limits 
WHERE org_id = 'org-uuid' 
AND window_start > NOW() - INTERVAL '1 hour';
```