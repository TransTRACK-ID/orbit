# Contributing to Orbit

Thank you for your interest in contributing! This guide covers local setup and the patterns used in the codebase.

## Development setup

1. Fork and clone the repository
2. Install [pnpm](https://pnpm.io/) and Node.js 20+
3. Copy `.env.example` to `.env` and configure `POSTGRES_URL` and `NUXT_AUTH_SECRET`
4. Run `pnpm install` and `pnpm dev`
5. Set up your database schema (operators handle migrations separately)

## Branch and PR flow

1. Create a feature branch from `main`
2. Make focused changes with clear commit messages
3. Open a pull request with a summary and test plan
4. Ensure CI passes (`pnpm build`)

## Code conventions

### Database (Drizzle ORM)

- Schema definitions live in `server/database/schema/`
- Use `pgTable`, `uuid` primary keys with `.defaultRandom()`, timestamps with `.defaultNow()`
- Export relations via `relations()` and re-export through `server/database/schema/index.ts`
- Access the database via `getDb()` from `server/database/index.ts`

### API routes (`server/api/`)

- H3 event handlers with `defineEventHandler`
- Authorization: `requireAuth`, `requireWorkspaceAccess`, or `requireProjectAccess`
- Return errors via `createError({ statusCode, statusMessage })`
- Delegate business logic to `server/utils/` when it grows beyond ~20 lines

### Server utilities (`server/utils/`)

- Reusable business logic and path helpers (see `server/utils/paths.ts`)
- Typed exported functions; avoid duplicating logic across routes

### Composables (`composables/`)

- Vue/Nuxt composables for client state and API calls
- Use `$fetch` with proper typing

### Types (`types/index.ts`)

- Shared TypeScript interfaces; avoid ad-hoc inline types across files

### Components (`components/`)

- Organized by domain: `general/`, `layout/`, `kanban/`, `project/`, etc.
- Follow naming conventions in `nuxt.config.ts`

## Agent runtimes

Orbit supports multiple agent backends:

| Runtime | Env var | Notes |
|---------|---------|-------|
| OpenCode | `AGENT_RUNTIME=opencode` | Default; requires OpenCode CLI on PATH |
| Cursor | `AGENT_RUNTIME=cursor` | Requires `CURSOR_API_KEY` |
| Browser QA | Per-agent config | Requires Docker and `FIREWORKS_API_KEY` |

## Questions?

Open a GitHub issue for bugs or feature requests. For security issues, see [SECURITY.md](SECURITY.md).
