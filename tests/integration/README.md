# Multi-tenant RLS Verification Tests

This directory contains comprehensive tests to verify Row Level Security (RLS) policies are properly enforced across all database tables in the ChiPhi AI system.

## Test Coverage

### Requirements Verified

- **3.1**: Users can only access data belonging to their organization through RLS policies
- **3.2**: Attempting to access another user's data returns appropriate error responses  
- **3.3**: Inbound emails are correctly associated with the proper organization based on email alias
- **3.4**: Database queries enforce row-level security policies for all data access

### Test Suites

#### 1. Core Multi-tenant RLS (`rls-verification.test.ts`)
- Organization data isolation across all core tables
- Cross-tenant access prevention via direct queries and bulk operations
- Email alias association verification
- Database function RLS enforcement

#### 2. Provider System RLS (`provider-rls-verification.test.ts`)
- Email provider logs isolation by organization
- Diagnostic checks access control (admin-only)
- Provider monitoring dashboard RLS
- Provider function RLS enforcement

#### 3. Transaction Provider Integration RLS (`transaction-provider-rls.test.ts`)
- End-to-end provider processing pipeline isolation
- Linked data access prevention across provider logs, processing logs, and transactions
- Provider statistics and analytics RLS
- Cross-tenant error details protection

## Test Structure

Each test suite follows this pattern:

1. **Setup**: Creates isolated test organizations and users with different roles
2. **Test Execution**: Performs operations that should be isolated by RLS
3. **Verification**: Confirms users can only access their organization's data
4. **Cleanup**: Removes all test data to prevent interference

## Running the Tests

### Prerequisites

1. **Database Connection**: Ensure Supabase is running and accessible
2. **Environment Variables**: Configure test database credentials
3. **Migrations**: Apply all database migrations including RLS policies

### Commands

```bash
# Run all RLS tests
npm run test:rls

# Run individual test suites
npm run test:rls:core
npm run test:rls:provider  
npm run test:rls:transaction

# Run comprehensive RLS verification with reporting
npm run test:rls:comprehensive
```

### Environment Setup

The tests require these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Test Data Management

### Isolation Strategy
- Each test creates unique organizations and users
- Test data uses identifiable naming patterns (e.g., "RLS Test Org")
- Automatic cleanup prevents test interference

### Cleanup Process
- `beforeEach`: Clear test data tracking arrays
- `afterEach`: Remove data created during individual tests  
- `afterAll`: Clean up test organizations and users
- Global teardown: Final cleanup of any remaining test data

## Security Verification

### Tables Tested
- `orgs` - Organization data
- `org_members` - Organization membership
- `emails` - Email processing data
- `transactions` - Financial transaction data
- `merchant_map` - Learning system data
- `processing_logs` - System processing logs
- `email_provider_logs` - Provider-specific logs
- `diagnostic_checks` - System health data

### Access Patterns Tested
- Direct table queries
- Bulk operations (UPDATE, DELETE)
- Database functions and stored procedures
- Monitoring dashboard views
- Cross-table joins and relationships

### Attack Vectors Prevented
- ID manipulation attempts
- Bulk operation exploitation
- Function parameter manipulation
- Cross-tenant data enumeration
- Privilege escalation attempts

## Compliance Reporting

The test runner generates compliance reports showing:

- **Test Results**: Pass/fail status for each test suite
- **Requirements Coverage**: Which requirements are verified by passing tests
- **Security Compliance Score**: Percentage of RLS policies properly enforced
- **Detailed Failure Analysis**: Specific issues when tests fail

### Compliance Thresholds

- **100%**: Full compliance - All RLS policies properly enforced
- **75-99%**: Partial compliance - Some policies need attention
- **<75%**: Critical - Major RLS policy violations detected

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure database is running

2. **RLS Policy Failures**
   - Verify migrations have been applied
   - Check policy syntax in migration files
   - Confirm RLS is enabled on tables

3. **Test Data Conflicts**
   - Run cleanup scripts between test runs
   - Check for orphaned test data
   - Verify unique constraints

### Debug Mode

Enable verbose logging:

```bash
DEBUG=true npm run test:rls:comprehensive
```

## Integration with CI/CD

The RLS tests are designed to run in CI/CD pipelines:

- Exit code 0: All tests pass, deployment can proceed
- Exit code 1: RLS violations detected, deployment should be blocked
- JUnit XML output for CI integration
- Coverage reports for security compliance tracking

## Future Enhancements

1. **Performance Testing**: Verify RLS doesn't significantly impact query performance
2. **Load Testing**: Test RLS under concurrent multi-tenant load
3. **Penetration Testing**: Automated security testing for RLS bypasses
4. **Compliance Automation**: Automatic policy generation and verification