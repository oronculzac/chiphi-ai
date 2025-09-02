#!/usr/bin/env node

/**
 * Manual test script for webhook endpoint
 * Usage: node scripts/test-webhook.js [webhook-url]
 */

const crypto = require('crypto');

const WEBHOOK_URL = process.argv[2] || 'http://localhost:3000/api/inbound';
const TEST_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || 'your-mailgun-webhook-signing-key-here';

function generateMailgunSignature(timestamp, token, signingKey) {
  const data = timestamp + token;
  return crypto
    .createHmac('sha256', signingKey)
    .update(data)
    .digest('hex');
}

const sampleReceiptEmail = `From: receipts@amazon.com
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

Thank you for shopping with Amazon!
`;

async function testWebhook() {
  console.log('Testing webhook endpoint:', WEBHOOK_URL);
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'test-token-' + Math.random().toString(36).substring(7);
  const signature = generateMailgunSignature(timestamp, token, TEST_SIGNING_KEY);
  
  const payload = {
    signature,
    timestamp,
    token,
    'body-mime': sampleReceiptEmail,
    'message-id': '<test-message-id@amazon.com>',
    recipient: 'receipts-test123@chiphi.ai',
    sender: 'receipts@amazon.com',
    subject: 'Your Amazon.com order #123-4567890-1234567',
  };
  
  const body = new URLSearchParams(payload).toString();
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    
    const responseText = await response.text();
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response Body:', responseText);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed');
    }
    
  } catch (error) {
    console.error('❌ Webhook test error:', error.message);
  }
}

// Test invalid signature
async function testInvalidSignature() {
  console.log('\nTesting invalid signature...');
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const token = 'test-token-' + Math.random().toString(36).substring(7);
  const signature = 'invalid-signature';
  
  const payload = {
    signature,
    timestamp,
    token,
    'body-mime': sampleReceiptEmail,
    'message-id': '<test-message-id-invalid@amazon.com>',
    recipient: 'receipts-test123@chiphi.ai',
    sender: 'receipts@amazon.com',
    subject: 'Test Invalid Signature',
  };
  
  const body = new URLSearchParams(payload).toString();
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    
    console.log('Invalid signature response status:', response.status);
    
    if (response.status === 401) {
      console.log('✅ Invalid signature correctly rejected');
    } else {
      console.log('❌ Invalid signature should return 401');
    }
    
  } catch (error) {
    console.error('❌ Invalid signature test error:', error.message);
  }
}

async function runTests() {
  await testWebhook();
  await testInvalidSignature();
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWebhook, testInvalidSignature };