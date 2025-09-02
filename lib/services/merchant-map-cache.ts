/**
 * Merchant Map Caching Service
 * Provides in-memory caching for frequently accessed merchant mappings
 * to reduce database queries and improve performance
 */

import { MerchantMapping } from '@/lib/types';

interface CacheEntry {
  mapping: MerchantMapping | null;
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
}

export class MerchantMapCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(maxSize = 1000, ttlMinutes = 30) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate cache key for org and merchant combination
   */
  private getCacheKey(orgId: string, merchantName: string): string {
    return `${orgId}:${merchantName.toLowerCase().trim()}`;
  }

  /**
   * Get merchant mapping from cache
   */
  get(orgId: string, merchantName: string): MerchantMapping | null | undefined {
    this.stats.totalRequests++;
    
    const key = this.getCacheKey(orgId, merchantName);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.cacheMisses++;
      return undefined; // Not in cache
    }
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.cacheMisses++;
      return undefined;
    }
    
    // Update hit count and return cached value
    entry.hitCount++;
    this.stats.cacheHits++;
    return entry.mapping;
  }

  /**
   * Set merchant mapping in cache
   */
  set(orgId: string, merchantName: string, mapping: MerchantMapping | null): void {
    const key = this.getCacheKey(orgId, merchantName);
    
    // If cache is at max size, remove least recently used entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      mapping,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  /**
   * Invalidate cache entry for specific merchant
   */
  invalidate(orgId: string, merchantName: string): void {
    const key = this.getCacheKey(orgId, merchantName);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for an organization
   */
  invalidateOrg(orgId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${orgId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    let lowestHitCount = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      // Prioritize by hit count, then by age
      if (entry.hitCount < lowestHitCount || 
          (entry.hitCount === lowestHitCount && entry.timestamp < oldestTimestamp)) {
        oldestKey = key;
        oldestTimestamp = entry.timestamp;
        lowestHitCount = entry.hitCount;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100 
      : 0;
    
    // Estimate memory usage (rough calculation)
    const avgKeySize = 50; // bytes
    const avgValueSize = 200; // bytes
    const memoryUsage = this.cache.size * (avgKeySize + avgValueSize);
    
    return {
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalEntries: this.cache.size,
      memoryUsage
    };
  }

  /**
   * Get most frequently accessed merchants
   */
  getTopMerchants(limit = 10): Array<{ key: string; hitCount: number; lastAccessed: Date }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        hitCount: entry.hitCount,
        lastAccessed: new Date(entry.timestamp)
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
    
    return entries;
  }

  /**
   * Warm cache with frequently used merchants
   */
  async warmCache(merchantMappings: Array<{ orgId: string; merchantName: string; mapping: MerchantMapping }>): Promise<void> {
    for (const { orgId, merchantName, mapping } of merchantMappings) {
      this.set(orgId, merchantName, mapping);
    }
  }
}

// Global cache instance
export const merchantMapCache = new MerchantMapCache();

// Cache warming utility
export async function warmMerchantMapCache(supabase: any): Promise<void> {
  try {
    // Get most frequently used merchants from the last 30 days
    const { data: frequentMerchants } = await supabase
      .from('transactions')
      .select('org_id, merchant')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500);

    if (!frequentMerchants) return;

    // Group by org and merchant
    const merchantCounts = new Map<string, { orgId: string; merchantName: string; count: number }>();
    
    for (const { org_id, merchant } of frequentMerchants) {
      const key = `${org_id}:${merchant}`;
      const existing = merchantCounts.get(key);
      
      if (existing) {
        existing.count++;
      } else {
        merchantCounts.set(key, { orgId: org_id, merchantName: merchant, count: 1 });
      }
    }

    // Get top merchants and their mappings
    const topMerchants = Array.from(merchantCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 200);

    // Fetch mappings for top merchants
    const mappingPromises = topMerchants.map(async ({ orgId, merchantName }) => {
      const { data: mapping } = await supabase
        .from('merchant_map')
        .select('*')
        .eq('org_id', orgId)
        .eq('merchant_name', merchantName)
        .single();

      return { orgId, merchantName, mapping };
    });

    const mappings = await Promise.all(mappingPromises);
    await merchantMapCache.warmCache(mappings);
    
    console.log(`Warmed merchant map cache with ${mappings.length} entries`);
  } catch (error) {
    console.error('Failed to warm merchant map cache:', error);
  }
}