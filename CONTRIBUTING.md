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

- Reusable business logic and path helpers
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

See [docs/AGENT_RUNTIMES.md](docs/AGENT_RUNTIMES.md) for full setup instructions for OpenCode, Cursor CLI, and browser MCP.

## Project templates

Built-in templates live in `server/templates/` and are registered in `server/data/templates.json`. To add or modify a template, see [docs/PROJECT_TEMPLATES.md](docs/PROJECT_TEMPLATES.md).

## Open source preparation

If you are preparing Orbit for public release, see [docs/OPEN_SOURCE_PREPARATION.md](docs/OPEN_SOURCE_PREPARATION.md) for the removal/improvement checklist.

## Questions?

Open a GitHub issue for bugs or feature requests. For security issues, see [SECURITY.md](SECURITY.md).
