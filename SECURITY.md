# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Orbit, please report it responsibly:

1. **Do not** open a public GitHub issue for security-sensitive findings
2. Email the maintainers or use GitHub's private vulnerability reporting (if enabled on the repository)
3. Include steps to reproduce, impact assessment, and any suggested fix

We aim to acknowledge reports within 5 business days.

## Supported versions

Security fixes are applied to the latest release on the `main` branch.

## Security notes for self-hosters

- **Authentication:** Orbit uses session-based auth via `@sidebase/nuxt-auth`. Set a strong `NUXT_AUTH_SECRET` (32+ characters).
- **Repository tokens:** Users supply GitHub/GitLab tokens per workspace. Treat these as secrets and restrict database access accordingly.
- **Agent execution:** Agent runtimes execute shell commands in cloned repositories. Only connect repositories you trust and restrict who can trigger agent runs.
- **Docker socket:** The default `docker-compose.yml` mounts `/var/run/docker.sock` for browser QA agents. Disable or remove this mount if you do not need browser testing.
- **Crash webhooks:** Set `CRASH_WEBHOOK_URL` only if you want agent crash notifications sent to an external endpoint.
