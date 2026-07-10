# Orbit

Orbit is a project management platform that blends traditional kanban task tracking with AI agent orchestration. Teams can organize work on boards, assign tasks to AI agents, review pull requests, and run live previews — all from a single workspace.

## Features

- **Kanban boards** — workspaces, projects, customizable columns, labels, and priorities
- **AI agent execution** — assign tasks to agents powered by OpenCode or Cursor CLI
- **Repository integration** — connect GitHub or GitLab repositories per project, or scaffold from built-in templates
- **Pull request workflow** — create, review, and track PRs linked to tasks
- **Brainstorm mode** — chat with agents about a repository before writing a PRD
- **Live preview** — spin up dev servers for task worktrees in isolated environments
- **Browser automation** — optional headless Chrome DevTools MCP on OpenCode or Cursor agents (uses the agent's existing LLM)
- **Self-hostable** — run with Docker Compose and your own Postgres database

## Quick start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- PostgreSQL 15+
- (Optional) [OpenCode](https://opencode.ai/) or Cursor CLI for agent execution

### Local development

```bash
cp .env.example .env
# Edit .env with your Postgres URL and NUXT_AUTH_SECRET (32+ characters)

pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), register an account, and create a workspace.

Schema is managed with Drizzle ORM. Operators run migrations separately — see `CONTRIBUTING.md` for schema conventions.

**Upgrading:** If you have an existing database, apply `server/database/migrations/0001_browser_mcp.sql` before starting the new version (or run `pnpm db:push` on a fresh schema).

### Docker

```bash
cp .env.example .env
docker compose up --build
```

By default, repository clones are stored in `~/orbit-projects` on the host (mounted into the container). See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for full deployment details.

## Configuration

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | PostgreSQL connection string |
| `NUXT_AUTH_SECRET` | Session secret (32+ characters) |
| `AGENT_RUNTIME` | `opencode` (default) or `cursor` |
| `OPENCODE_PATH` | Path to OpenCode binary |
| `OPENCODE_CONFIG_BASE64` | Base64-encoded `opencode/opencode.json` |
| `CURSOR_API_KEY` | Required when using Cursor runtime |
| `ORBIT_PROJECTS_DIR` | Where git clones/worktrees are stored |
| `ORBIT_ATTACHMENTS_DIR` | Where uploaded attachments are stored |
| `CRASH_WEBHOOK_URL` | Optional webhook for agent crash notifications |
| `CHROME_PATH` | Chromium binary for Chrome DevTools MCP (default in Docker image) |

See [.env.example](.env.example) for the full list.

## Project templates

Orbit ships with built-in project templates so you can scaffold a new repository without leaving the UI.

**In the app:** Create Project → **From Template** → pick a starter (e.g. **Nuxt 3 SPA Starter**) → configure name and variables. Orbit copies the template into `ORBIT_PROJECTS_DIR`, substitutes placeholders, and initializes git. You can also use templates from **Brainstorm** when creating a new repository.

**Bring your own repo:** Create a blank project and connect an existing GitHub/GitLab repository in workspace settings — templates are optional.

| Template | Stack | What you get |
|----------|-------|--------------|
| `nuxt3-spa-starter` | Node / Nuxt 3 | SPA with Pinia, Tailwind, auth scaffolding, PWA, and Vitest |

Template sources live in `server/templates/`; registry in `server/data/templates.json`. Super admins can add templates via **Admin → Templates**.

See [docs/PROJECT_TEMPLATES.md](docs/PROJECT_TEMPLATES.md) for variables, customization, and how to author new templates.

## Architecture

```
Browser (Vue/Nuxt)
       │
       ▼
  Nuxt server (H3 API routes)
       │
       ├── PostgreSQL (Drizzle ORM)
       ├── ~/orbit-projects (git clones & worktrees)
       └── Agent runtimes (OpenCode / Cursor + optional Chrome DevTools MCP)
```

## Documentation

- [Open source preparation guide](docs/OPEN_SOURCE_PREPARATION.md) — checklist for public release
- [PRODUCT.md](PRODUCT.md) — product vision and design principles
- [DESIGN.md](DESIGN.md) — color, typography, and component guidelines
- [CONTRIBUTING.md](CONTRIBUTING.md) — development setup and code conventions
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) — Docker and production deployment
- [docs/AGENT_RUNTIMES.md](docs/AGENT_RUNTIMES.md) — OpenCode, Cursor, and Chrome DevTools MCP setup
- [docs/PROJECT_TEMPLATES.md](docs/PROJECT_TEMPLATES.md) — scaffold projects from built-in templates
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community guidelines

## Related projects

- [orbit-docs](https://github.com/TransTRACK-ID/orbit-docs) — version-centric documentation, changelogs, and release management (companion product)

## License

[MIT](LICENSE) — Copyright (c) 2026 TransTRACK
