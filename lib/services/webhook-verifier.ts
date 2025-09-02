import * as crypto from 'crypto';
import { config } from '@/lib/config';

/**
 * Verifies HMAC signature for webhook requests from Mailgun or Resend
 * Supports both Mailgun and Resend signature formats
 */
export function verifyWebhookSignature(
  signature: string,
  timestamp: string,
  token: string,
  body: string
): boolean {
  try {
    // Try Mailgun verification first
    if (config.email.mailgunSigningKey) {
      const mailgunValid = verifyMailgunSignature(signature, timestamp, token, config.email.mailgunSigningKey);
      if (mailgunValid) return true;
    }
    
    // Try Resend verification
    if (config.email.resendSigningKey) {
      const resendValid = verifyResendSignature(signature, body, config.email.resendSigningKey);
      if (resendValid) return true;
    }
    
    return false;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Verifies Mailgun webhook signature
 * Mailgun uses HMAC-SHA256 with timestamp + token
 */
function verifyMailgunSignature(
  signature: string,
  timestamp: string,
  token: string,
  signingKey: string
): boolean {
  const data = timestamp + token;
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(data)
    .digest('hex');
  
  // Ensure both signatures are the same length for comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Verifies Resend webhook signature
 * Resend uses HMAC-SHA256 with the raw body
 */
function verifyResendSignature(
  signature: string,
  body: string,
  signingKey: string
): boolean {
  // Remove 'sha256=' prefix if present
  const cleanSignature = signature.replace(/^sha256=/, '');
  
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(body, 'utf8')
    .digest('hex');
  
  // Ensure both signatures are the same length for comparison
  if (cleanSignature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(cleanSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Validates timestamp to prevent replay attacks
 * Rejects requests older than the configured timeout
 */
export function isTimestampValid(timestamp: string): boolean {
  try {
    const requestTime = parseInt(timestamp, 10) * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const maxAge = config.email.timeoutSeconds * 1000;
    
    return (currentTime - requestTime) <= maxAge;
  } catch (error) {
    console.error('Timestamp validation error:', error);
    return false;
  }
}