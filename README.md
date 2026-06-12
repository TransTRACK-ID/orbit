# Orbit

Orbit is a project management platform that blends traditional kanban task tracking with AI agent orchestration. Teams can organize work on boards, assign tasks to AI agents, review pull requests, and run live previews — all from a single workspace.

## Features

- **Kanban boards** — workspaces, projects, customizable columns, labels, and priorities
- **AI agent execution** — assign tasks to agents powered by OpenCode or Cursor CLI
- **Repository integration** — connect GitHub or GitLab repositories per project
- **Pull request workflow** — create, review, and track PRs linked to tasks
- **Brainstorm mode** — chat with agents about a repository before writing a PRD
- **Live preview** — spin up dev servers for task worktrees in isolated environments
- **Browser QA agent** — optional headed/headless browser testing via Docker
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

> **Database setup:** Schema is managed with Drizzle ORM. Operators run migrations separately — see `CONTRIBUTING.md` for schema conventions.

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
| `BROWSER_QA_LLM_MODEL` | Fireworks model for browser QA agent (optional) |

See [.env.example](.env.example) for the full list.

## Project templates

Orbit can scaffold new repositories from built-in templates (e.g. Nuxt 3 SPA). Templates live in `server/templates/` and are configured in `server/data/templates.json`. You can also connect an existing repository instead of using a template.

## Architecture

```
Browser (Vue/Nuxt)
       │
       ▼
  Nuxt server (H3 API routes)
       │
       ├── PostgreSQL (Drizzle ORM)
       ├── ~/orbit-projects (git clones & worktrees)
       └── Agent runtimes (OpenCode / Cursor / browser-agent Docker)
```

## Documentation

- [PRODUCT.md](PRODUCT.md) — product vision and design principles
- [DESIGN.md](DESIGN.md) — color, typography, and component guidelines
- [CONTRIBUTING.md](CONTRIBUTING.md) — development setup and code conventions
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) — Docker and production deployment
- [docs/AGENT_RUNTIMES.md](docs/AGENT_RUNTIMES.md) — OpenCode, Cursor, and browser QA setup
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community guidelines

## License

[MIT](LICENSE) — Copyright TransTRACK 2026
