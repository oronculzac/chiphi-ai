import { createAdminClient } from '@/lib/supabase/admin';
import { logProcessingStep } from '@/lib/database/utils';

/**
 * Notification Service
 * 
 * This service handles user and administrator notifications for errors,
 * system alerts, and processing updates.
 * 
 * Requirements covered:
 * - 10.4: Log security events
 * - 10.5: Alert administrators on system performance degradation
 */

export interface UserNotification {
  type: 'processing_error' | 'processing_complete' | 'system_maintenance';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  details?: Record<string, any>;
}

export interface AdminNotification {
  type: 'security_alert' | 'system_alert' | 'performance_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  details?: Record<string, any>;
}

export class NotificationService {
  private supabase;

  // Administrator email addresses (in production, this would come from config)
  private readonly ADMIN_EMAILS = [
    'admin@chiphi.ai',
    'alerts@chiphi.ai',
  ];

  // Notification rate limiting
  private readonly notificationCache = new Map<string, number>();
  private readonly RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_NOTIFICATIONS_PER_WINDOW = 3;

  constructor() {
    this.supabase = createAdminClient();
  }

  /**
   * Notify user about processing events
   */
  async notifyUser(userId: string, notification: UserNotification): Promise<void> {
    try {
      // Check rate limiting
      const cacheKey = `user:${userId}:${notification.type}`;
      if (this.isRateLimited(cacheKey)) {
        console.log(`Notification rate limited for user ${userId}, type ${notification.type}`);
        return;
      }

      // Store notification in database for user dashboard
      await this.storeUserNotification(userId, notification);

      // For high severity notifications, also send email (if configured)
      if (notification.severity === 'high') {
        await this.sendUserEmail(userId, notification);
      }

      // Log the notification
      console.log(`User notification sent:`, {
        userId,
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
      });

    } catch (error) {
      console.error('Failed to notify user:', error);
    }
  }

  /**
   * Notify administrators about system events
   */
  async notifyAdministrators(notification: AdminNotification): Promise<void> {
    try {
      // Check rate limiting for admin notifications
      const cacheKey = `admin:${notification.type}:${notification.severity}`;
      if (this.isRateLimited(cacheKey)) {
        console.log(`Admin notification rate limited for type ${notification.type}`);
        return;
      }

      // Store admin notification
      await this.storeAdminNotification(notification);

      // For critical and high severity, send immediate alerts
      if (['critical', 'high'].includes(notification.severity)) {
        await this.sendAdminAlert(notification);
      }

      // Log the admin notification
      console.log(`Admin notification sent:`, {
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
      });

    } catch (error) {
      console.error('Failed to notify administrators:', error);
    }
  }

  /**
   * Notify about processing completion
   */
  async notifyProcessingComplete(
    userId: string,
    orgId: string,
    emailId: string,
    transactionId: string,
    processingStats: {
      processingTimeMs: number;
      confidence: number;
      wasTranslated: boolean;
    }
  ): Promise<void> {
    try {
      const notification: UserNotification = {
        type: 'processing_complete',
        severity: 'low',
        title: 'Receipt Processed Successfully',
        message: `Your receipt has been processed and a new transaction has been created.`,
        details: {
          transactionId,
          emailId,
          processingTimeMs: processingStats.processingTimeMs,
          confidence: processingStats.confidence,
          wasTranslated: processingStats.wasTranslated,
        },
      };

      await this.notifyUser(userId, notification);

      // Log processing completion
      await logProcessingStep(
        orgId,
        emailId,
        'processing_complete_notification',
        'completed',
        {
          userId,
          transactionId,
          ...processingStats,
        }
      );

    } catch (error) {
      console.error('Failed to notify processing completion:', error);
    }
  }

