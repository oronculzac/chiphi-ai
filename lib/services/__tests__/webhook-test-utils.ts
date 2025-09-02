import crypto from 'crypto';

/**
 * Test utilities for webhook signature generation and email content
 */

export function generateTestMailgunSignature(timestamp: string, token: string, signingKey: string): string {
  const data = timestamp + token;
  return crypto
    .createHmac('sha256', signingKey)
    .update(data)
    .digest('hex');
}

export function generateTestResendSignature(body: string, signingKey: string): string {
  return 'sha256=' + crypto
    .createHmac('sha256', signingKey)
    .update(body, 'utf8')
    .digest('hex');
}

export const sampleReceiptEmail = `From: receipts@amazon.com
To: receipts-test123@chiphi.ai
Subject: Your Amazon.com order #123-4567890-1234567
Message-ID: <test-message-id@amazon.com>
Date: Mon, 1 Jan 2024 12:00:00 +0000
Content-Type: text/plain; charset=UTF-8

Thank you for your Amazon order!

Order Details:
Order #: 123-4567890-1234567
Order Date: January 1, 2024

Items Ordered:
- Wireless Headphones - $89.99
- USB Cable - $12.99

Subtotal: $102.98
Tax: $8.24
Total: $111.22

Payment Method: Visa ending in 1234

Shipping Address:
John Doe
123 Main St
Anytown, ST 12345

Thank you for shopping with Amazon!
`;

export const sampleWebhookPayload = {
  signature: '', // Will be filled by test
  timestamp: Math.floor(Date.now() / 1000).toString(),
  token: 'test-token-' + Math.random().toString(36).substring(7),
  'body-mime': sampleReceiptEmail,
  'message-id': '<test-message-id@amazon.com>',
  recipient: 'receipts-test123@chiphi.ai',
  sender: 'receipts@amazon.com',
  subject: 'Your Amazon.com order #123-4567890-1234567',
};

export function createTestWebhookBody(payload: typeof sampleWebhookPayload): string {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    params.append(key, value);
  });
  return params.toString();
}