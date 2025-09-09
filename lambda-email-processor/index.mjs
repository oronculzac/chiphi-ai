// index.mjs (Runtime: Node.js 20.x)
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import crypto from "node:crypto";
import { Readable } from "node:stream";

const s3 = new S3Client({});

export const handler = async (event) => {
  console.log('Lambda triggered with event:', JSON.stringify(event, null, 2));
  
  const rec = event.Records?.[0];
  if (!rec?.ses) {
    console.log('No SES record found, skipping');
    return { ok: true };
  }

  // S3 object location from the SES S3 rule action
  const bucket = process.env.RAW_BUCKET;
  const key = rec.ses.receipt.action?.objectKey;
  
  console.log(`Processing email: bucket=${bucket}, key=${key}`);
  
  if (!bucket || !key) {
    console.log('Missing bucket or key, skipping');
    return { ok: true };
  }

  try {
    // Download raw MIME
    console.log('Downloading email from S3...');
    const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const raw = await streamToBuffer(data.Body);
    const email = await simpleParser(raw);

    const toAddr = email.to?.value?.[0]?.address || "";
    const alias = toAddr.split("@")[0]; // u_<slug>
    const subject = email.subject || "";
    const text = email.text || "";
    const messageId = email.messageId || crypto.randomUUID();

    console.log(`Parsed email: to=${toAddr}, alias=${alias}, subject=${subject}`);

    // Gmail forwarding verification?
    const code = extractGmailCode(subject, text);
    if (code) {
      console.log(`Gmail forwarding code detected: ${code} for alias: ${alias}`);
      
      try {
        const response = await fetch(process.env.APP_BASE_URL + "/api/alias/verification", {
          method: "POST",
          headers: { 
            "content-type": "application/json", 
            "x-shared-secret": process.env.SHARED_SECRET 
          },
          body: JSON.stringify({ alias, code })
        });

        if (!response.ok) {
          console.error(`Failed to store verification code: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error('Verification API error response:', errorText);
        } else {
          console.log(`Verification code stored successfully for alias: ${alias}`);
        }
      } catch (error) {
        console.error('Error storing verification code:', error);
      }
      
      return { ok: true, type: 'verification' };
    }

    // Generate correlation ID for request tracing
    const correlationId = crypto.randomUUID();
    
    // Create normalized compact payload with rawRef for audit trail
    const payload = {
      alias,
      messageId,
      to: toAddr,
      from: email.from?.value?.[0]?.address || "",
      subject,
      text: email.text || null,
      html: email.html || null,
      rawRef: `${bucket}/${key}`, // S3 reference for audit trail
      receivedAt: new Date().toISOString(),
      correlationId,
      attachments: email.attachments?.map(att => ({
        name: att.filename || 'unknown',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0
      })) || []
    };

    console.log(`Sending payload to Next.js API with correlation ID: ${correlationId}`);
    
    // Implement retry logic with exponential backoff
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(process.env.APP_BASE_URL + "/api/inbound/lambda", {
          method: "POST",
          headers: { 
            "content-type": "application/json", 
            "x-shared-secret": process.env.SHARED_SECRET,
            "x-correlation-id": correlationId
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`Email processed successfully on attempt ${attempt} with correlation ID: ${correlationId}`);
          return { ok: true, type: 'email', correlationId };
        }

        const errorText = await response.text();
        console.error(`API call failed on attempt ${attempt}: ${response.status} ${response.statusText}`);
        console.error('Error response:', errorText);
        
        // Don't retry on client errors (4xx), only server errors (5xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`API call failed with client error: ${response.status}`);
        }
        
        lastError = new Error(`API call failed: ${response.status} ${response.statusText}`);
        
        // Exponential backoff: wait 1s, 2s, 4s between retries
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`Network error on attempt ${attempt}:`, error);
        lastError = error;
        
        // Exponential backoff for network errors too
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`All ${maxRetries} attempts failed. Last error:`, lastError);
    throw lastError;
  } catch (error) {
    console.error('Error processing email:', error);
    throw error; // This will trigger Lambda retry
  }
};

function extractGmailCode(subject = "", body = "") {
  // Check for Gmail forwarding confirmation emails
  const gmailForwardingPatterns = [
    /Gmail Forwarding Confirmation/i,
    /Gmail.*Forwarding.*Confirmation/i,
    /Forwarding.*Confirmation.*Gmail/i,
    /Gmail.*Forward/i
  ];
  
  const isGmailForwarding = gmailForwardingPatterns.some(pattern => pattern.test(subject));
  if (!isGmailForwarding) return null;
  
  // Look for 6-7 digit verification codes in the email body
  // Common patterns: "123456", "1234567", "code: 123456", "verification code 123456"
  const codePatterns = [
    /(?:code|verification|confirm)[\s:]*(\d{6,7})/i,
    /(\d{6,7})[\s]*(?:is your|verification|confirmation)/i,
    /\b(\d{6,7})\b/
  ];
  
  for (const pattern of codePatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      console.log(`Gmail verification code extracted: ${match[1]} using pattern: ${pattern}`);
      return match[1];
    }
  }
  
  console.log('Gmail forwarding email detected but no verification code found');
  return null;
}

async function streamToBuffer(stream) {
  if (stream instanceof Buffer) return stream;
  const chunks = [];
  for await (const chunk of Readable.from(stream)) chunks.push(chunk);
  return Buffer.concat(chunks);
}