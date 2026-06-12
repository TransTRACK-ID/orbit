# Open Source Preparation Guide

This document is the master checklist for preparing [Orbit](https://github.com/TransTRACK-ID/orbit) for public release. Use [orbit-docs](https://github.com/TransTRACK-ID/orbit-docs) as the reference implementation — it already ships with community files, self-hosting docs, and neutral defaults.

## Current state (audit)

| Area | Status | Notes |
|------|--------|-------|
| License | Done | MIT in `LICENSE` |
| README | Needs work | Currently a one-line stub; orbit-docs has features, quick start, env table |
| Community files | Partial | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` added in this branch |
| `.env.example` | Partial | Core vars present; path/webhook vars documented |
| CI | Missing | No `.github/workflows/ci.yml` (see [CI_WORKFLOW.md](CI_WORKFLOW.md)) |
| Internal URLs | **Action required** | Hardcoded TransTRACK webhooks and infra scripts remain |
| Project template | **Action required** | `nuxt3-spa-starter` still contains company-specific assets and CI scripts |
| `@transtrack/ui` dependency | Review | Public npm package, but couples UI to TransTRACK branding |
| `package.json` `"private": true` | Review | Remove when publishing is intentional |

---

## What to remove

### 1. Internal infrastructure URLs and webhooks

These leak internal endpoints and should not ship in a public repo.

| File | Issue | Action |
|------|-------|--------|
| `server/utils/crash-notify.ts` | Default webhook `https://webhook.transtrack.id/...` | Remove default; only fire when `CRASH_WEBHOOK_URL` is set |
| `server/templates/nuxt3-spa-starter/notifier.sh` | Posts to `notifier-devops.transtrack.id` | **Delete** |
| `server/templates/nuxt3-spa-starter/report.sh` | Sonar/GitLab integration for `sonar.transtrack.id`, `repopo.transtrack.id` | **Delete** |
| `server/templates/nuxt3-spa-starter/trivyreport.sh` | GitLab MR notes to `repopo.transtrack.id` | **Delete** |

### 2. Company-specific template assets

The `nuxt3-spa-starter` template was forked from an internal SPA. Neutralize or remove:

| Item | Action |
|------|--------|
| `layouts/login.vue` — `logo-transtrack.png` references | Replace with generic Orbit/starter logos |
| `public/drowsiness-logo.svg` | Rename/replace with neutral asset |
| `components/icons/LogoOrderPlanningFull.vue` | Remove or replace with generic logo component |
| `README.md` (template) — `storybook.transtrack.id`, `@transtrack/nuxt-ui` | Rewrite for public consumers |
| `sonar-project.properties` | Remove if Sonar is internal-only |
| `docker-compose.deployment.*.yml` | Keep only if documented for self-hosters; otherwise remove |

### 3. Dev artifacts and scratch files

| File | Action |
|------|--------|
| `test_regex.js`, `test-regex.js` | Delete (local debugging scripts) |
| `.cursor/plans/` or `.plans/` internal design docs | Remove from repo or move to `docs/` if still relevant |
| `server/database/migrations/` (if generated locally) | Already gitignored — ensure no secrets in schema seeds |

### 4. Sensitive or environment-specific config

| Item | Action |
|------|--------|
| `opencode/opencode.json` (if present locally) | Must stay gitignored; document setup via `OPENCODE_CONFIG_BASE64` |
| `.transtrack/` cache dir | Already in `.gitignore` and `.dockerignore` |
| Real API keys in any committed file | Scan with `git log -p` before making public |

### 5. Hardcoded git identity

| File | Current | Replace with |
|------|---------|--------------|
| `server/utils/project-templates.ts` | `orbit@transtrack.ai` | `orbit@users.noreply.github.com` |

---

## What to improve

Follow the patterns established in [orbit-docs](https://github.com/TransTRACK-ID/orbit-docs).

### Documentation (mirror orbit-docs structure)

| File | Purpose | orbit-docs equivalent |
|------|---------|----------------------|
| `README.md` | Features, quick start, config table, doc index | `README.md` |
| `CONTRIBUTING.md` | Dev setup, branching, code conventions | `CONTRIBUTING.md` |
| `SECURITY.md` | Vulnerability reporting, self-host security notes | `SECURITY.md` |
| `CODE_OF_CONDUCT.md` | Community guidelines | (orbit-docs uses similar) |
| `docs/SELF_HOSTING.md` | Docker deployment, volumes, networking | Docker section in README |
| `docs/AGENT_RUNTIMES.md` | OpenCode, Cursor, browser QA setup | `DOC_AGENT` section |
| `docs/PROJECT_TEMPLATES.md` | Template usage and authoring | N/A (Orbit-specific) |
| `docs/CI_WORKFLOW.md` | CI workflow instructions | orbit-docs has `.github/workflows/` |

### GitHub community health

Add under `.github/`:

- `pull_request_template.md` — summary + test plan
- `ISSUE_TEMPLATE/bug_report.yml`
- `ISSUE_TEMPLATE/feature_request.yml`
- `ISSUE_TEMPLATE/config.yml` — link to `SECURITY.md` for vulnerabilities
- `workflows/ci.yml` — `pnpm install` + `pnpm build` on PRs (see [CI_WORKFLOW.md](CI_WORKFLOW.md))

### Configuration

Expand `.env.example` with documented optional vars (paths, webhooks, browser QA model). orbit-docs documents every integration key with comments — match that level of clarity.

### Code quality for OSS

| Change | Why |
|--------|-----|
| Remove `DEFAULT_WEBHOOK_URL` in crash-notify | Opt-in notifications only |
| Add `server/utils/paths.ts` with `getProjectsDir()` | Centralize `ORBIT_PROJECTS_DIR` instead of hardcoding `$HOME/orbit-projects` |
| Set `package.json` `"private": false` | When ready to publish to npm (optional — Orbit is primarily self-hosted) |
| Replace `@transtrack/ui` tailwind preset | Long-term: migrate to Flowbite/Tailwind directly or document the dependency |

### Docker / self-hosting

| Item | Improvement |
|------|-------------|
| `docker-compose.yml` | Document that `orbit-shared` external network is optional for standalone deploys |
| `Dockerfile` | Already well-documented; ensure no secrets in `opencode/` COPY paths |
| Default clone URL in docs | Use `https://github.com/TransTRACK-ID/orbit` |

### Testing before public release

- [ ] Fresh clone → `cp .env.example .env` → `pnpm install` → `pnpm dev` works
- [ ] `pnpm build` passes in CI
- [ ] Docker Compose starts without pre-existing `orbit-shared` network (or document creation)
- [ ] Template scaffold produces a repo without internal URLs
- [ ] No `transtrack.id` URLs in `git grep` (except documented optional deps)
- [ ] GitHub Security Advisories enabled on the repository

---

## Phased rollout

### Phase 1 — Documentation & community (low risk)

1. Expand `README.md`, add `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
2. Add `docs/SELF_HOSTING.md`, `docs/AGENT_RUNTIMES.md`, `docs/PROJECT_TEMPLATES.md`
3. Add GitHub issue/PR templates
4. Expand `.env.example`

### Phase 2 — Remove internal artifacts (medium risk)

1. Delete internal CI scripts from `nuxt3-spa-starter`
2. Remove hardcoded crash webhook default
3. Neutralize template branding (logos, README)
4. Delete scratch files (`test_regex.js`, etc.)
5. Fix git config email in `project-templates.ts`

### Phase 3 — CI & release (higher coordination)

1. Add `.github/workflows/ci.yml`
2. Enable GitHub vulnerability reporting
3. Tag first public release (`v0.1.0` or similar)
4. Announce alongside [orbit-docs](https://github.com/TransTRACK-ID/orbit-docs) as the documentation companion product

---

## orbit-docs vs Orbit — product positioning

| | **Orbit** | **orbit-docs** |
|---|-----------|----------------|
| Purpose | Kanban + AI agent orchestration for dev teams | Version-centric docs, changelogs, releases |
| Primary user | Project managers, tech leads | Technical writers, release managers |
| Agent integration | Task assignment, PR workflow, live preview | Doc generation (SRS/FSD/SDD), MCP server |
| Self-host | Docker + Postgres + optional agent runtimes | Docker + Postgres + optional AI keys |
| SSO | Session auth (register/login) | Google, GitHub, Azure AD, Keycloak, OIDC |

Both share: MIT license, TransTRACK copyright, Nuxt 3 + Drizzle + Postgres stack, Docker self-hosting, OpenCode/Cursor agent support.

---

## Quick grep audit

Run before making the repository public:

```bash
# Internal URLs (should return nothing after cleanup)
rg -i 'transtrack\.id|webhook\.transtrack|sonar\.transtrack|notifier-devops' --glob '!pnpm-lock.yaml' --glob '!package-lock.json'

# Secrets patterns (review any hits)
rg -i '(api[_-]?key|secret|password|token)\s*=\s*["\x27][^"\x27]{8,}' --glob '!*.example' --glob '!.env*'
```

---

## Related work

A prior open-source prep branch (`docs/d21d2054/raihan/open-source-preparation-copy`) implemented many of the items above. This guide consolidates that work with gaps found on current `main` (reviews features, empty README, remaining internal URLs).
