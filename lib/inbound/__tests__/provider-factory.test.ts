import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  ProviderFactory,
  getDefaultProvider,
  createProvider,
  checkProviderHealth,
  getProviderConfig,
  ProviderSwitcher,
} from '../provider-factory';
import {
  ProviderConfigurationError,
  ProviderHealthCheck,
} from '../types';
import { CloudflareAdapter } from '../providers/cloudflare-adapter';
import { SESAdapter } from '../providers/ses-adapter';
import { config } from '@/lib/config';

// Mock the config module
vi.mock('@/lib/config', () => ({
  config: {
    inboundProvider: {
      provider: 'cloudflare',
      cloudflareSecret: 'test-cloudflare-secret',
      sesSecret: 'test-ses-secret',
    },
    app: {
      nodeEnv: 'test',
      isDevelopment: true,
      isProduction: false,
    },
  },
}));

// Mock the provider adapters
vi.mock('../providers/cloudflare-adapter', () => ({
  CloudflareAdapter: vi.fn().mockImplementation(() => ({
    getName: () => 'cloudflare',
    verify: vi.fn().mockResolvedValue(true),
    parse: vi.fn().mockResolvedValue({}),
    healthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      responseTimeMs: 100,
      details: { test: true },
    }),
  })),
}));

vi.mock('../providers/ses-adapter', () => ({
  SESAdapter: vi.fn().mockImplementation(() => ({
    getName: () => 'ses',
    verify: vi.fn().mockResolvedValue(true),
    parse: vi.fn().mockResolvedValue({}),
    healthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      responseTimeMs: 150,
      details: { test: true },
    }),
  })),
}));

