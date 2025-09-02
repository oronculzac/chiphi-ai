# Email Ingestion Webhook Endpoint

This document describes the implementation of the email ingestion webhook endpoint (`/api/inbound`) that receives and processes receipt emails from email service providers.

## Overview

The webhook endpoint handles incoming emails from Mailgun or Resend, verifies their authenticity, parses the email content, and stores the data in the database for further AI processing.

## Endpoint Details

- **URL**: `/api/inbound`
- **Method**: `POST`
- **Content-Type**: `application/x-www-form-urlencoded`

## Request Format

The webhook expects form-encoded data with the following fields:

```
signature=<hmac-signature>
timestamp=<unix-timestamp>
token=<random-token>
body-mime=<raw-mime-content>
message-id=<email-message-id>
recipient=<inbox-alias-email>
sender=<sender-email>
subject=<email-subject>
```

## Security

### HMAC Signature Verification

The endpoint verifies webhook authenticity using HMAC-SHA256 signatures:

- **Mailgun**: Uses `timestamp + token` as the signed data
- **Resend**: Uses the raw request body as the signed data

### Rate Limiting

- Per-organization rate limiting (default: 100 requests/hour)
- Configurable window and limits via environment variables

### Input Validation

- Request structure validation using Zod schemas
- Email size limits (default: 10MB)
- Timestamp validation to prevent replay attacks

## Processing Flow

1. **Request Validation**: Validate request structure and required fields
2. **Signature Verification**: Verify HMAC signature using configured signing keys
3. **Recipient Validation**: Verify the recipient email is a valid, active inbox alias
4. **Rate Limit Check**: Ensure organization hasn't exceeded rate limits
5. **Email Parsing**: Parse MIME content using mailparser library
6. **Database Storage**: Store raw email and parsed content in database
7. **Logging**: Log processing steps for monitoring and debugging

## Response Codes

- `200`: Email successfully received and queued for processing
- `400`: Invalid request format or malformed data
- `401`: Invalid HMAC signature
- `404`: Unknown or inactive recipient alias
- `429`: Rate limit exceeded
- `500`: Internal server error

## Configuration

Environment variables for webhook configuration:

```bash
# Email service signing keys
MAILGUN_WEBHOOK_SIGNING_KEY=your_mailgun_key
RESEND_WEBHOOK_SIGNING_KEY=your_resend_key

# Rate limiting
RATE_LIMIT_PER_ORG_PER_HOUR=100
RATE_LIMIT_WINDOW_MINUTES=60

# Security
WEBHOOK_TIMEOUT_SECONDS=30
MAX_EMAIL_SIZE_MB=10
ALLOWED_EMAIL_DOMAINS=gmail.com,outlook.com,yahoo.com

# Email domain
EMAIL_DOMAIN=chiphi.ai
```

## Database Schema

The endpoint interacts with these database tables:

- `inbox_aliases`: Maps email aliases to organizations
- `emails`: Stores raw and parsed email content
- `processing_logs`: Tracks processing steps and errors
- `rate_limits`: Manages rate limiting per organization

## Error Handling

The endpoint implements comprehensive error handling:

- **Validation Errors**: Return 400 with detailed error information
- **Authentication Errors**: Return 401 for invalid signatures
- **Rate Limiting**: Return 429 when limits exceeded
- **Database Errors**: Log errors and return 500
- **Processing Errors**: Log for debugging, continue processing where possible

## Monitoring and Logging

Processing steps are logged to the `processing_logs` table:

- Email receipt confirmation
- Parsing success/failure
- Database storage results
- Error details and stack traces

## Testing

### Manual Testing

Use the provided test script:

```bash
node scripts/test-webhook.js http://localhost:3000/api/inbound
```

### Integration Testing

Test utilities are provided in `lib/services/__tests__/`:

- Signature generation helpers
- Sample email content
- Webhook payload builders

## Email Parsing

The endpoint uses the `mailparser` library to extract:

- Plain text and HTML content
- Email headers and metadata
- Attachments (stored as binary data)
- Sender/recipient information

## Next Steps

After successful email ingestion, the email is queued for:

1. Language detection and translation (if needed)
2. AI-powered data extraction
3. Merchant mapping and categorization
4. Transaction creation and storage

## Troubleshooting

Common issues and solutions:

1. **Invalid Signature**: Check signing key configuration
2. **Unknown Recipient**: Verify inbox alias exists and is active
3. **Rate Limits**: Check organization rate limit settings
4. **Large Emails**: Verify email size is under configured limit
5. **Database Errors**: Check Supabase connection and RLS policies

## Security Considerations

- All database operations use RLS (Row Level Security)
- Service role key is used for server-side operations
- Input validation prevents injection attacks
- Rate limiting prevents abuse
- Comprehensive logging for audit trails