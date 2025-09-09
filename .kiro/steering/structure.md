# Project Structure

## Root Directory Organization

```
├── app/                    # Next.js App Router pages and API routes
│   ├── (app)/            # Authenticated app routes
│   │   ├── dashboard/    # Dashboard pages
│   │   ├── reports/      # Reports MVP pages
│   │   └── ...           # Other authenticated pages
│   ├── api/               # API route handlers
│   │   ├── reports/      # Reports API endpoints
│   │   └── ...           # Other API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout component
│   ├── loading.tsx        # Global loading UI
│   └── page.tsx           # Home page
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── reports/          # Reports-specific components
│   │   ├── widgets/      # Report widget components
│   │   ├── filters/      # Filter components
│   │   └── charts/       # Chart components
│   └── *.tsx             # Other custom components
├── hooks/                 # Custom React hooks
├── lib/                   # Core business logic and utilities
│   ├── database/         # Database utilities and helpers
│   ├── services/         # Business logic services
│   ├── supabase/         # Supabase client configuration
│   ├── types/            # TypeScript type definitions
│   ├── config.ts         # Environment configuration with Zod validation
│   └── utils.ts          # Utility functions
├── supabase/             # Database schema and migrations
│   └── migrations/       # SQL migration files
├── scripts/              # Utility scripts
├── docs/                 # Documentation
└── public/               # Static assets
```

## Key Architectural Patterns

### Configuration Management
- All environment variables validated through `lib/config.ts` using Zod schemas
- Type-safe configuration object exported for use throughout app
- Separate configs for different services (Supabase, OpenAI, email, etc.)

### Type Safety
- Database types generated from Supabase: `lib/types/database.ts`
- Business logic types in `lib/types/index.ts`
- Strict TypeScript configuration with path aliases (`@/*`)

### Service Layer Architecture
- Business logic isolated in `lib/services/`
- Each service handles specific domain (email processing, AI extraction, etc.)
- Services use dependency injection pattern for testability

### Database Layer
- Supabase client configuration in `lib/supabase/`
- Database utilities in `lib/database/`
- Row Level Security (RLS) policies for multi-tenant isolation
- Migration-driven schema changes

### API Routes
- RESTful API endpoints in `app/api/`
- Webhook handlers for email processing
- Proper error handling and validation

### Component Organization
- UI components follow shadcn/ui patterns
- Custom components in `components/` root
- Reusable hooks in `hooks/` directory

### Provider Abstraction Layer
- All email providers implement `InboundEmailProvider` interface
- Payload normalization ensures consistent processing
- Provider-specific configuration and error handling
- Runtime provider switching for deployment flexibility

### Testing Architecture
- Comprehensive test organization across unit, integration, E2E, MCP, and visual layers
- Synthetic data fixtures for consistent testing
- Multi-tenant isolation verification in all database tests
- Performance and security testing integrated into CI pipeline

## Naming Conventions
- Files: kebab-case (`email-parser.ts`)
- Components: PascalCase (`EmailProcessor.tsx`)
- Functions/variables: camelCase (`parseEmail`)
- Constants: UPPER_SNAKE_CASE (`MAX_EMAIL_SIZE`)
- Database tables: snake_case (`org_members`)

## Import Patterns
- Use path aliases: `@/lib/config` instead of `../../../lib/config`
- Group imports: external packages, then internal modules
- Type-only imports: `import type { User } from '@/lib/types'`