describe('ProviderFactory', () => {
  beforeEach(() => {
    // Clear cache before each test
    ProviderFactory.clearCache();
    vi.clearAllMocks();
    
    // Reset config to default values
    Object.assign(vi.mocked(config), {
      inboundProvider: {
        provider: 'cloudflare',
        cloudflareSecret: 'test-cloudflare-secret',
        sesSecret: 'test-ses-secret',
      },
      app: {
        nodeEnv: 'test',
        isDevelopment: true,
        isProduction: false,
      },
    });
  });

  afterEach(() => {
    ProviderFactory.clearCache();
  });

  describe('createProvider', () => {
    it('should create a Cloudflare provider', () => {
      const provider = ProviderFactory.createProvider('cloudflare');
      
      expect(CloudflareAdapter).toHaveBeenCalledWith('test-cloudflare-secret', 30000);
      expect(provider.getName()).toBe('cloudflare');
    });

    it('should create an SES provider', () => {
      const provider = ProviderFactory.createProvider('ses');
      
      expect(SESAdapter).toHaveBeenCalledWith('test-ses-secret', 30000, true);
      expect(provider.getName()).toBe('ses');
    });

    it('should create provider with custom options', () => {
      const options = {
        webhookSecret: 'custom-secret',
        timeoutMs: 60000,
        verifySignature: false,
      };
      
      ProviderFactory.createProvider('ses', options);
      
      expect(SESAdapter).toHaveBeenCalledWith('custom-secret', 60000, false);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        ProviderFactory.createProvider('invalid-provider');
      }).toThrow(ProviderConfigurationError);
    });

    it('should cache provider instances', () => {
      const provider1 = ProviderFactory.createProvider('cloudflare');
      const provider2 = ProviderFactory.createProvider('cloudflare');
      
      expect(provider1).toBe(provider2);
      expect(CloudflareAdapter).toHaveBeenCalledTimes(1);
    });

    it('should create different instances for different options', () => {
      const provider1 = ProviderFactory.createProvider('cloudflare');
      const provider2 = ProviderFactory.createProvider('cloudflare', { timeoutMs: 60000 });
      
      expect(provider1).not.toBe(provider2);
      expect(CloudflareAdapter).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDefaultProvider', () => {
    it('should return the default provider from config', () => {
      const provider = ProviderFactory.getDefaultProvider();
      
      expect(provider.getName()).toBe('cloudflare');
      expect(CloudflareAdapter).toHaveBeenCalled();
    });
  });

  describe('validateProviderConfiguration', () => {
    it('should validate valid provider names', () => {
      expect(() => {
        ProviderFactory.validateProviderConfiguration('cloudflare');
      }).not.toThrow();
      
      expect(() => {
        ProviderFactory.validateProviderConfiguration('ses');
      }).not.toThrow();
    });

    it('should throw error for invalid provider names', () => {
      expect(() => {
        ProviderFactory.validateProviderConfiguration('invalid');
      }).toThrow(ProviderConfigurationError);
    });

    it('should validate production configuration for Cloudflare', () => {
      // Mock production environment without secret
      vi.mocked(config).app.isProduction = true;
      vi.mocked(config).app.nodeEnv = 'production';
      vi.mocked(config).inboundProvider.cloudflareSecret = undefined;
      
      expect(() => {
        ProviderFactory.validateProviderConfiguration('cloudflare');
      }).toThrow(ProviderConfigurationError);
    });

    it('should validate production configuration for SES', () => {
      // Mock production environment without secret
      vi.mocked(config).app.isProduction = true;
      vi.mocked(config).app.nodeEnv = 'production';
      vi.mocked(config).inboundProvider.sesSecret = undefined;
      
      expect(() => {
        ProviderFactory.validateProviderConfiguration('ses');
      }).toThrow(ProviderConfigurationError);
    });
  });

  describe('performHealthCheck', () => {
    it('should perform health check on Cloudflare provider', async () => {
      const healthCheck = await ProviderFactory.performHealthCheck('cloudflare');
      
      expect(healthCheck).toMatchObject({
        provider: 'cloudflare',
        healthy: true,
        responseTimeMs: expect.any(Number),
        details: expect.objectContaining({
          correlationId: expect.any(String),
          configurationValid: true,
        }),
      });
    });

    it('should perform health check on SES provider', async () => {
      const healthCheck = await ProviderFactory.performHealthCheck('ses');
      
      expect(healthCheck).toMatchObject({
        provider: 'ses',
        healthy: true,
        responseTimeMs: expect.any(Number),
        details: expect.objectContaining({
          correlationId: expect.any(String),
          configurationValid: true,
        }),
      });
    });

    it('should return unhealthy status for configuration errors', async () => {
      vi.mocked(config).app.isProduction = true;
      vi.mocked(config).app.nodeEnv = 'production';
      vi.mocked(config).inboundProvider.cloudflareSecret = undefined;
      
      const healthCheck = await ProviderFactory.performHealthCheck('cloudflare', false);
      
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.error).toContain('CLOUDFLARE_EMAIL_SECRET is required');
    });

    it('should cache health check results', async () => {
      const healthCheck1 = await ProviderFactory.performHealthCheck('cloudflare');
      const healthCheck2 = await ProviderFactory.performHealthCheck('cloudflare');
      
      expect(healthCheck1).toBe(healthCheck2);
    });

    it('should bypass cache when requested', async () => {
      const healthCheck1 = await ProviderFactory.performHealthCheck('cloudflare', true);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const healthCheck2 = await ProviderFactory.performHealthCheck('cloudflare', false);
      
      expect(healthCheck1).not.toBe(healthCheck2);
      expect(healthCheck1.lastChecked.getTime()).not.toEqual(healthCheck2.lastChecked.getTime());
    });

    it('should handle provider health check errors', async () => {
      // Mock provider health check to throw error
      const mockProvider = {
        getName: () => 'cloudflare',
        healthCheck: vi.fn().mockRejectedValue(new Error('Health check failed')),
      };
      
      vi.mocked(CloudflareAdapter).mockImplementationOnce(() => mockProvider as any);
      
      const healthCheck = await ProviderFactory.performHealthCheck('cloudflare', false);
      
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.error).toContain('Health check failed');
    });
  });

  describe('performAllHealthChecks', () => {
    it('should perform health checks on all providers', async () => {
      const healthChecks = await ProviderFactory.performAllHealthChecks();
      
      expect(healthChecks.size).toBe(2);
      expect(healthChecks.has('cloudflare')).toBe(true);
      expect(healthChecks.has('ses')).toBe(true);
      
      const cloudflareHealth = healthChecks.get('cloudflare')!;
      const sesHealth = healthChecks.get('ses')!;
      
      expect(cloudflareHealth.provider).toBe('cloudflare');
      expect(sesHealth.provider).toBe('ses');
    });

    it('should handle individual provider failures', async () => {
      // Mock SES to throw error during health check
      const mockSESProvider = {
        getName: () => 'ses',
        healthCheck: vi.fn().mockRejectedValue(new Error('SES initialization failed')),
      };
      
      vi.mocked(SESAdapter).mockImplementationOnce(() => mockSESProvider as any);
      
      const healthChecks = await ProviderFactory.performAllHealthChecks(false);
      
      expect(healthChecks.size).toBe(2);
      
      const cloudflareHealth = healthChecks.get('cloudflare')!;
      const sesHealth = healthChecks.get('ses')!;
      
      expect(cloudflareHealth.healthy).toBe(true);
      expect(sesHealth.healthy).toBe(false);
      expect(sesHealth.error).toContain('SES initialization failed');
    });
  });

  describe('getFallbackProvider', () => {
    it('should return SES as fallback for Cloudflare', () => {
      const fallback = ProviderFactory.getFallbackProvider('cloudflare');
      expect(fallback).toBe('ses');
    });

    it('should return Cloudflare as fallback for SES', () => {
      const fallback = ProviderFactory.getFallbackProvider('ses');
      expect(fallback).toBe('cloudflare');
    });

    it('should return null for unknown providers', () => {
      const fallback = ProviderFactory.getFallbackProvider('unknown');
      expect(fallback).toBe(null);
    });

    it('should return null if fallback is not configured', () => {
      // Mock SES as not configured
      vi.mocked(config).inboundProvider.sesSecret = undefined;
      vi.mocked(config).app.isProduction = true;
      vi.mocked(config).app.nodeEnv = 'production';
      
      const fallback = ProviderFactory.getFallbackProvider('cloudflare');
      expect(fallback).toBe(null);
    });
  });

  describe('isProviderConfigured', () => {
    it('should return true for properly configured providers', () => {
      expect(ProviderFactory.isProviderConfigured('cloudflare')).toBe(true);
      expect(ProviderFactory.isProviderConfigured('ses')).toBe(true);
    });

    it('should return false for misconfigured providers', () => {
      vi.mocked(config).app.isProduction = true;
      vi.mocked(config).app.nodeEnv = 'production';
      vi.mocked(config).inboundProvider.cloudflareSecret = undefined;
      
      expect(ProviderFactory.isProviderConfigured('cloudflare')).toBe(false);
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider configuration', () => {
      const config = ProviderFactory.getProviderConfig('cloudflare');
      
      expect(config).toMatchObject({
        name: 'cloudflare',
        enabled: true,
        config: expect.objectContaining({
          type: 'cloudflare-workers-email-routing',
          hmacAlgorithm: 'sha256',
        }),
        webhookSecret: '[CONFIGURED]',
        timeoutMs: 30000,
      });
    });

    it('should show unconfigured status', () => {
      vi.mocked(config).app.isProduction = true;
      vi.mocked(config).app.nodeEnv = 'production';
      vi.mocked(config).inboundProvider.sesSecret = undefined;
      
      const sesConfig = ProviderFactory.getProviderConfig('ses');
      
      expect(sesConfig.enabled).toBe(false);
      expect(sesConfig.webhookSecret).toBeUndefined();
    });
  });

  describe('listProviders', () => {
    it('should list all supported providers', () => {
      const providers = ProviderFactory.listProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.name)).toEqual(['cloudflare', 'ses']);
    });
  });

  describe('getProviderLoggingContext', () => {
    it('should return logging context for provider', () => {
      const context = ProviderFactory.getProviderLoggingContext('cloudflare');
      
      expect(context).toMatchObject({
        provider: 'cloudflare',
        isConfigured: true,
        isDefault: true,
        environment: 'test',
        hasSecret: true,
      });
    });
  });

  describe('clearCache', () => {
    it('should clear provider and health check caches', () => {
      // Create some cached instances
      ProviderFactory.createProvider('cloudflare');
      ProviderFactory.performHealthCheck('ses');
      
      // Clear cache
      ProviderFactory.clearCache();
      
      // Creating provider again should call constructor
      vi.clearAllMocks();
      ProviderFactory.createProvider('cloudflare');
      
      expect(CloudflareAdapter).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    ProviderFactory.clearCache();
    vi.clearAllMocks();
    
    // Reset config to default values
    Object.assign(vi.mocked(config), {
      inboundProvider: {
        provider: 'cloudflare',
        cloudflareSecret: 'test-cloudflare-secret',
        sesSecret: 'test-ses-secret',
      },
      app: {
        nodeEnv: 'test',
        isDevelopment: true,
        isProduction: false,
      },
    });
  });

  describe('getDefaultProvider', () => {
    it('should return default provider', () => {
      const provider = getDefaultProvider();
      expect(provider.getName()).toBe('cloudflare');
    });
  });

  describe('createProvider', () => {
    it('should create provider by name', () => {
      const provider = createProvider('ses');
      expect(provider.getName()).toBe('ses');
    });
  });

  describe('checkProviderHealth', () => {
    it('should perform health check', async () => {
      const health = await checkProviderHealth('cloudflare');
      expect(health.provider).toBe('cloudflare');
      expect(health.healthy).toBe(true);
    });
  });

  describe('getProviderConfig', () => {
    it('should get provider configuration', () => {
      const config = getProviderConfig('ses');
      expect(config.name).toBe('ses');
    });
  });
});

