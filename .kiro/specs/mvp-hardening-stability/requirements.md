# Requirements Document

## Introduction

This feature focuses on hardening the ChiPhi AI MVP by addressing critical stability issues, restoring the original v0 UI design, and implementing a clean inbound email provider abstraction. The system currently has unstyled UI components after recent implementation changes, needs provider flexibility for email ingestion, and requires diagnostic safeguards to prevent future regressions.

## Requirements

### Requirement 1: UI Restoration and Visual Consistency

**User Story:** As a user, I want the dashboard and transaction views to render with the correct visual styling identical to the v0 baseline, so that the application maintains its professional appearance and usability.

#### Acceptance Criteria

1. WHEN the dashboard page loads THEN the system SHALL render all components with proper Tailwind CSS styling including colors, spacing, and typography
2. WHEN transaction cards are displayed THEN the system SHALL show proper shadcn/ui component styling with correct borders, backgrounds, and hover states
3. WHEN comparing current UI to v0 baseline THEN the visual difference SHALL be within 1% threshold as measured by Playwright screenshot comparison
4. IF Tailwind configuration is missing or incorrect THEN the system SHALL fail build validation with clear error messages
5. WHEN globals.css is not properly imported THEN the system SHALL detect and report the configuration issue

### Requirement 2: Inbound Email Provider Abstraction

**User Story:** As a system administrator, I want to switch between different email providers (Cloudflare Workers Email Routing vs Amazon SES Receive) through configuration, so that the system can adapt to different deployment environments without code changes.

#### Acceptance Criteria

1. WHEN processing inbound emails THEN the system SHALL use a unified InboundEmailProvider interface regardless of the underlying provider
2. WHEN INBOUND_PROVIDER environment variable is set to "cloudflare" THEN the system SHALL use the CloudflareAdapter for email processing
3. WHEN INBOUND_PROVIDER environment variable is set to "ses" THEN the system SHALL use the SESAdapter for email processing
4. WHEN an inbound email is received THEN the system SHALL normalize the payload format through the provider interface
5. WHEN the same email messageId is received multiple times THEN the system SHALL enforce idempotency and process it only once
6. WHEN email processing fails THEN the system SHALL log the error with provider-specific context

### Requirement 3: Multi-tenant Security and Data Isolation

**User Story:** As a user, I want my financial data to be completely isolated from other users' data, so that my privacy and security are maintained in the multi-tenant system.

#### Acceptance Criteria

1. WHEN a user accesses their transactions THEN the system SHALL only return data belonging to their organization through RLS policies
2. WHEN attempting to access another user's data THEN the system SHALL deny access and return appropriate error responses
3. WHEN processing inbound emails THEN the system SHALL correctly associate transactions with the proper organization based on the email alias
4. WHEN database queries are executed THEN the system SHALL enforce row-level security policies for all data access
5. WHEN testing cross-tenant isolation THEN automated tests SHALL verify that users cannot access other organizations' data

### Requirement 4: Diagnostic and Regression Prevention

**User Story:** As a developer, I want automated checks that prevent UI and functionality regressions, so that future changes don't break the visual design or core features.

#### Acceptance Criteria

1. WHEN the application builds THEN the system SHALL validate that all required CSS frameworks and configurations are properly set up
2. WHEN running diagnostic tests THEN the system SHALL verify that key UI components render with expected computed styles
3. WHEN visual regression tests run THEN the system SHALL compare screenshots against baseline images with configurable thresholds
4. WHEN style-related files are modified THEN the CI pipeline SHALL automatically run visual regression tests
5. WHEN diagnostic endpoints are accessed THEN the system SHALL provide health checks for database, storage, and queue connectivity

### Requirement 5: MerchantMap Learning System Integrity

**User Story:** As a user, I want the system to continue learning from my transaction corrections and provide explainable AI insights, so that categorization accuracy improves over time.

#### Acceptance Criteria

1. WHEN I correct a transaction category THEN the system SHALL update the MerchantMap with the new association
2. WHEN processing similar transactions THEN the system SHALL apply learned categorization rules with appropriate confidence scores
3. WHEN displaying transaction details THEN the system SHALL show confidence scores and reasoning for AI decisions
4. WHEN toggling between original and English text THEN the system SHALL maintain the translation functionality
5. WHEN confidence scores are below threshold THEN the system SHALL flag transactions for manual review

### Requirement 6: Supabase Migration and Configuration

**User Story:** As a system administrator, I want the application to work with the new Supabase project (nejamvygfivotgaooebr) with proper environment configuration, so that the system operates reliably in the updated infrastructure.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL connect to the correct Supabase project using environment variables
2. WHEN database migrations run THEN the system SHALL apply all necessary schema changes to support the feature requirements
3. WHEN RLS policies are applied THEN the system SHALL maintain proper multi-tenant data isolation
4. WHEN environment configuration is missing THEN the system SHALL provide clear error messages with setup instructions
5. WHEN health checks run THEN the system SHALL verify connectivity to all required services (database, storage, queue)