# Implementation Plan

- [x] 1. Set up project infrastructure and core database schema








  - Create Supabase database tables with proper RLS policies for multi-tenant architecture
  - Set up environment variables and configuration for email processing and AI services
  - Install required dependencies (mailparser, OpenAI SDK, additional Supabase utilities)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Implement email ingestion webhook endpoint





  - Create `/api/inbound` API route to receive email webhooks from Mailgun/Resend
  - Implement HMAC signature verification for webhook security
  - Add email parsing using mailparser library to extract MIME content
  - Create database functions to store raw emails with proper org association
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 7.1, 7.4_

- [x] 3. Build AI processing pipeline core services





  - Create language detection service using OpenAI API
  - Implement translation service to normalize non-English receipts to English
  - Build structured data extraction service to convert receipt text to JSON format
  - Add confidence scoring and explanation generation for AI decisions
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Implement MerchantMap learning system





  - Create merchant mapping lookup service with database queries
  - Build merchant mapping update functionality for user corrections
  - Implement automatic application of learned mappings to new receipts
  - Add tenant-scoped merchant mapping to ensure multi-tenant isolation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.2_

- [x] 5. Create transaction processing and storage





  - Build transaction creation service that combines AI extraction with merchant mapping
  - Implement PII redaction for credit card numbers and sensitive data
  - Add transaction validation and confidence threshold handling
  - Create database functions for transaction CRUD operations with RLS
  - _Requirements: 3.1, 3.2, 3.3, 7.3, 7.4_

- [x] 6. Build user authentication and organization management





  - Set up Supabase Auth with magic link authentication
  - Create user profile management and organization membership system
  - Implement inbox alias generation and management for email forwarding
  - Add user onboarding flow with organization creation
  - _Requirements: 1.1, 7.2, 7.5_

- [x] 7. Develop transaction dashboard and listing components





  - Create transaction list component with filtering and sorting capabilities
  - Build transaction detail view with original/translated text toggle
  - Implement category editing functionality with MerchantMap updates
  - Add confidence badge display and explanation tooltips for AI decisions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Implement real-time dashboard analytics





  - Create month-to-date totals calculation and display component
  - Build category breakdown donut chart using Recharts
  - Implement 30-day spending trend visualization
  - Add real-time updates using Supabase subscriptions for new transactions
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Build insights and analytics system





  - Create predefined analytics functions for common spending queries
  - Implement natural language query interface for insights
  - Build insights response formatting and display components
  - Add security restrictions to prevent freeform SQL execution
  - _Requirements: 6.4, 6.5_

- [x] 10. Create Gmail setup wizard component





  - Build step-by-step Gmail filter configuration wizard
  - Implement email alias display and copy functionality
  - Add Gmail filter creation instructions with visual guides
  - Create setup verification and testing functionality
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 11. Implement data export functionality





  - Create CSV export service for transaction data
  - Build YNAB-compatible export format generator
  - Add export UI components with format selection
  - Implement tenant-scoped data export with proper access controls
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 12. Add comprehensive error handling and logging





  - Implement error handling for email processing pipeline failures
  - Create retry mechanisms for transient AI service failures
  - Add comprehensive logging for debugging and monitoring
  - Build error notification system for users and administrators
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 13. Create end-to-end processing workflow integration
  - Connect email webhook to AI processing pipeline
  - Integrate AI services with MerchantMap and transaction storage
  - Add real-time notifications for completed transaction processing
  - Implement processing status tracking and user feedback
  - _Requirements: 1.2, 2.1, 3.1, 4.1, 5.1_

- [x] 14. Implement security and rate limiting
  - Add rate limiting per organization for API endpoints
  - Implement input validation using Zod schemas for all API routes
  - Create audit logging for sensitive operations and data access
  - Add security headers and CORS configuration for API endpoints
  - _Requirements: 7.1, 7.3, 7.4, 7.5, 10.5_

- [x] 15. Build comprehensive test suite
  - Create unit tests for email parsing and AI service functions
  - Write integration tests for database operations and RLS policies
  - Implement end-to-end tests using Playwright for complete user workflows
  - Add test data fixtures and mocking for AI services
  - _Requirements: All requirements validation through automated testing_

- [x] 16. Add performance optimizations and monitoring








  - Implement database indexing strategy for fast transaction queries
  - Add caching for frequently accessed merchant mappings
  - Create performance monitoring for AI service response times
  - Optimize real-time subscription handling for dashboard updates
  - _Requirements: Performance aspects of 1.2, 6.4, and system scalability_

- [x] 17. Implement production deployment configuration





  - Configure environment variables for production deployment
  - Set up database connection pooling and optimization settings
  - Implement health check endpoints for monitoring
  - Add production logging configuration with structured logging
  - _Requirements: 7.1, 7.4, 10.1, 10.5_

- [x] 18. Create comprehensive Playwright MCP testing setup
  - Set up Playwright configuration with MCP server integration
  - Create comprehensive test structure with E2E, MCP, and fixture directories
  - Implement Zod schemas for test input/output validation
  - Build enhanced test helpers with MCP integration capabilities
  - Create multilingual email sample fixtures for testing
  - Develop multi-tenant isolation and AI categorization accuracy tests
  - Add performance testing and load testing capabilities
  - Create comprehensive documentation and PR checklist
  - _Requirements: All requirements validation through automated MCP testing_

- [x] 19. Add advanced email processing features








  - Implement attachment processing for PDF receipts
  - Add support for forwarded email chains and nested receipts
  - Create duplicate detection to prevent processing same receipt twice
  - Implement email content sanitization and security scanning
  - _Requirements: 1.2, 1.3, 7.3, 10.4_

- [x] 20. Enhance user experience and accessibility





  - Add keyboard navigation support for all dashboard components
  - Implement screen reader compatibility and ARIA labels
  - Create mobile-responsive design optimizations
  - Add user preference settings for notifications and display options
  - _Requirements: 5.1, 5.2, 5.3, 9.1_

- [x] 21. Implement advanced analytics and reporting








  - Create monthly and yearly spending reports with PDF export
  - Add spending trend analysis with predictive insights
  - Implement budget tracking and alert system
  - Create comparative analytics across time periods
  - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.2_