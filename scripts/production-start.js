#!/usr/bin/env node

/**
 * Production startup script
 * Validates configuration and starts the application with production optimizations
 */

const { validateProductionConfig } = require('../deployment/production.config.js');
const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(50)}`, colors.cyan);
  log(`  ${title}`, colors.cyan);
  log(`${'='.repeat(50)}`, colors.cyan);
}

async function main() {
  try {
    logSection('ChiPhi AI Production Startup');
    
    // 1. Validate environment
    log('🔍 Validating production configuration...', colors.yellow);
    validateProductionConfig();
    log('✅ Configuration validation passed', colors.green);
    
    // 2. Check Node.js version
    log('\n🔍 Checking Node.js version...', colors.yellow);
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      log(`❌ Node.js ${nodeVersion} is not supported. Please use Node.js 18 or higher.`, colors.red);
      process.exit(1);
    }
    log(`✅ Node.js ${nodeVersion} is supported`, colors.green);
    
    // 3. Set production environment variables
    log('\n🔧 Setting production environment...', colors.yellow);
    process.env.NODE_ENV = 'production';
    
    // Set production-specific optimizations
    process.env.NEXT_TELEMETRY_DISABLED = '1'; // Disable Next.js telemetry
    process.env.NODE_OPTIONS = '--max-old-space-size=2048'; // Increase memory limit
    
    log('✅ Production environment configured', colors.green);
    
    // 4. Database health check
    log('\n🔍 Checking database connectivity...', colors.yellow);
    try {
      const healthCheck = await fetch(`http://localhost:${process.env.PORT || 3000}/api/health`, {
        method: 'HEAD',
        timeout: 5000,
      }).catch(() => null);
      
      // If health check fails, we'll let the app start and handle it
      log('ℹ️  Database connectivity will be verified after startup', colors.blue);
    } catch (error) {
      log('ℹ️  Database connectivity will be verified after startup', colors.blue);
    }
    
    // 5. Start the application
    logSection('Starting Application');
    log('🚀 Starting ChiPhi AI in production mode...', colors.green);
    
    const startCommand = process.env.START_COMMAND || 'npm';
    const startArgs = process.env.START_ARGS ? process.env.START_ARGS.split(' ') : ['start'];
    
    log(`📝 Command: ${startCommand} ${startArgs.join(' ')}`, colors.blue);
    
    const child = spawn(startCommand, startArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Production-specific environment variables
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    });
    
    // Handle process signals
    process.on('SIGTERM', () => {
      log('\n🛑 Received SIGTERM, shutting down gracefully...', colors.yellow);
      child.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
      log('\n🛑 Received SIGINT, shutting down gracefully...', colors.yellow);
      child.kill('SIGINT');
    });
    
    // Handle child process exit
    child.on('exit', (code, signal) => {
      if (signal) {
        log(`\n🛑 Application terminated by signal: ${signal}`, colors.yellow);
      } else if (code === 0) {
        log('\n✅ Application exited successfully', colors.green);
      } else {
        log(`\n❌ Application exited with code: ${code}`, colors.red);
      }
      process.exit(code || 0);
    });
    
    child.on('error', (error) => {
      log(`\n❌ Failed to start application: ${error.message}`, colors.red);
      process.exit(1);
    });
    
    // Log startup completion
    setTimeout(() => {
      log('\n✅ Application startup completed', colors.green);
      log(`🌐 Application should be available at: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}`, colors.cyan);
      log(`📊 Health check endpoint: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/health`, colors.cyan);
      log(`🔄 Readiness check endpoint: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ready`, colors.cyan);
    }, 3000);
    
  } catch (error) {
    log(`\n❌ Startup failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`\n💥 Uncaught Exception: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\n💥 Unhandled Rejection at: ${promise}, reason: ${reason}`, colors.red);
  console.error(reason);
  process.exit(1);
});

// Start the application
main();