  /**
   * Store user notification in database
   */
  private async storeUserNotification(
    userId: string,
    notification: UserNotification
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          details: notification.details,
          read: false,
        });

      if (error) {
        console.error('Failed to store user notification:', error);
      }
    } catch (error) {
      console.error('Error storing user notification:', error);
    }
  }

  /**
   * Store admin notification in database
   */
  private async storeAdminNotification(notification: AdminNotification): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('admin_notifications')
        .insert({
          type: notification.type,
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          details: notification.details,
          acknowledged: false,
        });

      if (error) {
        console.error('Failed to store admin notification:', error);
      }
    } catch (error) {
      console.error('Error storing admin notification:', error);
    }
  }

  /**
   * Send email notification to user (placeholder - would integrate with email service)
   */
  private async sendUserEmail(
    userId: string,
    notification: UserNotification
  ): Promise<void> {
    try {
      // Get user email
      const { data: user, error } = await this.supabase
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (error || !user) {
        console.error('Failed to get user for email notification:', error);
        return;
      }

      // In production, this would integrate with an email service like Resend
      console.log(`Would send email to ${user.email}:`, {
        subject: notification.title,
        message: notification.message,
        severity: notification.severity,
      });

      // TODO: Integrate with email service
      // await emailService.send({
      //   to: user.email,
      //   subject: notification.title,
      //   template: 'user-notification',
      //   data: {
      //     name: user.full_name,
      //     message: notification.message,
      //     severity: notification.severity,
      //     details: notification.details,
      //   },
      // });

    } catch (error) {
      console.error('Failed to send user email:', error);
    }
  }

  /**
   * Send alert to administrators (placeholder - would integrate with alerting service)
   */
  private async sendAdminAlert(notification: AdminNotification): Promise<void> {
    try {
      // In production, this would integrate with services like:
      // - Slack webhooks
      // - PagerDuty
      // - Email alerts
      // - SMS alerts for critical issues

      console.log(`ADMIN ALERT [${notification.severity.toUpperCase()}]:`, {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        details: notification.details,
        timestamp: new Date().toISOString(),
      });

      // TODO: Integrate with alerting services
      // if (notification.severity === 'critical') {
      //   await pagerDutyService.triggerIncident({
      //     title: notification.title,
      //     description: notification.message,
      //     severity: 'critical',
      //     details: notification.details,
      //   });
      // }

      // await slackService.sendAlert({
      //   channel: '#alerts',
      //   message: `🚨 ${notification.title}: ${notification.message}`,
      //   severity: notification.severity,
      //   details: notification.details,
      // });

    } catch (error) {
      console.error('Failed to send admin alert:', error);
    }
  }

  /**
   * Check if notification type is rate limited
   */
  private isRateLimited(cacheKey: string): boolean {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW_MS;

    // Clean up old entries
    for (const [key, timestamp] of this.notificationCache.entries()) {
      if (timestamp < windowStart) {
        this.notificationCache.delete(key);
      }
    }

    // Count notifications in current window
    let count = 0;
    for (const [key, timestamp] of this.notificationCache.entries()) {
      if (key.startsWith(cacheKey.split(':').slice(0, -1).join(':')) && timestamp >= windowStart) {
        count++;
      }
    }

    if (count >= this.MAX_NOTIFICATIONS_PER_WINDOW) {
      return true;
    }

    // Add current notification to cache
    this.notificationCache.set(`${cacheKey}:${now}`, now);
    return false;
  }

  /**
   * Get unread notifications for user
   */
  async getUserNotifications(
    userId: string,
    limit = 50
  ): Promise<Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    details?: Record<string, any>;
    read: boolean;
    created_at: string;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get user notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Mark user notification as read
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to mark notification as read:', error);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get admin notifications
   */
  async getAdminNotifications(
    limit = 100
  ): Promise<Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    details?: Record<string, any>;
    acknowledged: boolean;
    created_at: string;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get admin notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting admin notifications:', error);
      return [];
    }
  }

  /**
   * Acknowledge admin notification
   */
  async acknowledgeAdminNotification(notificationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('admin_notifications')
        .update({ 
          acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Failed to acknowledge admin notification:', error);
      }
    } catch (error) {
      console.error('Error acknowledging admin notification:', error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();