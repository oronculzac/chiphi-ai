# ChiPhi AI Testing Guide

## Overview

This guide covers the comprehensive testing setup for ChiPhi AI, including unit tests, integration tests, end-to-end tests, and MCP (Model Context Protocol) server integration tests.

## Test Structure

```
tests/
├── e2e/                    # End-to-end Playwright tests
├── mcp/                    # MCP server integration tests
├── fixtures/               # Test data and sample emails
├── utils/                  # Test helper utilities
├── global-setup.ts        # Global test setup
└── global-teardown.ts     # Global test cleanup
```

## Test Types

### 1. Unit Tests (Vitest)

Located in component `__tests__` directories and `lib/` test files.

```bash
# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:unit:watch
```

### 2. Integration Tests (Vitest)

Test API routes, database operations, and service integrations.

```bash
# Run integration tests
npm run test:integration
```

### 3. End-to-End Tests (Playwright)

Comprehensive workflow testing including email processing, dashboard updates, and user interactions.

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test file
npm run test:workflow

# Debug mode
npm run test:e2e:debug
```

### 4. MCP Integration Tests (Playwright)

Test Model Context Protocol server integrations.

```bash
# Run all MCP tests
npm run test:mcp

# Run specific MCP server tests
npm run test:mcp:supabase
npm run test:mcp:playwright
```

## MCP Server Setup

### Prerequisites

1. **UV Package Manager**: Install UV for Python package management
   ```bash
   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   
   # Windows
   powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. **Node.js Packages**: Install required MCP packages
   ```bash
   npm install -g @playwright/mcp@latest
   npm install -g @upstash/context7-mcp
   npm install -g magicui-mcp
   npm install -g @supabase/mcp-server-supabase@latest
   ```

### MCP Configuration

The MCP servers are configured in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "YOUR_TOKEN"],
      "disabled": false,
      "autoApprove": ["apply_migration", "execute_sql", "get_project", "list_edge_functions"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless", "--browser", "chrome"],
      "disabled": false,
      "autoApprove": ["browser_navigate", "browser_screenshot", "browser_click"]
    },
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"],
      "disabled": false,
      "autoApprove": ["resolve-library-id", "get-library-docs"]
    },
    "magicui": {
      "command": "npx",
      "args": ["-y", "magicui-mcp"],
      "disabled": false,
      "autoApprove": ["getAllComponents", "getComponent", "getComponentsByType"]
    }
  }
}
```

## Test Environment Setup

### Environment Variables

Create a `.env.test` file with test-specific configuration:

```env
# Application
PLAYWRIGHT_BASE_URL=http://localhost:3000
NODE_ENV=test

# Database
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key

# AI Services
OPENAI_API_KEY=your-test-openai-key

# Email Processing
WEBHOOK_SECRET=test-webhook-secret
MAILGUN_API_KEY=test-mailgun-key

# MCP Servers
SUPABASE_PROJECT_ID=your-test-project-id
```

### Database Setup

1. **Start Local Supabase**:
   ```bash
   supabase start
   ```

2. **Run Migrations**:
   ```bash
   supabase db reset
   ```

3. **Generate Types**:
   ```bash
   supabase gen types typescript --local > lib/types/database.ts
   ```

## Test Data Management

### Test Organizations

Predefined test organizations are available in `tests/fixtures/test-organizations.ts`:

- `primary`: Main test organization
- `secondary`: For isolation testing
- `multilingual`: For translation testing
- `performance`: For load testing
- `security`: For security testing

### Email Samples

Multilingual email samples in `tests/fixtures/email-samples.ts`:

- English receipts (Starbucks, Whole Foods, Uber)
- Spanish receipts (restaurants, pharmacies)
- French receipts (cafes, pharmacies)
- Japanese receipts (convenience stores, restaurants)
- German receipts (gas stations, supermarkets)
- Edge cases (malformed, forwarded, PDF attachments)

### Test Helpers

Utility classes in `tests/utils/test-helpers.ts`:

- `AuthHelper`: User authentication and organization switching
- `EmailHelper`: Email sending and processing verification
- `DashboardHelper`: Dashboard interaction and verification
- `MCPHelper`: MCP server operation testing
- `PerformanceHelper`: Performance measurement utilities
- `SecurityHelper`: Security testing utilities
- `AccessibilityHelper`: Accessibility testing utilities

## Running Tests

### Development Workflow

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Run Quick Tests**:
   ```bash
   npm run test:quick
   ```

3. **Run Full Test Suite**:
   ```bash
   npm run test:full
   ```

### CI/CD Pipeline

```bash
# CI test command
npm run test:ci

# Comprehensive test suite
npm run test:comprehensive
```

### Specific Test Categories

```bash
# Email processing workflow
npm run test:workflow

# Multi-tenant isolation
npm run test:isolation

# AI categorization accuracy
npm run test:accuracy

# Real-time dashboard updates
npm run test:realtime

# Performance and load testing
npm run test:performance

# Security testing
npm run test:security

# Multilingual processing
npm run test:multilang

# Accessibility testing
npm run test:accessibility

# Cross-browser testing
npm run test:cross-browser

