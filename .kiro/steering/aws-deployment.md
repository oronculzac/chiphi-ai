---
inclusion: always
---

# AWS Deployment and Infrastructure Configuration

## Deployment Information

### Production Application
- **Deployed URL**: https://main.d327zsd1iynpzj.amplifyapp.com
- **Platform**: AWS Amplify
- **Region**: ap-southeast-1 (Asia Pacific - Singapore)
- **AWS Account ID**: 741960641851

### Email Processing Infrastructure

#### Domain Configuration
- **Email Domain**: chiphi.oronculzac.com
- **MX Record**: chiphi.oronculzac.com → inbound-smtp.ap-southeast-1.amazonaws.com (priority 10)
- **SPF Record**: v=spf1 include:amazonses.com ~all (needs to be added to DNS)

#### AWS SES Configuration
- **Region**: ap-southeast-1
- **Verified Domain**: chiphi.oronculzac.com (verified)
- **Receipt Rule Set**: SESReceiptRuleSet (active)
- **Receipt Rule**: chiphi-inbound-rule (enabled, catches all @chiphi.oronculzac.com)

#### S3 Storage
- **Bucket**: chiphi-raw-emails
- **Region**: ap-southeast-1
- **Purpose**: Store raw email MIME content from SES
- **Prefix**: emails/
- **IAM Policy**: Allows SES to write objects

#### SNS Topic
- **Topic ARN**: arn:aws:sns:ap-southeast-1:741960641851:chiphi-email-notifications
- **Purpose**: Notify Lambda function when emails arrive
- **Subscription**: Lambda function (chiphi-email-processor)

#### Lambda Function
- **Function Name**: chiphi-email-processor
- **Runtime**: Node.js 20.x
- **Handler**: index.handler
- **Memory**: 256 MB
- **Timeout**: 30 seconds
- **Purpose**: Parse MIME emails from S3, extract data, POST to Next.js API
- **Trigger**: SNS topic notifications
- **IAM Role**: chiphi-email-processor-role
- **Permissions**: S3 GetObject, CloudWatch Logs

### Email Processing Flow

1. **Email Reception**: User sends email to anything@chiphi.oronculzac.com
2. **SES Processing**: SES receives email, stores in S3 bucket with prefix emails/
3. **SNS Notification**: SES publishes notification to SNS topic
4. **Lambda Trigger**: SNS triggers Lambda function with S3 object details
5. **Email Parsing**: Lambda downloads email from S3, parses with mailparser
6. **Data Extraction**: Lambda extracts structured data (to, from, subject, text, html, attachments)
7. **API Call**: Lambda POSTs processed payload to /api/inbound/lambda endpoint
8. **Application Processing**: Next.js API processes email through AI pipeline

### Environment Variables

#### AWS Configuration
```bash
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=741960641851
S3_RAW_EMAILS_BUCKET=chiphi-raw-emails
SNS_EMAIL_TOPIC_ARN=arn:aws:sns:ap-southeast-1:741960641851:chiphi-email-notifications
LAMBDA_EMAIL_PROCESSOR_ARN=arn:aws:lambda:ap-southeast-1:741960641851:function:chiphi-email-processor
```

#### Email Processing
```bash
INBOUND_PROVIDER=ses
EMAIL_DOMAIN=chiphi.oronculzac.com
EMAIL_INBOUND_DOMAIN=chiphi.oronculzac.com
DEPLOYED_APP_URL=https://main.d327zsd1iynpzj.amplifyapp.com
```

#### Security
```bash
SHARED_SECRET=development-shared-secret-key  # Change in production
SES_WEBHOOK_SECRET=development-ses-secret    # Change in production
```

### API Endpoints

#### Lambda Integration
- **Endpoint**: /api/inbound/lambda
- **Method**: POST
- **Authentication**: x-shared-secret header
- **Purpose**: Receive processed emails from Lambda function
- **Payload**: Compact JSON with parsed email data

#### Direct Provider Integration (Legacy)
- **Endpoint**: /api/inbound
- **Method**: POST
- **Authentication**: Provider-specific (HMAC, SNS signature)
- **Purpose**: Direct webhook from email providers
- **Payload**: Raw provider payload (Cloudflare, SES)

### Testing and Monitoring

#### Lambda Logs
```bash
aws logs tail /aws/lambda/chiphi-email-processor --follow --region ap-southeast-1
```

#### Test Email Processing
Send test email to: test@chiphi.oronculzac.com

#### Health Checks
- Lambda function status: Active
- SNS subscription: Confirmed
- S3 bucket permissions: Configured
- SES receipt rules: Enabled

### Security Considerations

1. **IAM Permissions**: Lambda has minimal required permissions (S3 GetObject, CloudWatch Logs)
2. **Shared Secret**: Lambda authenticates to Next.js API using shared secret
3. **SNS Signature**: Lambda verifies SNS message signatures (optional in development)
4. **S3 Bucket Policy**: Restricts SES access to specific AWS account
5. **Multi-tenant Isolation**: Email processing respects organization boundaries

### Troubleshooting

#### Common Issues
1. **Missing SPF Record**: Add TXT record for chiphi.oronculzac.com
2. **Lambda Timeout**: Increase timeout if email processing takes longer
3. **S3 Permissions**: Verify SES can write to bucket
4. **Shared Secret Mismatch**: Ensure Lambda and Next.js use same secret

#### Monitoring Commands
```bash
# Check SES receipt rules
aws ses describe-receipt-rule-set --rule-set-name SESReceiptRuleSet --region ap-southeast-1

# Check SNS subscriptions
aws sns list-subscriptions-by-topic --topic-arn "arn:aws:sns:ap-southeast-1:741960641851:chiphi-email-notifications" --region ap-southeast-1

# Check Lambda function
aws lambda get-function --function-name chiphi-email-processor --region ap-southeast-1
```