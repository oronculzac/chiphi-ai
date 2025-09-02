import { 
  InboundEmailProvider, 
  ProviderRegistry, 
  ProviderConfigurationError,
  ProviderHealthCheck 
} from './types';

/**
 * Provider registry implementation for managing email providers
 */
export class EmailProviderRegistry implements ProviderRegistry {
  private providers = new Map<string, InboundEmailProvider>();
  private healthChecks = new Map<string, ProviderHealthCheck>();

  /**
   * Register a new email provider
   */
  register(name: string, provider: InboundEmailProvider): void {
    if (!name || typeof name !== 'string') {
      throw new ProviderConfigurationError('registry', {
        error: 'Provider name must be a non-empty string',
        name,
      });
    }

    if (!provider || typeof provider !== 'object') {
      throw new ProviderConfigurationError('registry', {
        error: 'Provider must be a valid object implementing InboundEmailProvider',
        name,
      });
    }

    // Validate provider implements required methods
    if (typeof provider.verify !== 'function') {
      throw new ProviderConfigurationError('registry', {
        error: 'Provider must implement verify method',
        name,
      });
    }

    if (typeof provider.parse !== 'function') {
      throw new ProviderConfigurationError('registry', {
        error: 'Provider must implement parse method',
        name,
      });
    }

    if (typeof provider.getName !== 'function') {
      throw new ProviderConfigurationError('registry', {
        error: 'Provider must implement getName method',
        name,
      });
    }

    this.providers.set(name, provider);
    
    // Initialize health check
    this.healthChecks.set(name, {
      provider: name,
      healthy: true,
      lastChecked: new Date(),
    });
  }

  /**
   * Get a provider by name
   */
  get(name: string): InboundEmailProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * List all registered provider names
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  isRegistered(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Unregister a provider
   */
  unregister(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) {
      this.healthChecks.delete(name);
    }
    return removed;
  }

  /**
   * Get all registered providers
   */
  getAll(): Map<string, InboundEmailProvider> {
    return new Map(this.providers);
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
    this.healthChecks.clear();
  }

  /**
   * Get provider count
   */
  size(): number {
    return this.providers.size;
  }

  /**
   * Update provider health status
   */
  updateHealthCheck(name: string, healthCheck: Partial<ProviderHealthCheck>): void {
    const existing = this.healthChecks.get(name);
    if (existing) {
      this.healthChecks.set(name, {
        ...existing,
        ...healthCheck,
        provider: name,
        lastChecked: new Date(),
      });
    }
  }

  /**
   * Get provider health status
   */
  getHealthCheck(name: string): ProviderHealthCheck | undefined {
    return this.healthChecks.get(name);
  }

  /**
   * Get all provider health checks
   */
  getAllHealthChecks(): Map<string, ProviderHealthCheck> {
    return new Map(this.healthChecks);
  }

  /**
   * Check if all providers are healthy
   */
  areAllProvidersHealthy(): boolean {
    for (const healthCheck of this.healthChecks.values()) {
      if (!healthCheck.healthy) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get unhealthy providers
   */
  getUnhealthyProviders(): string[] {
    const unhealthy: string[] = [];
    for (const [name, healthCheck] of this.healthChecks.entries()) {
      if (!healthCheck.healthy) {
        unhealthy.push(name);
      }
    }
    return unhealthy;
  }

  /**
   * Perform health check on a specific provider
   */
  async performHealthCheck(name: string): Promise<ProviderHealthCheck> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ProviderConfigurationError('registry', {
        error: 'Provider not found',
        name,
      });
    }

    const startTime = Date.now();
    let healthy = true;
    let error: string | undefined;

    try {
      // Basic health check - verify provider can be instantiated and has required methods
      if (typeof provider.verify !== 'function' || 
          typeof provider.parse !== 'function' || 
          typeof provider.getName !== 'function') {
        throw new Error('Provider missing required methods');
      }

      // Additional provider-specific health checks could be added here
      // For now, we just verify the provider is properly configured
      
    } catch (err) {
      healthy = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const responseTimeMs = Date.now() - startTime;
    
    const healthCheck: ProviderHealthCheck = {
      provider: name,
      healthy,
      lastChecked: new Date(),
      responseTimeMs,
      error,
    };

    this.updateHealthCheck(name, healthCheck);
    return healthCheck;
  }

  /**
   * Perform health checks on all providers
   */
  async performAllHealthChecks(): Promise<Map<string, ProviderHealthCheck>> {
    const results = new Map<string, ProviderHealthCheck>();
    
    for (const name of this.providers.keys()) {
      try {
        const healthCheck = await this.performHealthCheck(name);
        results.set(name, healthCheck);
      } catch (error) {
        const healthCheck: ProviderHealthCheck = {
          provider: name,
          healthy: false,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.set(name, healthCheck);
        this.updateHealthCheck(name, healthCheck);
      }
    }

    return results;
  }
}

/**
 * Global provider registry instance
 */
export const globalProviderRegistry = new EmailProviderRegistry();