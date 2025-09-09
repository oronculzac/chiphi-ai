# Development Guidelines

## Server Management

### Check Running Servers Before Starting New Ones
Always check if development servers are already running on the target ports before executing `npm run dev` or similar commands.

**Common ports used in this project:**
- `3000` - Default Next.js development server
- `3002` - Alternative Next.js development server
- `3003` - Additional development server

**Server Management Workflow:**
1. **First, check for existing servers** on common ports (3000, 3002, 3003)
2. **If server found running**, use that server for testing and proceed with development tasks
3. **If no server found**, start a new server using appropriate command
4. **When starting a server**, use background execution or separate terminal to avoid blocking
5. **After starting server**, open new terminal/session to verify server is running before proceeding
6. **Test server accessibility** (e.g., visit `http://localhost:PORT`) before running tests or other operations

**Server Detection Commands:**
```bash
# Check if ports are in use
netstat -an | findstr :3000
netstat -an | findstr :3002
netstat -an | findstr :3003

# Or test HTTP accessibility
curl -f http://localhost:3000 2>/dev/null && echo "Server running on 3000"
curl -f http://localhost:3002 2>/dev/null && echo "Server running on 3002"
curl -f http://localhost:3003 2>/dev/null && echo "Server running on 3003"
```

**Server Starting Best Practices:**
- Start servers in background or separate terminal to avoid blocking
- After starting, immediately verify server is accessible before proceeding
- Don't wait for server start command to complete - test accessibility instead
- Use the first available running server found rather than starting multiple servers

**Commands to avoid running unnecessarily:**
- `npm run dev`
- `npm start`
- `next dev`
- Any command that starts a development server

**Why this matters:**
- Prevents port conflicts and error messages
- Avoids unnecessary resource usage
- Maintains clean development environment
- Prevents confusion about which server is active
- Avoids blocking on server start commands that don't return

## Testing Strategy

### Test Organization
- **Unit tests**: `tests/unit/` - Test individual functions and services
- **Integration tests**: `tests/integration/` - Test database operations and API endpoints
- **E2E tests**: `tests/e2e/` - Test complete user workflows
- **MCP tests**: `tests/mcp/` - Test MCP server integrations
- **Visual tests**: `tests/visual/` - Test UI consistency and regressions

### Test Naming Conventions
- Test files: `*.test.ts` for unit, `*.integration.test.ts` for integration, `*.spec.ts` for E2E
- Test descriptions: Use "should" statements for behavior testing
- Test data: Use descriptive factory functions and fixtures

### MCP Testing Patterns
- Always test MCP integrations with real payloads when possible
- Use Playwright MCP for browser automation testing
- Test Supabase MCP operations with proper cleanup
- Verify multi-tenant isolation in all MCP database tests

### UI/UX Development with MCP (Primary Approach)
- **Playwright MCP is the primary tool for all UI/UX testing and validation**
- **shadcn MCP is the primary tool for component discovery and installation**
- Use MCP integration for component development workflow:
  1. shadcn MCP for component discovery and installation
  2. Playwright MCP for automated testing and validation
  3. Playwright MCP for visual regression testing
  4. Playwright MCP for accessibility verification
- Combine both MCPs for comprehensive UI/UX development cycles
- Use Playwright MCP `browser_snapshot` over `browser_take_screenshot` for accessibility-focused testing

### Reports MVP Testing Patterns
- **Chart Component Testing**: Use Playwright MCP to test Recharts components with real data
- **Filter Interaction Testing**: Test date pickers, category selectors, and search inputs
- **Export Functionality Testing**: Verify CSV downloads with proper headers and data
- **Empty State Testing**: Test scenarios with no data and proper messaging
- **Performance Testing**: Monitor chart rendering times and data loading performance

### Test Data Management
- Use synthetic email fixtures for consistent testing
- Clean up test data after each test run
- Use separate test database/project for isolation
- Mock external services (OpenAI, email providers) in unit tests

### Performance Testing
- Include performance assertions in critical path tests
- Test rate limiting and concurrent processing
- Monitor test execution times and fail on regressions
- Use load testing for email processing workflows

### Build Commands
When running build commands like `npm run build`, these are safe to run even with servers running as they don't start new processes.

### Testing Commands
Test commands should include appropriate flags to ensure they terminate:
- Use `--run` flag with vitest for single execution
- Avoid watch modes unless specifically requested
- Ensure tests complete and exit properly

## Error Handling and Resilience

### Error Classification
- **User errors**: Invalid input, authentication failures
- **System errors**: Database connectivity, external service failures
- **Processing errors**: AI service failures, parsing errors
- **Security errors**: HMAC verification, rate limiting, suspicious activity

### Error Handling Patterns
- Use `errorHandler.executeWithRetry()` for transient failures
- Log all errors with correlation IDs for traceability
- Provide user-friendly error messages without exposing internals
- Implement circuit breakers for external service calls

### Logging Requirements
- All processing steps must be logged with timestamps
- Include correlation IDs for request tracing
- Log security events separately with appropriate severity
- Use structured logging in production environments

### Recovery Strategies
- Implement idempotency for all email processing operations
- Use database transactions for multi-step operations
- Provide manual retry mechanisms for failed operations
- Implement graceful degradation when services are unavailable

## Environment Setup

### Environment Variables
Always verify that required environment variables are properly configured before starting development servers. Missing environment variables will cause runtime errors.

### Database Connections
Ensure database connections (Supabase, etc.) are properly configured and accessible before running the application.

### Provider Configuration
- Use `INBOUND_PROVIDER` environment variable for email provider selection
- Provider-specific secrets should be clearly named
- Support runtime provider switching for testing
- Validate provider configuration on startup