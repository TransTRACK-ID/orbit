# Agent Runtimes

Orbit supports multiple agent backends for task execution. Each runtime has different prerequisites and configuration.

## OpenCode (default)

OpenCode is the default agent runtime. It runs the OpenCode CLI against a task worktree and streams output back to the UI.

### Requirements

- OpenCode CLI installed and available on `PATH`, or set `OPENCODE_PATH`
- Provider API keys configured in `opencode/opencode.json` (or via `OPENCODE_CONFIG_BASE64` in Docker)

### Configuration

```env
AGENT_RUNTIME=opencode
OPENCODE_PATH=/path/to/opencode          # optional if on PATH
OPENCODE_CONFIG_BASE64=<base64-json>     # for Docker deployments
```

Encode your config for Docker:

```bash
base64 -i opencode/opencode.json | tr -d '\n'
```

See `opencode/opencode.json` and `opencode/AGENTS.md` for agent behavior rules.

## Cursor CLI

Cursor agents use the Cursor CLI (`cursor-agent`) instead of OpenCode.

### Requirements

- `cursor-agent` binary available in the container or host
- Valid `CURSOR_API_KEY`

### Configuration

```env
AGENT_RUNTIME=cursor
NUXT_AGENT_RUNTIME=cursor
NUXT_PUBLIC_AGENT_RUNTIME=cursor
CURSOR_API_KEY=your-api-key
CURSOR_MODEL=auto
```

Restart the dev server after changing runtime settings.

## Browser QA agent

The browser QA agent runs headed or headless browser tests inside a Docker container. It builds a live preview of the task worktree, then spawns `orbit/browser-agent:latest` to exercise the UI.

### Requirements

- Docker available on the host (socket mounted into the Orbit container)
- Fireworks or OpenAI-compatible API key
- `orbit/browser-agent:latest` image built (`docker compose build browser-agent`)

### Configuration

```env
FIREWORKS_API_KEY=your-key
# or
OPENAI_API_KEY=your-key

# Optional — override the default Fireworks model
BROWSER_QA_LLM_MODEL=accounts/fireworks/models/your-model

# Required when Orbit runs in Docker and spawns browser containers
WEB_CONTAINER_NAME=orbit-app
HOST_HOME=/home/youruser
```

The browser agent shares the web container's network namespace so it can reach the live preview at `localhost:3000`.

### Headed mode

When headed mode is enabled, the container exposes VNC on port 5900 for visual debugging.

## Runtime selection per agent

Individual agents in a workspace can override the global `AGENT_RUNTIME`. Configure this in the workspace settings UI under agent configuration.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Agent exits immediately | `OPENCODE_PATH` or `CURSOR_API_KEY` |
| No streaming output | Worktree directory exists under `ORBIT_PROJECTS_DIR` |
| Browser QA can't reach preview | `WEB_CONTAINER_NAME` and Docker socket mount |
| API key errors | `FIREWORKS_API_KEY` / `OPENAI_API_KEY` in `.env` |
