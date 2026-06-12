# Project templates

Orbit can scaffold new repositories from built-in project templates. This is useful when you want agents to work on a greenfield codebase without manually cloning and configuring a repo first.

## Using templates in the UI

### Create a project from a template

1. Open a workspace and click **Create Project**.
2. Choose **From Template** (or pick a template directly on first-project onboarding).
3. Select a template from the gallery (e.g. **Nuxt 3 SPA Starter**).
4. Fill in the configuration form (project name, API base URL, etc.).
5. Orbit copies the template into `ORBIT_PROJECTS_DIR`, substitutes variables, runs `git init`, and optionally pushes to a connected GitHub/GitLab remote.

You can also create a **blank project** and connect an existing repository in workspace settings instead of using a template.

### Create a repository from a template (Brainstorm)

In **Brainstorm** mode, choose **New repository** → pick a template → configure variables. Orbit creates the repo under your workspace so you can chat with an agent about the fresh codebase before writing a PRD.

## Built-in templates

| ID | Name | Stack | Description |
|----|------|-------|-------------|
| `nuxt3-spa-starter` | Nuxt 3 SPA Starter | node | Nuxt 3 SPA with Pinia, Tailwind CSS, auth scaffolding, PWA support, and Vitest |

Template metadata is defined in `server/data/templates.json`. Source files live under `server/templates/<template-id>/`.

### Nuxt 3 SPA Starter variables

When scaffolding `nuxt3-spa-starter`, Orbit prompts for:

| Variable | Required | Notes |
|----------|----------|-------|
| `projectName` | Yes | Used in `package.json` |
| `projectDescription` | No | Package description |
| `apiBaseUrl` | Yes | Default: `https://api.example.com` |
| `appKey` | Yes | Auto-generated 32-character key for `.env` |

Orbit replaces `{{variable}}` placeholders in configured files (see `fileSubstitutions` in `templates.json`), renames `.env.example` → `.env`, and creates an initial commit with message `chore: initialize from Orbit template`.

## Bring your own repository

Templates are optional. You can:

- Create a **blank project** and link any existing GitHub/GitLab repository in workspace settings.
- Point agents at repos you manage outside Orbit — clones and worktrees still live under `ORBIT_PROJECTS_DIR`.

## Adding or customizing templates

### For operators (super admin)

Super admins can manage templates from **Admin → Templates** in the web UI. Changes are persisted to `server/data/templates.json`.

### For contributors

1. Add template source files under `server/templates/<your-template-id>/`.
2. Register the template in `server/data/templates.json` with:
   - `sourcePath` — path relative to repo root (e.g. `server/templates/my-starter`)
   - `variables` — user inputs collected in the UI
   - `fileSubstitutions` — `{{key}}` replacements applied after copy
   - `renameFiles`, `postInitCommands`, `gitInit` — optional post-copy steps
3. Restart the dev server (templates are read from disk with a short cache).

See `server/utils/project-templates.ts` for the full `TemplateConfig` shape and initialization flow.

### Template source guidelines

- Exclude `node_modules`, `.git`, `dist`, and `.nuxt` from the template directory — Orbit skips these when copying.
- Use neutral defaults (no company-specific URLs, logos, or private package registries).
- Keep `postInitCommands` minimal; heavy installs can time out during scaffolding.
- Document any required env vars in the template's own `README.md`.

> **OSS note:** Before public release, remove internal CI scripts and branding from `nuxt3-spa-starter`. See [OPEN_SOURCE_PREPARATION.md](OPEN_SOURCE_PREPARATION.md).

## Storage and paths

Scaffolded repositories are written to:

```
$ORBIT_PROJECTS_DIR/<repository-name>/
```

Default: `~/orbit-projects` on the host (see [SELF_HOSTING.md](SELF_HOSTING.md)). Ensure this path is writable and has enough disk space for `node_modules` after agents run installs.
