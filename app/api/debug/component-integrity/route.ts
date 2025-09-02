import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const componentChecks = [];
    const uiComponentsPath = join(process.cwd(), 'components/ui');

    // Expected core shadcn/ui components
    const expectedComponents = [
      'button.tsx',
      'card.tsx',
      'badge.tsx',
      'input.tsx',
      'label.tsx',
      'alert.tsx',
      'dialog.tsx',
      'dropdown-menu.tsx',
      'select.tsx',
      'tabs.tsx',
      'toast.tsx',
      'tooltip.tsx',
      'progress.tsx',
      'separator.tsx',
      'skeleton.tsx'
    ];

    // Check if components/ui directory exists
    try {
      const uiDirStat = await stat(uiComponentsPath);
      if (!uiDirStat.isDirectory()) {
        throw new Error('components/ui is not a directory');
      }

      // Get all files in components/ui
      const files = await readdir(uiComponentsPath);
      const componentFiles = files.filter(file => file.endsWith('.tsx') || file.endsWith('.ts'));

      // Check each expected component
      for (const expectedComponent of expectedComponents) {
        const exists = componentFiles.includes(expectedComponent);
        
        componentChecks.push({
          name: expectedComponent.replace('.tsx', '').replace('.ts', ''),
          path: `components/ui/${expectedComponent}`,
          status: exists ? 'available' : 'missing',
          message: exists ? 'Component file found' : 'Component file not found'
        });
      }

      // Check for additional components not in expected list
      const additionalComponents = componentFiles.filter(
        file => !expectedComponents.includes(file) && 
                !file.startsWith('use-') && // Exclude hooks
                file !== 'index.ts'
      );

      for (const additionalComponent of additionalComponents) {
        componentChecks.push({
          name: additionalComponent.replace('.tsx', '').replace('.ts', ''),
          path: `components/ui/${additionalComponent}`,
          status: 'available',
          message: 'Additional component found',
          isExtra: true
        });
      }

    } catch (error) {
      componentChecks.push({
        name: 'UI Components Directory',
        path: 'components/ui',
        status: 'error',
        message: 'Failed to access components/ui directory',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check components.json configuration
    try {
      const componentsJsonPath = join(process.cwd(), 'components.json');
      const componentsJsonStat = await stat(componentsJsonPath);
      
      componentChecks.push({
        name: 'shadcn/ui Configuration',
        path: 'components.json',
        status: 'available',
        message: 'shadcn/ui configuration file found',
        details: {
          size: componentsJsonStat.size,
          modified: componentsJsonStat.mtime
        }
      });
    } catch (error) {
      componentChecks.push({
        name: 'shadcn/ui Configuration',
        path: 'components.json',
        status: 'missing',
        message: 'components.json not found - shadcn/ui may not be properly configured'
      });
    }

    // Check for common component dependencies in package.json
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await require('fs').readFileSync(packageJsonPath, 'utf-8'));
      
      const radixDeps = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }).filter(dep => dep.startsWith('@radix-ui/'));

      const hasLucideReact = packageJson.dependencies?.['lucide-react'] || 
                            packageJson.devDependencies?.['lucide-react'];

      const hasClassVarianceAuthority = packageJson.dependencies?.['class-variance-authority'] || 
                                       packageJson.devDependencies?.['class-variance-authority'];

      componentChecks.push({
        name: 'Component Dependencies',
        path: 'package.json',
        status: radixDeps.length > 0 && hasLucideReact ? 'available' : 'warning',
        message: `Found ${radixDeps.length} Radix UI dependencies, Lucide React: ${hasLucideReact ? 'Yes' : 'No'}`,
        details: {
          radixDependencies: radixDeps,
          hasLucideReact,
          hasClassVarianceAuthority
        }
      });
    } catch (error) {
      componentChecks.push({
        name: 'Component Dependencies',
        path: 'package.json',
        status: 'error',
        message: 'Failed to check component dependencies',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const availableComponents = componentChecks.filter(c => c.status === 'available').length;
    const missingComponents = componentChecks.filter(c => c.status === 'missing').length;
    const errorComponents = componentChecks.filter(c => c.status === 'error').length;
    const warningComponents = componentChecks.filter(c => c.status === 'warning').length;

    return NextResponse.json({
      status: missingComponents > 0 || errorComponents > 0 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      summary: {
        total: componentChecks.length,
        available: availableComponents,
        missing: missingComponents,
        errors: errorComponents,
        warnings: warningComponents
      },
      components: componentChecks,
      recommendations: generateRecommendations(componentChecks)
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to run component integrity checks',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(checks: any[]): string[] {
  const recommendations = [];
  
  const missingComponents = checks.filter(c => c.status === 'missing' && !c.isExtra);
  if (missingComponents.length > 0) {
    recommendations.push(
      `Install missing components: ${missingComponents.map(c => c.name).join(', ')}`
    );
  }

  const hasConfigError = checks.some(c => c.name === 'shadcn/ui Configuration' && c.status === 'missing');
  if (hasConfigError) {
    recommendations.push('Run `npx shadcn@latest init` to set up shadcn/ui configuration');
  }

  const hasDependencyWarnings = checks.some(c => c.name === 'Component Dependencies' && c.status === 'warning');
  if (hasDependencyWarnings) {
    recommendations.push('Install missing component dependencies: @radix-ui/* packages and lucide-react');
  }

  if (recommendations.length === 0) {
    recommendations.push('Component library is healthy - no actions needed');
  }

  return recommendations;
}