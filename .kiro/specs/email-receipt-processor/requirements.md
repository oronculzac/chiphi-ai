# Requirements Document

## Introduction

ChiPhi AI is an email-first, multilingual receipt processing system that automatically translates, extracts, and categorizes financial data from receipt emails. The system provides explainable AI insights with real-time dashboards and learns from user corrections to improve future categorization accuracy. The MVP focuses on email ingestion, AI-powered extraction, and basic analytics while maintaining strict security and multi-tenant isolation.

## Requirements

### Requirement 1

**User Story:** As a user, I want to forward receipt emails to a private alias so that the system can automatically process my receipts without manual data entry.

#### Acceptance Criteria

1. WHEN a user signs up THEN the system SHALL generate a unique private email alias for that user
2. WHEN a receipt email is forwarded to the private alias THEN the system SHALL receive and process it within 60 seconds
3. WHEN an email is received THEN the system SHALL verify HMAC signature for security
4. WHEN processing an email THEN the system SHALL extract MIME content using mailparser
5. IF an email lacks proper authentication THEN the system SHALL reject it and log the attempt

### Requirement 2

**User Story:** As a user, I want the system to translate receipts in any language to English so that I can understand and categorize expenses regardless of the original language.

#### Acceptance Criteria

1. WHEN a receipt contains non-English text THEN the system SHALL detect the source language
2. WHEN non-English content is detected THEN the system SHALL translate it to English before extraction
3. WHEN translation is complete THEN the system SHALL preserve both original and translated versions
4. WHEN displaying transactions THEN the system SHALL provide an "Original↔English" toggle
5. IF translation fails THEN the system SHALL proceed with original text and flag the issue

### Requirement 3

**User Story:** As a user, I want receipt data extracted into structured JSON format so that I can have consistent, searchable transaction records.

#### Acceptance Criteria

1. WHEN processing a receipt THEN the system SHALL extract data into strict JSON format
2. WHEN extracting data THEN the system SHALL include: date, amount, currency, merchant, last4, category, subcategory, notes, confidence, explanation
3. WHEN extracting payment info THEN the system SHALL store only last4 digits if present and redact full PANs
4. WHEN extraction is complete THEN the system SHALL assign a confidence score (0-100)
5. WHEN extraction is complete THEN the system SHALL provide an explanation for the categorization decision

### Requirement 4

**User Story:** As a user, I want the system to learn from my corrections so that similar receipts are automatically categorized correctly in the future.

#### Acceptance Criteria

1. WHEN a user corrects a transaction category THEN the system SHALL update the MerchantMap for that merchant
2. WHEN processing future receipts from the same merchant THEN the system SHALL apply the learned categorization
3. WHEN multiple corrections exist for a merchant THEN the system SHALL use the most recent correction
4. WHEN a correction is made THEN the system SHALL apply it only within the user's tenant scope
5. IF no merchant mapping exists THEN the system SHALL use AI-based categorization with explanation

### Requirement 5

**User Story:** As a user, I want to see explainable AI decisions on every transaction so that I can understand and trust the system's categorization.

#### Acceptance Criteria

1. WHEN displaying a transaction THEN the system SHALL show a confidence badge
2. WHEN displaying a transaction THEN the system SHALL provide a "Why" explanation for the categorization
3. WHEN a user clicks the explanation THEN the system SHALL show detailed reasoning
4. WHEN displaying receipts THEN the system SHALL provide original text toggle functionality
5. WHEN confidence is below 70% THEN the system SHALL highlight the transaction for review

### Requirement 6

**User Story:** As a user, I want real-time dashboards and insights so that I can understand my spending patterns and make informed financial decisions.

#### Acceptance Criteria

1. WHEN accessing the dashboard THEN the system SHALL display month-to-date totals
2. WHEN viewing analytics THEN the system SHALL show category breakdown as a donut chart
3. WHEN viewing trends THEN the system SHALL display 30-day spending trend
4. WHEN asking insights questions THEN the system SHALL answer using predefined analytics functions
5. WHEN generating insights THEN the system SHALL NOT allow freeform SQL queries for security

### Requirement 7

**User Story:** As a user, I want secure multi-tenant data isolation so that my financial data remains private and protected.

#### Acceptance Criteria

1. WHEN storing data THEN the system SHALL implement row-level security (RLS) for all tables
2. WHEN a user accesses data THEN the system SHALL only return data belonging to their tenant
3. WHEN storing sensitive data THEN the system SHALL encrypt it at rest using database defaults
4. WHEN processing emails THEN the system SHALL redact PAN numbers and 2FA codes
5. WHEN rate limiting THEN the system SHALL apply limits per organization with usage logging

### Requirement 8

**User Story:** As a user, I want to export my transaction data so that I can use it with other financial tools and maintain my own records.

#### Acceptance Criteria

1. WHEN requesting export THEN the system SHALL generate CSV format files
2. WHEN requesting export THEN the system SHALL generate YNAB-compatible format
3. WHEN exporting data THEN the system SHALL include all transaction fields
4. WHEN exporting THEN the system SHALL only include data accessible to the requesting user
5. IF export fails THEN the system SHALL provide clear error messaging and retry options

### Requirement 9

**User Story:** As a user, I want Gmail integration setup guidance so that I can easily configure email forwarding without technical expertise.

#### Acceptance Criteria

1. WHEN setting up Gmail integration THEN the system SHALL provide a step-by-step wizard
2. WHEN in the wizard THEN the system SHALL show how to create Gmail filters
3. WHEN configuring filters THEN the system SHALL provide the correct forwarding address
4. WHEN setup is complete THEN the system SHALL verify the configuration works
5. IF setup fails THEN the system SHALL provide troubleshooting guidance

### Requirement 10

**User Story:** As a system administrator, I want comprehensive logging and monitoring so that I can ensure system reliability and debug issues.

#### Acceptance Criteria

1. WHEN processing emails THEN the system SHALL log all processing steps with timestamps
2. WHEN AI models are called THEN the system SHALL log usage and costs per organization
3. WHEN errors occur THEN the system SHALL log detailed error information for debugging
4. WHEN suspicious activity is detected THEN the system SHALL log security events
5. WHEN system performance degrades THEN the system SHALL alert administrators