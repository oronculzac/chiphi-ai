# Implementation Plan

- [x] 1. Fix Tailwind CSS Configuration and UI Restoration
  - Diagnose and fix Tailwind v4 configuration issues in postcss.config.mjs and package.json
  - Ensure globals.css is properly imported and Tailwind directives are working
  - Verify shadcn/ui component styling is rendering correctly
  - Create missing tailwind.config.ts file with proper content paths and theme configuration
  - Test that all UI components render with expected styles (buttons, cards, badges)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Create Diagnostic Debug Page and Style Probes with MCP Integration
  - **Use shadcn MCP to audit and manage UI components** with `getAllComponents` and `getComponent`
  - Create /app/debug/page.tsx with comprehensive style testing components
  - Use shadcn MCP `search-components` to identify optimal components for style probes
  - Implement StyleProbes component with test buttons, cards, and badges using shadcn MCP
  - Add computed style verification utilities using Playwright MCP `browser_evaluate`
  - Create diagnostic endpoints for CSS health checks and component integrity
  - Implement style regression detection mechanisms with Playwright MCP automation
  - **Establish MCP-first workflow**: shadcn MCP for components + Playwright MCP for testing
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Implement Inbound Email Provider Interface and Types
  - Create lib/inbound/types.ts with InboundEmailPayload and InboundEmailProvider interfaces
  - Define ProviderConfig interface for provider configuration management
  - Implement email payload normalization utilities
  - Create provider-specific error types and handling interfaces
  - Add validation schemas for provider payloads using Zod
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Create Provider Adapter Implementations
  - Implement lib/inbound/providers/cloudflare-adapter.ts with CloudflareAdapter class
  - Implement lib/inbound/providers/ses-adapter.ts with SESAdapter class
  - Create provider verification methods for HMAC and signature validation
  - Implement payload parsing and normalization for each provider
  - Add error handling and logging for provider-specific failures
  - _Requirements: 2.2, 2.3, 2.6_

- [x] 5. Create Provider Factory and Switching Logic
  - Implement lib/inbound/provider-factory.ts with ProviderFactory class
  - Create provider selection logic based on INBOUND_PROVIDER environment variable
  - Add provider configuration validation and error handling
  - Implement provider health checking and fallback mechanisms
  - Create provider-specific logging and monitoring utilities
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 6. Update Inbound API Route with Provider Abstraction
  - Modify app/api/inbound/route.ts to use provider abstraction layer
  - Implement provider-agnostic email processing pipeline
  - Add idempotency checking with normalizeAlias and verifyIdempotency functions
  - Create enqueueProcessJob function for unified email processing
  - Update error handling to work with provider abstraction
  - _Requirements: 2.1, 2.4, 2.5, 2.6_

- [x] 7. Configure AWS SES Email Processing Infrastructure
  - Set up AWS SES receipt rules for chiphi.oronculzac.com domain
  - Create SNS topic (chiphi-email-notifications) for email notifications
  - Configure S3 bucket (chiphi-raw-emails) with proper IAM policies for SES
  - Deploy Lambda function (chiphi-email-processor) with Node.js 20.x runtime
  - Integrate Lambda with SNS topic and configure webhook to /api/inbound/lambda
  - Update environment variables with AWS configuration (region, account, ARNs)
  - _Requirements: 2.2, 2.3, 6.1, 6.5_

- [x] 8. Update Configuration Schema for New Features
  - Add INBOUND_PROVIDER, CLOUDFLARE_EMAIL_SECRET, and SES_WEBHOOK_SECRET to lib/config.ts
  - Add AWS configuration variables (region, account ID, S3 bucket, SNS topic ARN)
  - Add visual regression testing configuration variables
  - Add diagnostic and debug endpoint configuration options
  - Update environment variable validation with new provider settings
  - Create configuration validation for provider-specific requirements
  - _Requirements: 2.2, 4.1, 6.4_

- [x] 9. Create Database Migrations for Provider Tracking
  - Create Supabase migration for email_provider_logs table
  - Add provider tracking fields (provider_name, payload, processing_time_ms)
  - Implement unique constraint for message idempotency (org_id, message_id)
  - Create diagnostic_checks table for system health monitoring
  - Add proper RLS policies for multi-tenant data isolation
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 6.5_

- [x] 10. Update Supabase Configuration for New Project
  - Update environment variables to point to nejamvygfivotgaooebr project
  - Create .env.example with new Supabase project configuration
  - Test database connectivity and verify RLS policies are working
  - Update lib/supabase/client.ts and server.ts if needed for new project
  - Verify all existing functionality works with new Supabase project
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 11. Implement Visual Regression Testing with Playwright MCP (Primary UI Testing Tool)
  - **Use Playwright MCP as the primary tool for all UI/UX testing and validation**
  - Create tests/visual/debug-page-regression.spec.ts with comprehensive UI testing using MCP
  - Use `browser_snapshot` for accessibility-focused testing (preferred over screenshots)
  - Use `browser_take_screenshot` for visual regression baseline creation and comparison
  - Use `browser_evaluate` for computed style verification tests on buttons, cards, and components
  - Use `browser_navigate`, `browser_click`, `browser_fill` for interaction testing
  - Implement 1% visual difference threshold checking with Playwright MCP
  - Integrate with shadcn MCP for component validation workflow
  - _Requirements: 1.3, 4.2, 4.3, 4.4_

