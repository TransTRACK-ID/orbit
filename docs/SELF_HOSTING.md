# Self-hosting Orbit

This guide covers running Orbit with Docker Compose on your own infrastructure.

## Requirements

- Docker and Docker Compose
- PostgreSQL 15+ (external or containerized)
- Disk space for `~/orbit-projects` (git clones grow over time)
- (Optional) OpenCode or Cursor CLI inside the container for agent execution

## Quick start

```bash
git clone https://github.com/Zersya/orbit.git
cd orbit
cp .env.example .env
# Set POSTGRES_URL and NUXT_AUTH_SECRET

docker compose up --build -d
```

The app is exposed on port 3000 by default. For production, place a reverse proxy with TLS in front and set `AUTH_ORIGIN` to your public URL.

## Volume mounts

| Host path | Container path | Purpose |
|-----------|----------------|---------|
| `~/orbit-projects` | `/root/orbit-projects` | Git clones and task worktrees |
| `/var/run/docker.sock` | `/var/run/docker.sock` | Browser QA agent (optional) |

Override paths with environment variables:

```env
ORBIT_PROJECTS_DIR=/custom/path/orbit-projects
ORBIT_ATTACHMENTS_DIR=/custom/path/orbit-attachments
HOST_HOME=/home/youruser  # when mapping host paths into browser-agent containers
```

## Networking

The default `docker-compose.yml` creates a bridge network (`orbit-default`). For deployments that share a network with an external nginx reverse proxy, set:

```env
ORBIT_NETWORK=orbit-shared
```

and create the external network first: `docker network create orbit-shared`.

## Agent configuration

Encode your OpenCode config for the container:

```bash
base64 -i opencode/opencode.json | tr -d '\n'
```

Set the result as `OPENCODE_CONFIG_BASE64` in `.env`.

For Cursor agents, set `AGENT_RUNTIME=cursor`, `CURSOR_API_KEY`, and ensure `cursor-agent` is available in the container.

## First admin user

Register through the web UI. To grant super-admin access, update the user's role in the database directly (schema: `users.role = 'super_admin'`).

## Production checklist

- [ ] Strong `NUXT_AUTH_SECRET`
- [ ] TLS termination at reverse proxy
- [ ] `AUTH_ORIGIN` set to your public URL
- [ ] Postgres backups configured
- [ ] `~/orbit-projects` backed up or on persistent storage
- [ ] Docker socket mount removed if browser QA is not needed
