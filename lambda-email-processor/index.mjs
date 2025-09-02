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
      console.log(`Gmail forwarding code detected: ${code}`);
      // Store code so the wizard can read it (DynamoDB recommended, with TTL)
      await fetch(process.env.APP_BASE_URL + "/api/alias/verification", {
        method: "POST",
        headers: { 
          "content-type": "application/json", 
          "x-shared-secret": process.env.SHARED_SECRET 
        },
        body: JSON.stringify({ alias, code })
      });
      return { ok: true };
    }

    // Post compact payload to your app (or run AI here; see next section)
    const payload = {
      alias,
      messageId,
      to: toAddr,
      from: email.from?.value?.[0]?.address || "",
      subject,
      text: email.text || null,
      html: email.html || null,
      rawRef: `${bucket}/${key}`,
      receivedAt: new Date().toISOString(),
      attachments: email.attachments?.map(att => ({
        name: att.filename || 'unknown',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0
      })) || []
    };

    console.log('Sending payload to Next.js API...');
    const response = await fetch(process.env.APP_BASE_URL + "/api/inbound/lambda", {
      method: "POST",
      headers: { 
        "content-type": "application/json", 
        "x-shared-secret": process.env.SHARED_SECRET 
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`API call failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`API call failed: ${response.status}`);
    }

    console.log('Email processed successfully');
    return { ok: true };
  } catch (error) {
    console.error('Error processing email:', error);
    throw error; // This will trigger Lambda retry
  }
};

function extractGmailCode(subject = "", body = "") {
  if (!/Gmail Forwarding Confirmation/i.test(subject)) return null;
  const m = body.match(/\b(\d{6,7})\b/);
  return m ? m[1] : null;
}

async function streamToBuffer(stream) {
  if (stream instanceof Buffer) return stream;
  const chunks = [];
  for await (const chunk of Readable.from(stream)) chunks.push(chunk);
  return Buffer.concat(chunks);
}