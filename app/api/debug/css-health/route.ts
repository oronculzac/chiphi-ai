import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const healthChecks = [];

    // Check if Tailwind config exists
    try {
      const tailwindConfigPath = join(process.cwd(), 'tailwind.config.ts');
      const tailwindConfig = await readFile(tailwindConfigPath, 'utf-8');
      
      healthChecks.push({
        name: 'Tailwind Config',
        status: 'pass',
        message: 'tailwind.config.ts found and readable',
        details: {
          path: tailwindConfigPath,
          size: tailwindConfig.length
        }
      });
    } catch (error) {
      healthChecks.push({
        name: 'Tailwind Config',
        status: 'fail',
        message: 'tailwind.config.ts not found or not readable',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check if PostCSS config exists
    try {
      const postcssConfigPath = join(process.cwd(), 'postcss.config.mjs');
      const postcssConfig = await readFile(postcssConfigPath, 'utf-8');
      
      // Check if it includes Tailwind plugin
      const hasTailwindPlugin = postcssConfig.includes('@tailwindcss/postcss') || 
                               postcssConfig.includes('tailwindcss');
      
      healthChecks.push({
        name: 'PostCSS Config',
        status: hasTailwindPlugin ? 'pass' : 'warning',
        message: hasTailwindPlugin ? 
          'PostCSS config found with Tailwind plugin' : 
          'PostCSS config found but Tailwind plugin not detected',
        details: {
          path: postcssConfigPath,
          hasTailwindPlugin
        }
      });
    } catch (error) {
      healthChecks.push({
        name: 'PostCSS Config',
        status: 'fail',
        message: 'postcss.config.mjs not found or not readable',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check if globals.css exists and has Tailwind directives
    try {
      const globalsCssPath = join(process.cwd(), 'app/globals.css');
      const globalsCss = await readFile(globalsCssPath, 'utf-8');
      
      const hasTailwindDirectives = globalsCss.includes('@tailwind base') &&
                                   globalsCss.includes('@tailwind components') &&
                                   globalsCss.includes('@tailwind utilities');
      
      healthChecks.push({
        name: 'Global CSS',
        status: hasTailwindDirectives ? 'pass' : 'fail',
        message: hasTailwindDirectives ? 
          'globals.css found with Tailwind directives' : 
          'globals.css missing Tailwind directives',
        details: {
          path: globalsCssPath,
          hasTailwindDirectives,
          size: globalsCss.length
        }
      });
    } catch (error) {
      healthChecks.push({
        name: 'Global CSS',
        status: 'fail',
        message: 'app/globals.css not found or not readable',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check package.json for Tailwind dependencies
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      const hasTailwind = packageJson.dependencies?.tailwindcss || 
                         packageJson.devDependencies?.tailwindcss ||
                         packageJson.dependencies?.['@tailwindcss/postcss'] ||
                         packageJson.devDependencies?.['@tailwindcss/postcss'];
      
      healthChecks.push({
        name: 'Tailwind Dependencies',
        status: hasTailwind ? 'pass' : 'fail',
        message: hasTailwind ? 
          'Tailwind CSS dependencies found' : 
          'Tailwind CSS dependencies not found',
        details: {
          tailwindcss: packageJson.dependencies?.tailwindcss || packageJson.devDependencies?.tailwindcss,
          postcssPlugin: packageJson.dependencies?.['@tailwindcss/postcss'] || packageJson.devDependencies?.['@tailwindcss/postcss']
        }
      });
    } catch (error) {
      healthChecks.push({
        name: 'Tailwind Dependencies',
        status: 'fail',
        message: 'package.json not found or not readable',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const passedChecks = healthChecks.filter(c => c.status === 'pass').length;
    const failedChecks = healthChecks.filter(c => c.status === 'fail').length;
    const warningChecks = healthChecks.filter(c => c.status === 'warning').length;

    return NextResponse.json({
      status: failedChecks > 0 ? 'unhealthy' : warningChecks > 0 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      summary: {
        total: healthChecks.length,
        passed: passedChecks,
        failed: failedChecks,
        warnings: warningChecks
      },
      checks: healthChecks
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to run CSS health checks',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}