- [x] 12. Create Health Check and Admin Endpoints
  - Create app/api/health/route.ts with comprehensive system health checks
  - Implement database connectivity, storage, and queue health verification
  - Add provider-specific health checks and status reporting
  - Create admin endpoints for diagnostic information and system status
  - Implement proper error handling and security for admin endpoints
  - _Requirements: 4.5, 6.5_

- [x] 13. Implement Multi-tenant RLS Verification Tests
  - Create comprehensive RLS policy tests for cross-tenant data isolation
  - Test that users cannot access other organizations' email data
  - Verify provider logs are properly isolated by organization
  - Test transaction data isolation with new provider system
  - Create automated tests to verify RLS policies are enforced
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 14. Fix RLS Test Issues and Create SES-Focused Provider Tests
  - **Fix 4 failing RLS tests from previous implementation**:
    - Fix provider monitoring dashboard RLS test (investigate dashboard view RLS policies)
    - Fix provider statistics function cross-tenant test (ensure proper org_id filtering)
    - Fix provider errors function cross-tenant test (apply same org_id filtering pattern)
    - Fix join query null vs empty array assertion (update test expectations)
  - **Focus on SES provider since AWS infrastructure is already set up**:
    - Create comprehensive SES adapter contract tests with synthetic payloads
    - Test Lambda integration with /api/inbound/lambda endpoint using real SES payload format
    - Verify SES HMAC signature validation and shared secret authentication
    - Test idempotency enforcement with duplicate message IDs from SES
  - **Use Playwright MCP as primary tool** for API testing and verification
  - Use Playwright MCP `browser_navigate` and `browser_evaluate` for endpoint testing
  - Test that processed SES emails create transactions with confidence scores
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3_

- [x] 15. Implement MerchantMap Learning System Verification
  - Verify MerchantMap learning functionality remains intact after changes
  - Test transaction categorization with confidence scores and explanations
  - Implement Original↔English translation toggle functionality testing
  - Verify AI decision explanations are properly displayed
  - Test that user corrections update MerchantMap associations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 16. Create CI Integration and Regression Prevention
  - Implement CI pipeline integration for visual regression tests
  - Create automated checks that fail builds when Tailwind directives are missing
  - Add style regression detection to prevent future CSS configuration issues
  - Implement automated provider functionality testing in CI
  - Create comprehensive test suite that runs on every pull request
  - _Requirements: 4.4, 4.5_

- [x] 17. Establish MCP-First UI/UX Development Workflow
  - **Implement comprehensive MCP integration for all UI/UX work**
  - Create standardized workflow: shadcn MCP for component discovery → Playwright MCP for testing
  - Use shadcn MCP `getAllComponents` to audit current component library completeness
  - Use shadcn MCP `add-component` to install missing shadcn/ui components as needed
  - Use Playwright MCP `browser_snapshot` for accessibility verification of all components
  - Create MCP-driven component testing pipeline with automated validation
  - Document MCP-first approach for future UI/UX development
  - Train development workflow to prioritize MCP tools over manual approaches
  - _Requirements: 1.1, 1.2, 4.2, 4.3_

- [x] 18. Create Missing Integration Tests for Provider Abstraction





  - Create tests/integration/provider-abstraction.test.ts with comprehensive provider testing
  - Test CloudflareAdapter and SESAdapter with synthetic payloads
  - Verify provider factory creation and switching logic
  - Test provider health checks and fallback mechanisms
  - Validate idempotency enforcement across different providers
  - Test error handling and logging for provider-specific failures
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 19. Enhance Visual Regression Test Coverage





  - Create tests/visual/ui-regression.spec.ts for comprehensive UI testing
  - Add visual regression tests for dashboard components
  - Test transaction list and detail view styling
  - Verify responsive design across different viewport sizes
  - Add cross-browser visual regression testing
  - Implement automated baseline image management
  - _Requirements: 1.3, 4.2, 4.3, 4.4_

- [x] 20. Implement Database Connection Pool Health Monitoring





  - Create lib/database/connection-pool.ts with proper connection pooling
  - Implement connection health monitoring and metrics
  - Add connection pool statistics to health check endpoint
  - Create alerts for connection pool exhaustion
  - Implement graceful degradation when connections are limited
  - _Requirements: 4.5, 6.5_