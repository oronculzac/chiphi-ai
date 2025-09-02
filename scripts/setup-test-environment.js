#!/usr/bin/env node

/**
 * Test Environment Setup Script
 * 
 * Sets up the complete testing environment for ChiPhi AI
 * including MCP servers, test data, and validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up ChiPhi AI test environment...\n');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
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

function execCommand(command, description) {
  try {
    log(`📋 ${description}...`, colors.blue);
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed`, colors.green);
    return true;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, colors.red);
    return false;
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description} exists`, colors.green);
    return true;
  } else {
    log(`❌ ${description} not found at ${filePath}`, colors.red);
    return false;
  }
}

function createFileIfNotExists(filePath, content, description) {
  if (!fs.existsSync(filePath)) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);
      log(`✅ Created ${description}`, colors.green);
      return true;
    } catch (error) {
      log(`❌ Failed to create ${description}: ${error.message}`, colors.red);
      return false;
    }
  } else {
    log(`ℹ️  ${description} already exists`, colors.yellow);
    return true;
  }
}

async function main() {
  let success = true;

  // 1. Check Node.js and npm versions
  log('\n1️⃣  Checking system requirements...', colors.bright);
  
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`Node.js version: ${nodeVersion}`, colors.cyan);
    log(`npm version: ${npmVersion}`, colors.cyan);
  } catch (error) {
    log('❌ Node.js or npm not found', colors.red);
    success = false;
  }

  // 2. Install dependencies
  log('\n2️⃣  Installing dependencies...', colors.bright);
  
  if (!execCommand('npm install', 'Installing npm dependencies')) {
    success = false;
  }

  // 3. Install Playwright browsers
  log('\n3️⃣  Installing Playwright browsers...', colors.bright);
  
  if (!execCommand('npx playwright install', 'Installing Playwright browsers')) {
    success = false;
  }

  // 4. Check for UV (Python package manager for MCP servers)
  log('\n4️⃣  Checking UV installation...', colors.bright);
  
  try {
    const uvVersion = execSync('uv --version', { encoding: 'utf8' }).trim();
    log(`UV version: ${uvVersion}`, colors.cyan);
  } catch (error) {
    log('⚠️  UV not found. Installing UV for MCP servers...', colors.yellow);
    
    // Try to install UV
    const installCommands = [
      // macOS/Linux
      'curl -LsSf https://astral.sh/uv/install.sh | sh',
      // Windows (PowerShell)
      'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"'
    ];
    
    let uvInstalled = false;
    for (const command of installCommands) {
      try {
        execSync(command, { stdio: 'inherit' });
        uvInstalled = true;
        break;
      } catch (error) {
        // Try next command
      }
    }
    
    if (!uvInstalled) {
      log('❌ Failed to install UV. Please install manually: https://docs.astral.sh/uv/getting-started/installation/', colors.red);
      log('ℹ️  MCP tests may not work without UV', colors.yellow);
    }
  }

  // 5. Create MCP configuration
  log('\n5️⃣  Setting up MCP configuration...', colors.bright);
  
  const mcpConfigPath = '.kiro/settings/mcp.json';
  const mcpConfig = {
    "mcpServers": {
      "supabase": {
        "command": "uvx",
        "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "YOUR_SUPABASE_ACCESS_TOKEN"],
        "env": {
          "FASTMCP_LOG_LEVEL": "ERROR"
        },
        "disabled": false,
        "autoApprove": ["apply_migration", "execute_sql", "get_project", "list_edge_functions"]
      },
      "playwright": {
        "command": "npx",
        "args": ["@playwright/mcp@latest", "--headless", "--browser", "chrome", "--ignore-https-errors", "--no-sandbox"],
        "env": {
          "FASTMCP_LOG_LEVEL": "ERROR"
        },
        "disabled": false,
        "autoApprove": ["browser_navigate", "browser_screenshot", "browser_click", "browser_fill", "browser_select", "browser_hover", "browser_wait_for_selector", "browser_evaluate", "browser_get_page_content", "browser_get_element_text", "browser_get_element_attribute", "browser_press_key", "browser_scroll", "browser_close", "browser_snapshot", "browser_type", "browser_take_screenshot"]
      },
      "context7": {
        "command": "uvx",
        "args": ["@upstash/context7-mcp"],
        "env": {
          "FASTMCP_LOG_LEVEL": "ERROR"
        },
        "disabled": false,
        "autoApprove": ["resolve-library-id", "get-library-docs"]
      },
      "magicui": {
        "command": "uvx",
        "args": ["-y", "magicui-mcp"],
        "env": {
          "FASTMCP_LOG_LEVEL": "ERROR"
        },
        "disabled": false,
        "autoApprove": ["getAllComponents", "getComponent", "getComponentsByType", "add-component", "list-components", "get-component-code", "search-components"]
      }
    }
  };

  createFileIfNotExists(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'MCP configuration');

  // 6. Create test environment file
  log('\n6️⃣  Setting up test environment...', colors.bright);
  
  const testEnvPath = '.env.test';
  const testEnvContent = `# ChiPhi AI Test Environment Configuration
# Copy this file and update with your actual test values

# Application
PLAYWRIGHT_BASE_URL=http://localhost:3000
NODE_ENV=test

# Database (Supabase)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key
SUPABASE_PROJECT_ID=your-test-project-id

# AI Services
OPENAI_API_KEY=your-test-openai-key

# Email Processing
WEBHOOK_SECRET=test-webhook-secret-change-in-production
MAILGUN_API_KEY=your-test-mailgun-key

# MCP Configuration
MCP_ENABLED=true
MCP_TIMEOUT=30000

# Test Configuration
TEST_TIMEOUT=60000
TEST_RETRIES=2
TEST_PARALLEL_WORKERS=4
`;

  createFileIfNotExists(testEnvPath, testEnvContent, 'Test environment file');

  // 7. Check Supabase CLI
  log('\n7️⃣  Checking Supabase CLI...', colors.bright);
  
  try {
    const supabaseVersion = execSync('supabase --version', { encoding: 'utf8' }).trim();
    log(`Supabase CLI version: ${supabaseVersion}`, colors.cyan);
  } catch (error) {
    log('⚠️  Supabase CLI not found. Installing...', colors.yellow);
    
    if (!execCommand('npm install -g supabase', 'Installing Supabase CLI')) {
      log('❌ Failed to install Supabase CLI globally', colors.red);
      log('ℹ️  You can install it manually: npm install -g supabase', colors.yellow);
    }
  }

  // 8. Validate test files
  log('\n8️⃣  Validating test files...', colors.bright);
  
  const testFiles = [
    'playwright.config.ts',
    'tests/global-setup.ts',
    'tests/global-teardown.ts',
    'tests/fixtures/test-organizations.ts',
    'tests/fixtures/email-samples.ts',
    'tests/utils/test-helpers.ts',
    'lib/types/test-schemas.ts',
  ];

  for (const file of testFiles) {
    if (!checkFileExists(file, `Test file: ${file}`)) {
      success = false;
    }
  }

  // 9. Validate test structure
  log('\n9️⃣  Validating test structure...', colors.bright);
  
  const testDirs = [
    'tests/e2e',
    'tests/mcp',
    'tests/fixtures',
    'tests/utils',
  ];

  for (const dir of testDirs) {
    if (!checkFileExists(dir, `Test directory: ${dir}`)) {
      success = false;
    }
  }

  // 10. Run test data validation
  log('\n🔟 Validating test data integrity...', colors.bright);
  
  try {
    // This would run the test data validation
    execSync('node -e "const { validateTestDataIntegrity } = require(\'./tests/fixtures/test-organizations\'); const issues = validateTestDataIntegrity(); if (issues.length > 0) { console.error(\'Issues:\', issues); process.exit(1); } else { console.log(\'✅ Test data integrity validated\'); }"', { stdio: 'inherit' });
  } catch (error) {
    log('❌ Test data validation failed', colors.red);
    success = false;
  }

  // 11. Test basic functionality
  log('\n1️⃣1️⃣  Testing basic functionality...', colors.bright);
  
  // Test TypeScript compilation
  if (!execCommand('npx tsc --noEmit', 'TypeScript compilation check')) {
    success = false;
  }

  // Test unit tests (if any exist)
  try {
    execSync('npm run test:unit -- --run --reporter=basic', { stdio: 'inherit' });
    log('✅ Unit tests passed', colors.green);
  } catch (error) {
    log('⚠️  Unit tests failed or not found', colors.yellow);
  }

  // 12. Create test scripts
  log('\n1️⃣2️⃣  Creating helper scripts...', colors.bright);
  
  const testScriptPath = 'scripts/run-tests.sh';
  const testScript = `#!/bin/bash

# ChiPhi AI Test Runner Script
# Usage: ./scripts/run-tests.sh [test-type]

set -e

echo "🧪 ChiPhi AI Test Runner"
echo "======================="

# Default to running all tests
TEST_TYPE=\${1:-all}

case \$TEST_TYPE in
  "unit")
    echo "Running unit tests..."
    npm run test:unit
    ;;
  "integration")
    echo "Running integration tests..."
    npm run test:integration
    ;;
  "e2e")
    echo "Running E2E tests..."
    npm run test:e2e
    ;;
  "mcp")
    echo "Running MCP tests..."
    npm run test:mcp
    ;;
  "performance")
    echo "Running performance tests..."
    npm run test:performance
    ;;
  "security")
    echo "Running security tests..."
    npm run test:security
    ;;
  "accessibility")
    echo "Running accessibility tests..."
    npm run test:accessibility
    ;;
  "all")
    echo "Running all tests..."
    npm run test:unit
    npm run test:integration
    npm run test:e2e
    npm run test:mcp
    ;;
  *)
    echo "Unknown test type: \$TEST_TYPE"
    echo "Available types: unit, integration, e2e, mcp, performance, security, accessibility, all"
    exit 1
    ;;
esac

echo "✅ Tests completed successfully!"
`;

  createFileIfNotExists(testScriptPath, testScript, 'Test runner script');

  // Make script executable
  try {
    fs.chmodSync(testScriptPath, '755');
  } catch (error) {
    // Ignore on Windows
  }

  // 13. Final summary
  log('\n📋 Setup Summary', colors.bright);
  log('================', colors.bright);
  
  if (success) {
    log('✅ Test environment setup completed successfully!', colors.green);
    log('\nNext steps:', colors.cyan);
    log('1. Update .env.test with your actual test credentials', colors.cyan);
    log('2. Start your development server: npm run dev', colors.cyan);
    log('3. Run tests: npm run test:e2e', colors.cyan);
    log('4. Check MCP configuration in .kiro/settings/mcp.json', colors.cyan);
    
    log('\nAvailable test commands:', colors.magenta);
    log('• npm run test:unit          - Unit tests', colors.magenta);
    log('• npm run test:integration   - Integration tests', colors.magenta);
    log('• npm run test:e2e          - End-to-end tests', colors.magenta);
    log('• npm run test:mcp          - MCP integration tests', colors.magenta);
    log('• npm run test:performance  - Performance tests', colors.magenta);
    log('• npm run test:security     - Security tests', colors.magenta);
    log('• npm run test:accessibility - Accessibility tests', colors.magenta);
    log('• npm run test:full         - All tests', colors.magenta);
    
  } else {
    log('❌ Test environment setup completed with errors', colors.red);
    log('Please review the errors above and fix them before running tests', colors.yellow);
    process.exit(1);
  }
}

// Run the setup
main().catch(error => {
  log(`💥 Setup failed with error: ${error.message}`, colors.red);
  process.exit(1);
});