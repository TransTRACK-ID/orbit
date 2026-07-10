# Self-hosting Orbit

This guide covers running Orbit with Docker Compose on your own infrastructure.

## Requirements

- Docker and Docker Compose
- PostgreSQL 15+ (external or containerized)
- Disk space for `~/orbit-projects` (git clones grow over time)
- (Optional) OpenCode or Cursor CLI inside the container for agent execution

## Quick start

```bash
git clone https://github.com/TransTRACK-ID/orbit.git
cd orbit
cp .env.example .env
# Set POSTGRES_URL and NUXT_AUTH_SECRET

docker compose up --build -d
```

The app is exposed on port 3000 by default. For production, place a reverse proxy with TLS in front and set `AUTH_ORIGIN` to your public URL.

## Volume mounts

| Host path | Container path | Purpose |
|-----------|----------------|---------|
| `~/orbit-projects` | `/root/orbit-projects` | Git clones, task worktrees, and repos scaffolded from [project templates](PROJECT_TEMPLATES.md) |

Override paths with environment variables:

```env
ORBIT_PROJECTS_DIR=/custom/path/orbit-projects
ORBIT_ATTACHMENTS_DIR=/custom/path/orbit-attachments
```

## Networking

The default `docker-compose.yml` uses an external network (`orbit-shared`) for deployments that share a reverse proxy with other services (e.g. [orbit-docs](https://github.com/TransTRACK-ID/orbit-docs)). Create it before starting:

```bash
docker network create orbit-shared
```

For standalone deployments, you can change `docker-compose.yml` to use a local bridge network instead.

## Agent configuration

Encode your OpenCode config for the container:

```bash
base64 -i opencode/opencode.json | tr -d '\n'
```

Set the result as `OPENCODE_CONFIG_BASE64` in `.env`.

For Cursor agents, set `AGENT_RUNTIME=cursor`, `CURSOR_API_KEY`, and ensure `cursor-agent` is available in the container.

### Browser automation (Docker)

The Docker image includes everything for **Browser**-enabled agents:

- Chromium at `/usr/bin/chromium` (`CHROME_PATH`)
- `chrome-devtools-mcp` pre-installed globally
- Headless flags with `--no-sandbox` for container use

No separate browser API key is required — browser tools use the same OpenCode or Cursor LLM as coding tasks.

Enable **Browser** on an agent in the UI. Optional: start a task preview first so the agent can reach `http://localhost:3000/api/preview/...` inside the container.

After pulling this change, rebuild the image:

```bash
docker compose build --no-cache orbit-app
docker compose up -d
```

## First admin user

Register through the web UI. To grant super-admin access, update the user's role in the database directly (schema: `users.role = 'super_admin'`).

## Production checklist

- [ ] Strong `NUXT_AUTH_SECRET`
- [ ] TLS termination at reverse proxy
- [ ] `AUTH_ORIGIN` set to your public URL
- [ ] Postgres backups configured
- [ ] `~/orbit-projects` backed up or on persistent storage
