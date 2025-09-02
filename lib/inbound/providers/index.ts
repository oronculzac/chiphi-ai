/**
 * Email Provider Adapters
 * 
 * This module exports all available email provider adapters
 * that implement the InboundEmailProvider interface.
 */

// Cloudflare Workers Email Routing adapter
export {
  CloudflareAdapter,
  createCloudflareAdapter,
  defaultCloudflareAdapter,
} from './cloudflare-adapter';

// Amazon SES adapter
export {
  SESAdapter,
  createSESAdapter,
  defaultSESAdapter,
} from './ses-adapter';

// Provider factory for creating adapters by name
import { InboundEmailProvider } from '../types';
import { CloudflareAdapter } from './cloudflare-adapter';
import { SESAdapter } from './ses-adapter';
import { config } from '@/lib/config';

/**
 * Provider factory class for creating email provider instances
 */
export class ProviderFactory {
  /**
   * Create a provider instance by name
   * @param providerName Name of the provider ('cloudflare' or 'ses')
   * @param options Optional configuration for the provider
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
    switch (providerName.toLowerCase()) {
      case 'cloudflare':
        return new CloudflareAdapter(
          options?.webhookSecret || config.inboundProvider.cloudflareSecret,
          options?.timeoutMs || 30000
        );
      
      case 'ses':
        return new SESAdapter(
          options?.webhookSecret || config.inboundProvider.sesSecret,
          options?.timeoutMs || 30000,
          options?.verifySignature ?? true
        );
      
      default:
        throw new Error(`Unknown email provider: ${providerName}`);
    }
  }

  /**
   * Get the default provider based on environment configuration
   * @returns Default provider instance
   */
  static getDefaultProvider(): InboundEmailProvider {
    return this.createProvider(config.inboundProvider.provider);
  }

  /**
   * Get list of supported provider names
   * @returns Array of supported provider names
   */
  static getSupportedProviders(): string[] {
    return ['cloudflare', 'ses'];
  }

  /**
   * Check if a provider name is supported
   * @param providerName Name to check
   * @returns True if supported, false otherwise
   */
  static isProviderSupported(providerName: string): boolean {
    return this.getSupportedProviders().includes(providerName.toLowerCase());
  }
}

/**
 * Get the currently configured provider instance
 */
export function getCurrentProvider(): InboundEmailProvider {
  return ProviderFactory.getDefaultProvider();
}

/**
 * Provider health check utility
 */
export async function checkProviderHealth(
  provider: InboundEmailProvider
): Promise<{
  provider: string;
  healthy: boolean;
  lastChecked: Date;
  responseTimeMs?: number;
  error?: string;
  details?: Record<string, any>;
}> {
  const startTime = Date.now();
  
  try {
    // Check if provider has health check method
    if ('healthCheck' in provider && typeof provider.healthCheck === 'function') {
      const result = await (provider as any).healthCheck();
      return {
        provider: provider.getName(),
        healthy: result.healthy,
        lastChecked: new Date(),
        responseTimeMs: result.responseTimeMs,
        error: result.error,
        details: result.details,
      };
    }
    
    // Fallback basic health check
    return {
      provider: provider.getName(),
      healthy: true,
      lastChecked: new Date(),
      responseTimeMs: Date.now() - startTime,
      details: {
        message: 'Basic health check - provider instance exists',
      },
    };
  } catch (error) {
    return {
      provider: provider.getName(),
      healthy: false,
      lastChecked: new Date(),
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check health of all supported providers
 */
export async function checkAllProvidersHealth(): Promise<Array<{
  provider: string;
  healthy: boolean;
  lastChecked: Date;
  responseTimeMs?: number;
  error?: string;
  details?: Record<string, any>;
}>> {
  const results = [];
  
  for (const providerName of ProviderFactory.getSupportedProviders()) {
    try {
      const provider = ProviderFactory.createProvider(providerName);
      const health = await checkProviderHealth(provider);
      results.push(health);
    } catch (error) {
      results.push({
        provider: providerName,
        healthy: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return results;
}