# Mobile testing
npm run test:mobile
```

## Test Debugging

### Playwright Debugging

1. **Debug Mode**:
   ```bash
   npm run test:e2e:debug
   ```

2. **Headed Mode**:
   ```bash
   npm run test:e2e:headed
   ```

3. **UI Mode**:
   ```bash
   npm run test:e2e:ui
   ```

### Test Reports

View test reports:
```bash
npm run test:report
```

Reports are generated in:
- `test-results/html-report/` - HTML report
- `test-results/junit.xml` - JUnit XML
- `test-results/results.json` - JSON results

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots: `test-results/artifacts/`
- Videos: `test-results/artifacts/`
- Traces: `test-results/artifacts/`

## Performance Testing

### Load Testing

Test concurrent email processing:
```bash
npm run test:load
```

### Memory Monitoring

Monitor memory usage during tests:
```typescript
const memoryUsage = await performanceHelper.monitorMemoryUsage();
console.log(`Memory used: ${memoryUsage.used / 1024 / 1024} MB`);
```

### Response Time Testing

Measure API response times:
```typescript
const responseTime = await performanceHelper.measureApiResponseTime('/api/transactions');
expect(responseTime).toBeLessThan(1000); // Under 1 second
```

## Security Testing

### XSS Prevention

Test cross-site scripting prevention:
```typescript
const xssPrevented = await securityHelper.testXSSPrevention(
  '<script>alert("xss")</script>',
  '[data-testid="merchant-input"]'
);
expect(xssPrevented).toBe(true);
```

### SQL Injection Prevention

Test SQL injection prevention:
```typescript
const sqlInjectionPrevented = await securityHelper.testSQLInjection(
  "'; DROP TABLE transactions; --",
  '/api/transactions'
);
expect(sqlInjectionPrevented).toBe(true);
```

### PII Redaction

Test personally identifiable information redaction:
```typescript
const piiResult = await securityHelper.testPIIRedaction(
  'Credit card: 4111-1111-1111-1111, SSN: 123-45-6789'
);
expect(piiResult.redacted).toBe(true);
expect(piiResult.patterns).toContain('credit_card');
```

## Accessibility Testing

### Keyboard Navigation

Test keyboard accessibility:
```typescript
const keyboardAccessible = await accessibilityHelper.testKeyboardNavigation();
expect(keyboardAccessible).toBe(true);
```

### ARIA Labels

Check ARIA label compliance:
```typescript
const ariaResult = await accessibilityHelper.checkAriaLabels();
expect(ariaResult.missing.length).toBe(0);
```

### Color Contrast

Verify color contrast ratios:
```typescript
const contrastResult = await accessibilityHelper.checkColorContrast();
expect(contrastResult.failed).toBe(0);
```

## Troubleshooting

### Common Issues

1. **Server Not Running**:
   ```
   Error: connect ECONNREFUSED 127.0.0.1:3000
   ```
   Solution: Start development server with `npm run dev`

2. **Database Connection Failed**:
   ```
   Error: Database connection failed
   ```
   Solution: Start Supabase with `supabase start`

3. **MCP Server Timeout**:
   ```
   Error: MCP operation timeout
   ```
   Solution: Check MCP server configuration and network connectivity

4. **Test Data Conflicts**:
   ```
   Error: Duplicate key value violates unique constraint
   ```
   Solution: Run test cleanup with `npm run test:cleanup`

### Debug Commands

```bash
# Validate test data
npm run test:validate

# Clean up test data
npm run test:cleanup

# Check test setup
npm run test:setup
```

### Log Analysis

Test logs are available in:
- Console output during test runs
- `test-results/` directory
- Browser developer tools (for E2E tests)

## Best Practices

### Test Organization

1. **Group Related Tests**: Use `test.describe()` blocks
2. **Clear Test Names**: Describe what the test validates
3. **Setup and Teardown**: Use `beforeEach` and `afterEach`
4. **Test Isolation**: Each test should be independent

### Data Management

1. **Use Fixtures**: Predefined test data for consistency
2. **Clean State**: Reset data between tests
3. **Realistic Data**: Use representative test data
4. **Edge Cases**: Include boundary and error conditions

### Assertions

1. **Specific Assertions**: Test exact expected values
2. **Multiple Checks**: Verify different aspects
3. **Error Messages**: Provide clear failure descriptions
4. **Async Handling**: Properly wait for async operations

### Performance

1. **Parallel Execution**: Run independent tests in parallel
2. **Selective Testing**: Use test tags and filters
3. **Resource Cleanup**: Clean up after tests
4. **Timeout Management**: Set appropriate timeouts

## Contributing

### Adding New Tests

1. **Choose Test Type**: Unit, integration, E2E, or MCP
2. **Use Helpers**: Leverage existing test utilities
3. **Follow Patterns**: Match existing test structure
4. **Add Documentation**: Update this guide for new patterns

### Test Review Checklist

- [ ] Tests are independent and isolated
- [ ] Test data is properly managed
- [ ] Error cases are covered
- [ ] Performance is acceptable
- [ ] Documentation is updated
- [ ] CI/CD integration works

### Reporting Issues

When reporting test issues:

1. **Environment Details**: OS, Node version, browser
2. **Test Command**: Exact command that failed
3. **Error Output**: Full error message and stack trace
4. **Reproduction Steps**: How to reproduce the issue
5. **Expected vs Actual**: What should happen vs what happened