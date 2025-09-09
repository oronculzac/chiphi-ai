// Removed next-intl plugin for now - using client-side only setup

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode in development to reduce duplicate API calls
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // AWS Amplify optimizations
  trailingSlash: true,
  output: 'standalone',
  
  webpack: (config, { dev, isServer }) => {
    // Bundle analysis configuration
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html',
        })
      );
    }
    
    if (!dev) {
      // Exclude Cloudflare provider and test utilities from production builds
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/inbound/providers/cloudflare-adapter': false,
      };
      
      // Remove test utilities from production
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/tests': false,
        '@/scripts/test-*': false,
      };
    }
    
    return config;
  },
}

export default nextConfig;
