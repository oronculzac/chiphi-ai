/**
 * Real-time Subscription Optimizer
 * Optimizes Supabase real-time subscriptions for dashboard updates
 * with throttling, batching, and intelligent filtering
 */

import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  throttleMs?: number;
  batchSize?: number;
  priority?: 'high' | 'medium' | 'low';
}

export interface OptimizedSubscription {
  id: string;
  config: SubscriptionConfig;
  channel: RealtimeChannel;
  lastUpdate: number;
  pendingUpdates: RealtimePostgresChangesPayload<any>[];
  callback: (updates: RealtimePostgresChangesPayload<any>[]) => void;
  isActive: boolean;
}

export class RealtimeOptimizer {
  private supabase;
  private subscriptions = new Map<string, OptimizedSubscription>();
  private processingQueue: string[] = [];
  private isProcessing = false;
  private globalThrottleMs = 1000; // Global throttle for all updates

  constructor() {
    this.supabase = createClient();
    
    // Process queued updates periodically
    setInterval(() => this.processQueue(), 100);
  }

  /**
   * Create an optimized subscription with intelligent batching and throttling
   */
  subscribe(
    config: SubscriptionConfig,
    callback: (updates: RealtimePostgresChangesPayload<any>[]) => void
  ): string {
    const subscriptionId = this.generateSubscriptionId(config);
    
    // Check if subscription already exists
    if (this.subscriptions.has(subscriptionId)) {
      console.warn(`Subscription ${subscriptionId} already exists`);
      return subscriptionId;
    }

    // Create Supabase channel
    const channel = this.supabase
      .channel(`optimized_${subscriptionId}`)
      .on(
        'postgres_changes',
        {
          event: config.event,
          schema: 'public',
          table: config.table,
          filter: config.filter
        },
        (payload) => this.handleRealtimeUpdate(subscriptionId, payload)
      );

    // Subscribe to channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Optimized subscription ${subscriptionId} active`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Subscription ${subscriptionId} error`);
        this.handleSubscriptionError(subscriptionId);
      }
    });

    // Store subscription
    const subscription: OptimizedSubscription = {
      id: subscriptionId,
      config: {
        ...config,
        throttleMs: config.throttleMs || this.getDefaultThrottle(config.priority),
        batchSize: config.batchSize || this.getDefaultBatchSize(config.priority)
      },
      channel,
      lastUpdate: 0,
      pendingUpdates: [],
      callback,
      isActive: true
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a real-time subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Unsubscribe from Supabase channel
    subscription.channel.unsubscribe();
    subscription.isActive = false;

    // Process any pending updates before removing
    if (subscription.pendingUpdates.length > 0) {
      this.flushPendingUpdates(subscriptionId);
    }

    this.subscriptions.delete(subscriptionId);
    console.log(`Unsubscribed from ${subscriptionId}`);
  }

  /**
   * Pause a subscription temporarily
   */
  pauseSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
    }
  }

  /**
   * Resume a paused subscription
   */
  resumeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = true;
    }
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    pendingUpdates: number;
    averageThrottle: number;
  } {
    const subscriptions = Array.from(this.subscriptions.values());
    const activeCount = subscriptions.filter(s => s.isActive).length;
    const totalPending = subscriptions.reduce((sum, s) => sum + s.pendingUpdates.length, 0);
    const avgThrottle = subscriptions.reduce((sum, s) => sum + (s.config.throttleMs || 0), 0) / subscriptions.length;

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeCount,
      pendingUpdates: totalPending,
      averageThrottle: avgThrottle || 0
    };
  }

  /**
   * Handle incoming real-time update
   */
  private handleRealtimeUpdate(
    subscriptionId: string,
    payload: RealtimePostgresChangesPayload<any>
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !subscription.isActive) return;

    // Add to pending updates
    subscription.pendingUpdates.push(payload);

    // Add to processing queue if not already queued
    if (!this.processingQueue.includes(subscriptionId)) {
      this.processingQueue.push(subscriptionId);
    }

    // Immediate flush for high priority updates
    if (subscription.config.priority === 'high') {
      this.flushPendingUpdates(subscriptionId);
    }
  }

  /**
   * Process the queue of pending updates
   */
  private processQueue(): void {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;
    const now = Date.now();

    // Process subscriptions in priority order
    const sortedQueue = this.processingQueue.sort((a, b) => {
      const subA = this.subscriptions.get(a);
      const subB = this.subscriptions.get(b);
      
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityA = priorityOrder[subA?.config.priority || 'medium'];
      const priorityB = priorityOrder[subB?.config.priority || 'medium'];
      
      return priorityB - priorityA;
    });

    for (const subscriptionId of sortedQueue) {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription || !subscription.isActive) {
        this.removeFromQueue(subscriptionId);
        continue;
      }

      // Check if enough time has passed since last update
      const timeSinceLastUpdate = now - subscription.lastUpdate;
      const throttleMs = subscription.config.throttleMs || this.globalThrottleMs;

      if (timeSinceLastUpdate >= throttleMs || subscription.config.priority === 'high') {
        this.flushPendingUpdates(subscriptionId);
        this.removeFromQueue(subscriptionId);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Flush pending updates for a subscription
   */
  private flushPendingUpdates(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || subscription.pendingUpdates.length === 0) return;

    const updates = [...subscription.pendingUpdates];
    subscription.pendingUpdates = [];
    subscription.lastUpdate = Date.now();

    // Batch updates if configured
    const batchSize = subscription.config.batchSize || updates.length;
    const batches = this.chunkArray(updates, batchSize);

    for (const batch of batches) {
      try {
        subscription.callback(batch);
      } catch (error) {
        console.error(`Error processing updates for ${subscriptionId}:`, error);
      }
    }
  }

  /**
   * Handle subscription errors with retry logic
   */
  private handleSubscriptionError(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    console.error(`Subscription ${subscriptionId} encountered an error, attempting to reconnect...`);
    
    // Pause subscription temporarily
    subscription.isActive = false;

    // Attempt to reconnect after a delay
    setTimeout(() => {
      if (this.subscriptions.has(subscriptionId)) {
        this.reconnectSubscription(subscriptionId);
      }
    }, 5000);
  }

  /**
   * Reconnect a failed subscription
   */
  private reconnectSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Unsubscribe from old channel
    subscription.channel.unsubscribe();

    // Create new channel
    const newChannel = this.supabase
      .channel(`optimized_${subscriptionId}_reconnect_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: subscription.config.event,
          schema: 'public',
          table: subscription.config.table,
          filter: subscription.config.filter
        },
        (payload) => this.handleRealtimeUpdate(subscriptionId, payload)
      );

    // Subscribe to new channel
    newChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscription.channel = newChannel;
        subscription.isActive = true;
        console.log(`Subscription ${subscriptionId} reconnected successfully`);
      }
    });
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(config: SubscriptionConfig): string {
    const parts = [
      config.table,
      config.event,
      config.filter || 'no-filter'
    ];
    return parts.join('_').replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Get default throttle based on priority
   */
  private getDefaultThrottle(priority?: string): number {
    switch (priority) {
      case 'high': return 100;
      case 'medium': return 1000;
      case 'low': return 5000;
      default: return 1000;
    }
  }

  /**
   * Get default batch size based on priority
   */
  private getDefaultBatchSize(priority?: string): number {
    switch (priority) {
      case 'high': return 1;
      case 'medium': return 5;
      case 'low': return 10;
      default: return 5;
    }
  }

  /**
   * Remove subscription from processing queue
   */
  private removeFromQueue(subscriptionId: string): void {
    const index = this.processingQueue.indexOf(subscriptionId);
    if (index > -1) {
      this.processingQueue.splice(index, 1);
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Dashboard-specific subscription helpers
export class DashboardSubscriptionManager {
  private optimizer: RealtimeOptimizer;
  private subscriptions: string[] = [];

  constructor() {
    this.optimizer = new RealtimeOptimizer();
  }

  /**
   * Subscribe to transaction updates for dashboard
   */
  subscribeToTransactions(
    orgId: string,
    callback: (updates: any[]) => void
  ): string {
    const subscriptionId = this.optimizer.subscribe(
      {
        table: 'transactions',
        event: '*',
        filter: `org_id=eq.${orgId}`,
        throttleMs: 2000, // 2 second throttle for dashboard updates
        batchSize: 10,
        priority: 'medium'
      },
      callback
    );

    this.subscriptions.push(subscriptionId);
    return subscriptionId;
  }

  /**
   * Subscribe to merchant map updates
   */
  subscribeToMerchantMap(
    orgId: string,
    callback: (updates: any[]) => void
  ): string {
    const subscriptionId = this.optimizer.subscribe(
      {
        table: 'merchant_map',
        event: '*',
        filter: `org_id=eq.${orgId}`,
        throttleMs: 5000, // 5 second throttle for merchant map
        batchSize: 5,
        priority: 'low'
      },
      callback
    );

    this.subscriptions.push(subscriptionId);
    return subscriptionId;
  }

  /**
   * Subscribe to high-priority email processing updates
   */
  subscribeToEmailProcessing(
    orgId: string,
    callback: (updates: any[]) => void
  ): string {
    const subscriptionId = this.optimizer.subscribe(
      {
        table: 'emails',
        event: 'UPDATE',
        filter: `org_id=eq.${orgId}`,
        throttleMs: 500, // Fast updates for email processing
        batchSize: 1,
        priority: 'high'
      },
      callback
    );

    this.subscriptions.push(subscriptionId);
    return subscriptionId;
  }

  /**
   * Cleanup all dashboard subscriptions
   */
  cleanup(): void {
    for (const subscriptionId of this.subscriptions) {
      this.optimizer.unsubscribe(subscriptionId);
    }
    this.subscriptions = [];
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    return this.optimizer.getSubscriptionStats();
  }
}

// Global instances
export const realtimeOptimizer = new RealtimeOptimizer();
export const dashboardSubscriptionManager = new DashboardSubscriptionManager();