# Steering Documentation Index

This directory contains comprehensive development guidelines and patterns for the ChiPhi AI project. The documentation is organized by domain and includes specific guidance for the Reports MVP implementation.

## Core Documentation

### 📋 Project Foundation
- **[product.md](./product.md)** - Product overview and core features
- **[structure.md](./structure.md)** - Project structure and architectural patterns
- **[tech.md](./tech.md)** - Technology stack and common commands

### 🔧 Development Guidelines
- **[development.md](./development.md)** - Development workflow, testing strategy, and best practices
- **[mcp-integration.md](./mcp-integration.md)** - Model Context Protocol integration patterns
- **[performance-optimization.md](./performance-optimization.md)** - Performance optimization strategies

### 🎨 UI/UX Development
- **[ui-consistency.md](./ui-consistency.md)** - UI consistency standards and component patterns
- **[reports-patterns.md](./reports-patterns.md)** - Reports-specific development patterns

### 🔒 Security & Infrastructure
- **[security-monitoring.md](./security-monitoring.md)** - Security guidelines and monitoring patterns
- **[provider-abstraction.md](./provider-abstraction.md)** - Email provider abstraction patterns
- **[aws-deployment.md](./aws-deployment.md)** - AWS deployment and infrastructure configuration

### 🤖 AI & Processing
- **[ai-processing.md](./ai-processing.md)** - AI processing and learning patterns

## Reports MVP Specific Guidance

The following files contain specific guidance for the Reports MVP implementation:

### Primary Files
1. **[reports-patterns.md](./reports-patterns.md)** - Complete reports development patterns
2. **[mcp-integration.md](./mcp-integration.md)** - MCP usage for reports testing and development
3. **[performance-optimization.md](./performance-optimization.md)** - Performance patterns for charts and data

### Supporting Files
- **[ui-consistency.md](./ui-consistency.md)** - Chart and visualization standards
- **[development.md](./development.md)** - Testing patterns for reports
- **[security-monitoring.md](./security-monitoring.md)** - Reports security considerations

## Quick Reference

### For Database Development
- Use **Supabase MCP** for all database operations
- Follow **reports-patterns.md** for RPC function standards
- Reference **performance-optimization.md** for query optimization

### For UI Development
- Use **shadcn MCP** for component discovery
- Use **Playwright MCP** for testing and validation
- Follow **ui-consistency.md** for chart patterns

### For Testing
- Use **Playwright MCP** as primary testing tool
- Reference **development.md** for test organization
- Follow **reports-patterns.md** for test structure

### For Performance
- Reference **performance-optimization.md** for all optimization patterns
- Use dynamic imports for chart components
- Implement proper caching strategies

## File Inclusion Patterns

### Always Included (Default)
All files in this directory are included by default unless specified otherwise.

### Conditionally Included
None currently - all steering files apply to general development.

### Manually Included
None currently - use `#steering-file-name` in chat to reference specific files.

## Maintenance

This documentation should be updated when:
- New development patterns are established
- Technology stack changes occur
- Performance optimizations are discovered
- Security requirements evolve
- Testing strategies are refined

Last updated: Current as of Reports MVP implementation.