describe('ProviderSwitcher', () => {
  beforeEach(() => {
    ProviderFactory.clearCache();
    vi.clearAllMocks();
    
    // Reset config to default values
    Object.assign(vi.mocked(config), {
      inboundProvider: {
        provider: 'cloudflare',
        cloudflareSecret: 'test-cloudflare-secret',
        sesSecret: 'test-ses-secret',
      },
      app: {
        nodeEnv: 'test',
        isDevelopment: true,
        isProduction: false,
      },
    });
  });

  describe('constructor', () => {
    it('should initialize with default provider', () => {
      const switcher = new ProviderSwitcher();
      expect(switcher['currentProvider']).toBe('cloudflare');
      expect(switcher['fallbackProvider']).toBe('ses');
    });

    it('should initialize with custom provider', () => {
      const switcher = new ProviderSwitcher('ses');
      expect(switcher['currentProvider']).toBe('ses');
      expect(switcher['fallbackProvider']).toBe('cloudflare');
    });
  });

  describe('getActiveProvider', () => {
    it('should return current provider when healthy', async () => {
      const switcher = new ProviderSwitcher('cloudflare');
      const provider = await switcher.getActiveProvider();
      
      expect(provider.getName()).toBe('cloudflare');
    });

    it('should return fallback provider when current is unhealthy', async () => {
      // Mock Cloudflare as unhealthy
      const unhealthyProvider = {
        getName: () => 'cloudflare',
        healthCheck: vi.fn().mockResolvedValue({ healthy: false }),
      };
      vi.mocked(CloudflareAdapter).mockImplementationOnce(() => unhealthyProvider as any);
      
      const switcher = new ProviderSwitcher('cloudflare');
      const provider = await switcher.getActiveProvider();
      
      expect(provider.getName()).toBe('ses');
    });

    it('should return current provider even if unhealthy when no fallback', async () => {
      // Mock both providers as unhealthy
      const unhealthyCloudflare = {
        getName: () => 'cloudflare',
        healthCheck: vi.fn().mockResolvedValue({ healthy: false }),
      };
      const unhealthySES = {
        getName: () => 'ses',
        healthCheck: vi.fn().mockResolvedValue({ healthy: false }),
      };
      
      vi.mocked(CloudflareAdapter).mockImplementation(() => unhealthyCloudflare as any);
      vi.mocked(SESAdapter).mockImplementation(() => unhealthySES as any);
      
      const switcher = new ProviderSwitcher('cloudflare');
      const provider = await switcher.getActiveProvider();
      
      expect(provider.getName()).toBe('cloudflare');
    });
  });

  describe('switchProvider', () => {
    it('should switch to new provider', () => {
      const switcher = new ProviderSwitcher('cloudflare');
      switcher.switchProvider('ses');
      
      expect(switcher['currentProvider']).toBe('ses');
      expect(switcher['fallbackProvider']).toBe('cloudflare');
    });

    it('should validate new provider configuration', () => {
      const switcher = new ProviderSwitcher();
      
      expect(() => {
        switcher.switchProvider('invalid');
      }).toThrow(ProviderConfigurationError);
    });
  });

  describe('getStatus', () => {
    it('should return current status', async () => {
      // Ensure both providers are healthy by clearing cache and mocks
      ProviderFactory.clearCache();
      vi.clearAllMocks();
      
      // Mock healthy providers
      const healthyCloudflareProvider = {
        getName: () => 'cloudflare',
        verify: vi.fn().mockResolvedValue(true),
        parse: vi.fn().mockResolvedValue({}),
        healthCheck: vi.fn().mockResolvedValue({
          healthy: true,
          responseTimeMs: 100,
          details: { test: true },
        }),
      };
      
      const healthySESProvider = {
        getName: () => 'ses',
        verify: vi.fn().mockResolvedValue(true),
        parse: vi.fn().mockResolvedValue({}),
        healthCheck: vi.fn().mockResolvedValue({
          healthy: true,
          responseTimeMs: 150,
          details: { test: true },
        }),
      };
      
      vi.mocked(CloudflareAdapter).mockImplementation(() => healthyCloudflareProvider as any);
      vi.mocked(SESAdapter).mockImplementation(() => healthySESProvider as any);
      
      const switcher = new ProviderSwitcher('cloudflare');
      const status = await switcher.getStatus();
      
      expect(status).toMatchObject({
        current: 'cloudflare',
        fallback: 'ses',
        currentHealthy: true,
        fallbackHealthy: true,
      });
    });

    it('should handle null fallback', async () => {
      // Mock no fallback available
      vi.spyOn(ProviderFactory, 'getFallbackProvider').mockReturnValue(null);
      
      const switcher = new ProviderSwitcher('cloudflare');
      const status = await switcher.getStatus();
      
      expect(status.fallback).toBe(null);
      expect(status.fallbackHealthy).toBe(null);
    });
  });
});