import { config } from '@/lib/config';

export interface InvitationEmailData {
  email: string;
  organizationName: string;
  inviterName: string | null;
  role: string;
  invitationUrl: string;
}

export class EmailService {
  private static instance: EmailService;

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send an organization invitation email
   */
  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    try {
      // For now, we'll just log the email details
      // TODO: Implement actual email sending via Resend or SES
      console.log('Sending invitation email:', {
        to: data.email,
        subject: `You're invited to join ${data.organizationName} on ChiPhi AI`,
        invitationUrl: data.invitationUrl,
        role: data.role,
        inviterName: data.inviterName,
      });

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // For development, always return success
      // In production, this would integrate with actual email service
      return true;

    } catch (error) {
      console.error('Error sending invitation email:', error);
      return false;
    }
  }

  /**
   * Generate invitation email HTML content
   */
  private generateInvitationEmailHtml(data: InvitationEmailData): string {
    const inviterText = data.inviterName 
      ? `${data.inviterName} has invited you to join` 
      : 'You have been invited to join';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to ${data.organizationName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
            .footer { text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ChiPhi AI</h1>
            </div>
            <div class="content">
              <h2>You're invited to join ${data.organizationName}</h2>
              <p>${inviterText} <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong>.</p>
              <p>ChiPhi AI helps you automatically process and categorize receipts from your email, providing insights into your spending patterns.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${data.invitationUrl}" class="button">Accept Invitation</a>
              </p>
              <p><small>This invitation will expire in 7 days. If you don't want to join this organization, you can safely ignore this email.</small></p>
            </div>
            <div class="footer">
              <p>© 2024 ChiPhi AI. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate invitation email text content
   */
  private generateInvitationEmailText(data: InvitationEmailData): string {
    const inviterText = data.inviterName 
      ? `${data.inviterName} has invited you to join` 
      : 'You have been invited to join';

    return `
You're invited to join ${data.organizationName}

${inviterText} ${data.organizationName} as a ${data.role}.

ChiPhi AI helps you automatically process and categorize receipts from your email, providing insights into your spending patterns.

To accept this invitation, click the link below:
${data.invitationUrl}

This invitation will expire in 7 days. If you don't want to join this organization, you can safely ignore this email.

© 2024 ChiPhi AI. All rights reserved.
    `.trim();
  }
}

export const emailService = EmailService.getInstance();