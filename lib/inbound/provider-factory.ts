import {
  InboundEmailProvider,
  ProviderConfig,
  ProviderConfigurationError,
  ProviderHealthCheck,
  generateCorrelationId,
} from './types';
import { CloudflareAdapter } from './providers/cloudflare-adapter';
import { SESAdapter } from './providers/ses-adapter';
import { config } from '@/lib/config';

/**
 * Provider factory for creating and managing email providers
 * Handles provider selection, configuration validation, and health checking
 */
export class ProviderFactory {
  private static readonly SUPPORTED_PROVIDERS = ['cloudflare', 'ses'] as const;
  private static providerInstances = new Map<string, InboundEmailProvider>();
  private static healthCheckCache = new Map<string, ProviderHealthCheck>();
  private static readonly HEALTH_CHECK_TTL_MS = 60000; // 1 minute

  /**
   * Create a provider instance based on configuration
   * @param providerName Name of the provider to create
   * @param options Optional configuration overrides
   * @returns Provider instance
   */
  static createProvider(
    providerName: string,
    options?: {
      webhookSecret?: string;
      timeoutMs?: number;
      verifySignature?: boolean;
    }
  ): InboundEmailProvider {
    if (!this.isValidProvider(providerName)) {
      throw new ProviderConfigurationError(providerName, {
        message: `Unsupported provider: ${providerName}`,
        supportedProviders: this.SUPPORTED_PROVIDERS,
      });
    }

    const cacheKey = this.getCacheKey(providerName, options);
    
    // Return cached instance if available
    if (this.providerInstances.has(cacheKey)) {
      return this.providerInstances.get(cacheKey)!;
    }

    let provider: InboundEmailProvider;

    try {
      switch (providerName) {
        case 'cloudflare':
          provider = new CloudflareAdapter(
            options?.webhookSecret || config.inboundProvider.cloudflareSecret,
            options?.timeoutMs || 30000
          );
          break;

        case 'ses':
          provider = new SESAdapter(
            options?.webhookSecret || config.inboundProvider.sesSecret,
            options?.timeoutMs || 30000,
            options?.verifySignature ?? true
          );
          break;

        default:
          throw new ProviderConfigurationError(providerName, {
            message: `Provider implementation not found: ${providerName}`,
          });
      }

      // Cache the instance
      this.providerInstances.set(cacheKey, provider);
      
      return provider;
    } catch (error) {
      if (error instanceof ProviderConfigurationError) {
        throw error;
      }
      
      throw new ProviderConfigurationError(providerName, {
        message: 'Failed to create provider instance',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the default provider based on environment configuration
   * @returns Default provider instance
   */
  static getDefaultProvider(): InboundEmailProvider {
    const providerName = config.inboundProvider.provider;
    
    // During build time, create provider without strict validation
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                       process.env.NODE_ENV === undefined;
    
    if (isBuildTime) {
      // Create provider with build-time placeholders
      return this.createProvider(providerName, {
        webhookSecret: 'build-time-placeholder',
        verifySignature: false,
      });
    }
    
    return this.createProvider(providerName);
  }

  /**
   * Get provider by name with configuration validation
   * @param providerName Name of the provider
   * @returns Provider instance
   */
  static getProvider(providerName: string): InboundEmailProvider {
    this.validateProviderConfiguration(providerName);
    return this.createProvider(providerName);
  }

  /**
   * Validate provider configuration
   * @param providerName Name of the provider to validate
   */
  static validateProviderConfiguration(providerName: string): void {
    if (!this.isValidProvider(providerName)) {
      throw new ProviderConfigurationError(providerName, {
        message: `Invalid provider name: ${providerName}`,
        supportedProviders: this.SUPPORTED_PROVIDERS,
      });
    }

    // Skip validation during build time or in test environment
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                       process.env.NODE_ENV === undefined;
    
    if (config.app.nodeEnv === 'test' || isBuildTime) {
      return;
    }

    // Only validate in production runtime
    if (!config.app.isProduction) {
      return;
    }

    // Validate provider-specific configuration
    switch (providerName) {
      case 'cloudflare':
        if (!config.inboundProvider.cloudflareSecret || 
            config.inboundProvider.cloudflareSecret === 'build-time-placeholder') {
          throw new ProviderConfigurationError(providerName, {
            message: 'CLOUDFLARE_EMAIL_SECRET is required in production',
            requiredEnvVars: ['CLOUDFLARE_EMAIL_SECRET'],
          });
        }
        break;

      case 'ses':
        if (!config.inboundProvider.sesSecret || 
            config.inboundProvider.sesSecret === 'build-time-placeholder') {
          throw new ProviderConfigurationError(providerName, {
            message: 'SES_WEBHOOK_SECRET is required in production',
            requiredEnvVars: ['SES_WEBHOOK_SECRET'],
          });
        }
        break;
    }
  }

  /**
   * Perform health check on a provider
   * @param providerName Name of the provider to check
   * @param useCache Whether to use cached health check results
   * @returns Health check result
   */
  static async performHealthCheck(
    providerName: string,
    useCache: boolean = true
  ): Promise<ProviderHealthCheck> {
    const correlationId = generateCorrelationId();
    
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = this.healthCheckCache.get(providerName);
        if (cached && this.isHealthCheckValid(cached)) {
          return cached;
        }
      }

      const startTime = Date.now();
      
      // Validate configuration first
      try {
        this.validateProviderConfiguration(providerName);
      } catch (error) {
        const errorMessage = error instanceof ProviderConfigurationError 
          ? error.message 
          : error instanceof Error 
            ? error.message 
            : String(error);
            
        const healthCheck: ProviderHealthCheck = {
          provider: providerName,
          healthy: false,
          lastChecked: new Date(),
          error: errorMessage,
          details: {
            correlationId,
            configurationValid: false,
            originalError: error instanceof ProviderConfigurationError ? error.details : undefined,
          },
        };
        
        this.healthCheckCache.set(providerName, healthCheck);
        return healthCheck;
      }

      // Create provider and perform health check
      const provider = this.createProvider(providerName);
      
      let providerHealthResult: any = { healthy: true };
      
      // Call provider-specific health check if available
      if ('healthCheck' in provider && typeof provider.healthCheck === 'function') {
        providerHealthResult = await provider.healthCheck();
      }

      const responseTimeMs = Date.now() - startTime;
      
      const healthCheck: ProviderHealthCheck = {
        provider: providerName,
        healthy: providerHealthResult.healthy ?? true,
        lastChecked: new Date(),
        responseTimeMs: providerHealthResult.responseTimeMs ?? responseTimeMs,
        error: providerHealthResult.error,
        details: {
          correlationId,
          configurationValid: true,
          ...providerHealthResult.details,
        },
      };

      // Cache the result
      this.healthCheckCache.set(providerName, healthCheck);
      
      return healthCheck;
    } catch (error) {
      const healthCheck: ProviderHealthCheck = {
        provider: providerName,
        healthy: false,
        lastChecked: new Date(),
        responseTimeMs: Date.now() - Date.now(),
        error: error instanceof Error ? error.message : String(error),
        details: {
          correlationId,
          unexpectedError: true,
        },
      };
      
      this.healthCheckCache.set(providerName, healthCheck);
      return healthCheck;
    }
  }

  /**
   * Perform health checks on all supported providers
   * @param useCache Whether to use cached results
   * @returns Map of provider health checks
   */
  static async performAllHealthChecks(
    useCache: boolean = true
  ): Promise<Map<string, ProviderHealthCheck>> {
    const results = new Map<string, ProviderHealthCheck>();
    
    const healthCheckPromises = this.SUPPORTED_PROVIDERS.map(async (providerName) => {
      try {
        const healthCheck = await this.performHealthCheck(providerName, useCache);
        results.set(providerName, healthCheck);
      } catch (error) {
        results.set(providerName, {
          provider: providerName,
          healthy: false,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : String(error),
          details: {
            correlationId: generateCorrelationId(),
            healthCheckFailed: true,
          },
        });
      }
    });

    await Promise.all(healthCheckPromises);
    return results;
  }

  /**
   * Get fallback provider for the given provider
   * @param currentProvider Current provider name
   * @returns Fallback provider name or null if none available
   */
  static getFallbackProvider(currentProvider: string): string | null {
    // Simple fallback logic - in production you might have more sophisticated rules
    switch (currentProvider) {
      case 'cloudflare':
        return this.isProviderConfigured('ses') ? 'ses' : null;
      case 'ses':
        return this.isProviderConfigured('cloudflare') ? 'cloudflare' : null;
      default:
        return null;
    }
  }

  /**
   * Check if a provider is properly configured
   * @param providerName Provider name to check
   * @returns True if configured, false otherwise
   */
  static isProviderConfigured(providerName: string): boolean {
    try {
      this.validateProviderConfiguration(providerName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get provider configuration summary
   * @param providerName Provider name
   * @returns Configuration summary
   */
  static getProviderConfig(providerName: string): ProviderConfig {
    if (!this.isValidProvider(providerName)) {
      throw new ProviderConfigurationError(providerName, {
        message: `Invalid provider name: ${providerName}`,
      });
    }

    const isConfigured = this.isProviderConfigured(providerName);
    
    return {
      name: providerName,
      enabled: isConfigured,
      config: this.getProviderSpecificConfig(providerName),
      webhookSecret: this.getProviderSecret(providerName) ? '[CONFIGURED]' : undefined,
      timeoutMs: 30000,
    };
  }

  /**
   * List all supported providers with their configuration status
   * @returns Array of provider configurations
   */
  static listProviders(): ProviderConfig[] {
    return this.SUPPORTED_PROVIDERS.map(providerName => 
      this.getProviderConfig(providerName)
    );
  }

  /**
   * Clear provider cache (useful for testing or configuration changes)
   */
  static clearCache(): void {
    this.providerInstances.clear();
    this.healthCheckCache.clear();
  }

  /**
   * Get provider-specific logging context
   * @param providerName Provider name
   * @returns Logging context object
   */
  static getProviderLoggingContext(providerName: string): Record<string, any> {
    return {
      provider: providerName,
      isConfigured: this.isProviderConfigured(providerName),
      isDefault: providerName === config.inboundProvider.provider,
      environment: config.app.nodeEnv,
      hasSecret: !!this.getProviderSecret(providerName),
    };
  }

  // Private helper methods

  private static isValidProvider(providerName: string): providerName is typeof this.SUPPORTED_PROVIDERS[number] {
    return this.SUPPORTED_PROVIDERS.includes(providerName as any);
  }

  private static getCacheKey(providerName: string, options?: any): string {
    const optionsHash = options ? JSON.stringify(options) : '';
    return `${providerName}:${optionsHash}`;
  }

  private static isHealthCheckValid(healthCheck: ProviderHealthCheck): boolean {
    const age = Date.now() - healthCheck.lastChecked.getTime();
    return age < this.HEALTH_CHECK_TTL_MS;
  }

  private static getProviderSecret(providerName: string): string | undefined {
    switch (providerName) {
      case 'cloudflare':
        return config.inboundProvider.cloudflareSecret;
      case 'ses':
        return config.inboundProvider.sesSecret;
      default:
        return undefined;
    }
  }

  private static getProviderSpecificConfig(providerName: string): Record<string, any> {
    const baseConfig = {
      timeoutMs: 30000,
      environment: config.app.nodeEnv,
    };

    switch (providerName) {
      case 'cloudflare':
        return {
          ...baseConfig,
          type: 'cloudflare-workers-email-routing',
          hmacAlgorithm: 'sha256',
        };
      case 'ses':
        return {
          ...baseConfig,
          type: 'amazon-ses-sns',
          signatureVersion: '1',
          verifySignature: true,
        };
      default:
        return baseConfig;
    }
  }
}

/**
 * Convenience function to get the default provider
 */
export function getDefaultProvider(): InboundEmailProvider {
  return ProviderFactory.getDefaultProvider();
}

/**
 * Convenience function to create a provider by name
 */
export function createProvider(providerName: string): InboundEmailProvider {
  return ProviderFactory.createProvider(providerName);
}

/**
 * Convenience function to perform health check
 */
export async function checkProviderHealth(providerName: string): Promise<ProviderHealthCheck> {
  return ProviderFactory.performHealthCheck(providerName);
}

/**
 * Convenience function to get provider configuration
 */
export function getProviderConfig(providerName: string): ProviderConfig {
  return ProviderFactory.getProviderConfig(providerName);
}

/**
 * Provider switching utility with fallback support
 */
export class ProviderSwitcher {
  private currentProvider: string;
  private fallbackProvider: string | null;

  constructor(primaryProvider?: string) {
    this.currentProvider = primaryProvider || config.inboundProvider.provider;
    this.fallbackProvider = ProviderFactory.getFallbackProvider(this.currentProvider);
  }

  /**
   * Get the current active provider
   */
  async getActiveProvider(): Promise<InboundEmailProvider> {
    // Check if current provider is healthy
    const healthCheck = await ProviderFactory.performHealthCheck(this.currentProvider);
    
    if (healthCheck.healthy) {
      return ProviderFactory.createProvider(this.currentProvider);
    }

    // Try fallback if available
    if (this.fallbackProvider) {
      const fallbackHealth = await ProviderFactory.performHealthCheck(this.fallbackProvider);
      
      if (fallbackHealth.healthy) {
        return ProviderFactory.createProvider(this.fallbackProvider);
      }
    }

    // Return current provider even if unhealthy (let it fail with proper error)
    return ProviderFactory.createProvider(this.currentProvider);
  }

  /**
   * Switch to a different provider
   */
  switchProvider(newProvider: string): void {
    ProviderFactory.validateProviderConfiguration(newProvider);
    this.currentProvider = newProvider;
    this.fallbackProvider = ProviderFactory.getFallbackProvider(newProvider);
  }

  /**
   * Get current provider status
   */
  async getStatus(): Promise<{
    current: string;
    fallback: string | null;
    currentHealthy: boolean;
    fallbackHealthy: boolean | null;
  }> {
    const currentHealth = await ProviderFactory.performHealthCheck(this.currentProvider);
    let fallbackHealthy: boolean | null = null;

    if (this.fallbackProvider) {
      const fallbackHealth = await ProviderFactory.performHealthCheck(this.fallbackProvider);
      fallbackHealthy = fallbackHealth.healthy;
    }

    return {
      current: this.currentProvider,
      fallback: this.fallbackProvider,
      currentHealthy: currentHealth.healthy,
      fallbackHealthy,
    };
  }
}