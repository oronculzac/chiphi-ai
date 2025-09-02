import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFactory, ProviderSwitcher } from '../provider-factory';
import { config } from '@/lib/config';

// Mock the config module for integration tests
vi.mock('@/lib/config', () => ({
  config: {
    inboundProvider: {
      provider: 'cloudflare',
      cloudflareSecret: 'test-secret',
      sesSecret: 'test-ses-secret',
    },
    app: {
      nodeEnv: 'test',
      isDevelopment: true,
      isProduction: false,
    },
  },
}));

describe('ProviderFactory Integration Tests', () => {
  beforeEach(() => {
    ProviderFactory.clearCache();
  });

  describe('Provider Creation and Switching', () => {
    it('should create and switch between providers seamlessly', async () => {
      // Create initial provider
      const cloudflareProvider = ProviderFactory.createProvider('cloudflare');
      expect(cloudflareProvider.getName()).toBe('cloudflare');

      // Create SES provider
      const sesProvider = ProviderFactory.createProvider('ses');
      expect(sesProvider.getName()).toBe('ses');

      // Verify they are different instances
      expect(cloudflareProvider).not.toBe(sesProvider);
    });

    it('should handle provider switching with health checks', async () => {
      const switcher = new ProviderSwitcher('cloudflare');
      
      // Get initial status
      const initialStatus = await switcher.getStatus();
      expect(initialStatus.current).toBe('cloudflare');
      expect(initialStatus.fallback).toBe('ses');

      // Switch to SES
      switcher.switchProvider('ses');
      
      const newStatus = await switcher.getStatus();
      expect(newStatus.current).toBe('ses');
      expect(newStatus.fallback).toBe('cloudflare');
    });

    it('should provide comprehensive health checks for all providers', async () => {
      const healthChecks = await ProviderFactory.performAllHealthChecks(false);
      
      expect(healthChecks.size).toBe(2);
      expect(healthChecks.has('cloudflare')).toBe(true);
      expect(healthChecks.has('ses')).toBe(true);

      const cloudflareHealth = healthChecks.get('cloudflare')!;
      const sesHealth = healthChecks.get('ses')!;

      expect(cloudflareHealth.provider).toBe('cloudflare');
      expect(sesHealth.provider).toBe('ses');
      expect(cloudflareHealth.lastChecked).toBeInstanceOf(Date);
      expect(sesHealth.lastChecked).toBeInstanceOf(Date);
    });

    it('should list all providers with their configurations', () => {
      const providers = ProviderFactory.listProviders();
      
      expect(providers).toHaveLength(2);
      
      const cloudflareConfig = providers.find(p => p.name === 'cloudflare');
      const sesConfig = providers.find(p => p.name === 'ses');
      
      expect(cloudflareConfig).toBeDefined();
      expect(sesConfig).toBeDefined();
      
      expect(cloudflareConfig!.config.type).toBe('cloudflare-workers-email-routing');
      expect(sesConfig!.config.type).toBe('amazon-ses-sns');
    });

    it('should provide proper logging context for monitoring', () => {
      const cloudflareContext = ProviderFactory.getProviderLoggingContext('cloudflare');
      const sesContext = ProviderFactory.getProviderLoggingContext('ses');
      
      expect(cloudflareContext).toMatchObject({
        provider: 'cloudflare',
        isDefault: true,
        environment: 'test',
      });
      
      expect(sesContext).toMatchObject({
        provider: 'ses',
        isDefault: false,
        environment: 'test',
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid provider names gracefully', () => {
      expect(() => {
        ProviderFactory.createProvider('invalid-provider');
      }).toThrow('Unsupported provider: invalid-provider');
    });

    it('should provide fallback mechanisms', () => {
      const cloudflareToSes = ProviderFactory.getFallbackProvider('cloudflare');
      const sesToCloudflare = ProviderFactory.getFallbackProvider('ses');
      
      expect(cloudflareToSes).toBe('ses');
      expect(sesToCloudflare).toBe('cloudflare');
    });

    it('should cache providers for performance', () => {
      const provider1 = ProviderFactory.createProvider('cloudflare');
      const provider2 = ProviderFactory.createProvider('cloudflare');
      
      // Should return the same cached instance
      expect(provider1).toBe(provider2);
      
      // Clear cache and create new instance
      ProviderFactory.clearCache();
      const provider3 = ProviderFactory.createProvider('cloudflare');
      
      // Should be a different instance after cache clear
      expect(provider1).not.toBe(provider3);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate provider configurations correctly', () => {
      expect(() => {
        ProviderFactory.validateProviderConfiguration('cloudflare');
      }).not.toThrow();
      
      expect(() => {
        ProviderFactory.validateProviderConfiguration('ses');
      }).not.toThrow();
    });

    it('should check if providers are properly configured', () => {
      expect(ProviderFactory.isProviderConfigured('cloudflare')).toBe(true);
      expect(ProviderFactory.isProviderConfigured('ses')).toBe(true);
    });

    it('should provide detailed provider configurations', () => {
      const cloudflareConfig = ProviderFactory.getProviderConfig('cloudflare');
      const sesConfig = ProviderFactory.getProviderConfig('ses');
      
      expect(cloudflareConfig).toMatchObject({
        name: 'cloudflare',
        enabled: true,
        timeoutMs: 30000,
      });
      
      expect(sesConfig).toMatchObject({
        name: 'ses',
        enabled: true,
        timeoutMs: 30000,
      });
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical email processing workflow', async () => {
      // Get default provider (as would happen in API route)
      const defaultProvider = ProviderFactory.getDefaultProvider();
      expect(defaultProvider.getName()).toBe('cloudflare');
      
      // Perform health check before processing
      const healthCheck = await ProviderFactory.performHealthCheck('cloudflare');
      expect(healthCheck.provider).toBe('cloudflare');
      
      // Get provider configuration for logging
      const config = ProviderFactory.getProviderConfig('cloudflare');
      expect(config.name).toBe('cloudflare');
    });

    it('should handle provider failover scenario', async () => {
      const switcher = new ProviderSwitcher('cloudflare');
      
      // Get active provider (would normally check health)
      const activeProvider = await switcher.getActiveProvider();
      expect(activeProvider.getName()).toBe('cloudflare');
      
      // In a real scenario, if cloudflare fails, it would switch to SES
      // This tests the switching mechanism
      switcher.switchProvider('ses');
      const fallbackProvider = await switcher.getActiveProvider();
      expect(fallbackProvider.getName()).toBe('ses');
    });

    it('should provide monitoring and observability data', async () => {
      // Perform health checks for monitoring dashboard
      const allHealthChecks = await ProviderFactory.performAllHealthChecks();
      
      expect(allHealthChecks.size).toBe(2);
      
      // Get logging context for each provider
      const providers = ProviderFactory.listProviders();
      const loggingData = providers.map(provider => ({
        ...provider,
        context: ProviderFactory.getProviderLoggingContext(provider.name),
      }));
      
      expect(loggingData).toHaveLength(2);
      expect(loggingData.every(data => data.context.environment === 'test')).toBe(true);
    });
  });
});