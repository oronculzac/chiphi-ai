# Technology Stack

## Framework & Runtime
- **Next.js 15.2.4** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript 5** - Type-safe development
- **Node.js** - Runtime environment

## Database & Backend
- **Supabase** - PostgreSQL database with auth, RLS, and real-time features
- **Supabase Auth** - Authentication and user management
- **Row Level Security (RLS)** - Multi-tenant data isolation
- **Database migrations** - Version-controlled schema changes in `supabase/migrations/`
- **Database Functions (RPCs)** - Optimized report aggregation functions (fn_report_totals, fn_report_by_category, fn_report_daily)
- **Performance Indexes** - Optimized indexes for report queries on transactions table

## AI & Processing
- **OpenAI GPT-4o-mini** - Receipt extraction and translation
- **mailparser** - Email MIME parsing
- **Zod** - Runtime validation and type safety

## UI & Styling
- **Tailwind CSS 4.1.9** - Utility-first CSS framework
- **shadcn/ui** - Component library with Radix UI primitives
- **Lucide React** - Icon library
- **next-themes** - Dark/light mode support
- **Sonner** - Toast notifications

## Development Tools
- **ESLint** - Code linting (build errors ignored in config)
- **TypeScript** - Type checking (build errors ignored in config)
- **PostCSS** - CSS processing

## Common Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
supabase start       # Start local Supabase
supabase db reset    # Reset local database
supabase db push     # Push migrations to remote
supabase gen types typescript --local > lib/types/database.ts

# Testing
npm run test:unit           # Run unit tests
npm run test:integration    # Run integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:mcp           # Run MCP integration tests
npm run test:visual        # Run visual regression tests
npm run test:performance   # Run performance tests
npm run test:security      # Run security and isolation tests
npm run test:comprehensive # Run full test suite

# Specialized Testing
npm run test:workflow      # Test email processing workflows
npm run test:multilang     # Test multilingual processing
npm run test:isolation     # Test multi-tenant isolation
npm run test:accuracy      # Test AI categorization accuracy
```

## Model Context Protocol (MCP)

### Available MCP Servers
The project uses the following MCP servers for enhanced AI capabilities:

- **Context7 MCP** - Documentation and library context lookup
- **MagicUI MCP** - Component generation and UI development
- **Playwright MCP** - Browser automation for testing email workflows
- **Supabase MCP** - Direct database operations, migrations, and queries

### MCP Configuration
Current MCP servers configured in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["resolve-library-id", "get-library-docs"]
    },
    "magicui": {
      "command": "npx",
      "args": ["-y", "magicui-mcp"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "disabled": false,
      "autoApprove": ["getAllComponents", "getComponent", "getComponentsByType", "add-component", "list-components", "get-component-code", "search-components"]
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
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "sbp_b5cf0d1c6fc6040c66364258660abaa80a14d6b6"],
      "disabled": false,
      "autoApprove": ["apply_migration", "execute_sql", "get_project", "list_edge_functions"]
    }
  }
}
```

### MCP Usage Patterns
- **Database operations**: Use Supabase MCP for migrations, SQL queries, and project management
- **Testing**: Use Playwright MCP for end-to-end email processing workflow testing
- **Component development**: Use MagicUI MCP for UI component generation and management
- **Documentation**: Use Context7 MCP for library documentation and context lookup

### MCP Testing Best Practices
- Always test MCP integrations with real payloads when possible
- Use Playwright MCP for browser automation and visual testing
- Test Supabase MCP operations with proper cleanup and isolation
- Verify multi-tenant isolation in all MCP database tests
- Create synthetic email fixtures for consistent MCP testing
- Mock external MCP services in unit tests, use real services in integration tests

## Email Provider Abstraction

### Supported Providers
- **Cloudflare Workers Email Routing** - Default provider for email ingestion
- **Amazon SES Receive** - Alternative provider for AWS deployments

### Provider Configuration
- Use `INBOUND_PROVIDER` environment variable to select provider
- Provider-specific secrets: `CLOUDFLARE_EMAIL_SECRET`, `SES_WEBHOOK_SECRET`
- Runtime provider switching supported for testing and deployment flexibility

### Provider Interface
All providers implement the `InboundEmailProvider` interface:
- `verify(req: Request): Promise<boolean>` - HMAC signature verification
- `parse(req: Request): Promise<InboundEmailPayload>` - Payload normalization

## Configuration Files
- `next.config.mjs` - Next.js configuration with build error ignoring
- `tsconfig.json` - TypeScript configuration with path aliases
- `components.json` - shadcn/ui configuration
- `lib/config.ts` - Environment validation with Zod schemas
- `.kiro/settings/mcp.json` - MCP server configuration (optional)
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS v4
- `tailwind.config.ts` - Tailwind theme and content configuration