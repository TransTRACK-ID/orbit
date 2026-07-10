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

See `opencode/AGENTS.md` for agent behavior rules.

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

## Browser automation (MCP)

Agents with **Browser** enabled use [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) via the active CLI runtime (OpenCode or Cursor). The agent's existing LLM drives browser actions — **no separate browser API key**.

Browser runs headless inside the Orbit container using Chromium.

### Requirements

- Node.js `npx` on `PATH` (local dev) or pre-installed `chrome-devtools-mcp` (Docker image)
- Chromium or Chrome (`CHROME_PATH=/usr/bin/chromium` in Docker)

### Docker

The official image ships Chromium, `chrome-devtools-mcp`, and container-safe Chrome flags (`--no-sandbox`, `shm_size: 1gb` in compose). Rebuild after upgrades:

```bash
docker compose build --no-cache orbit-app && docker compose up -d
```

### Configuration (local dev)

Enable **Browser** on an agent in the Agents UI. Orbit injects MCP config into `.orbit/` (gitignored) at spawn time:

```bash
npx -y chrome-devtools-mcp@latest --headless --isolated=true
```

Optional:

```env
CHROME_PATH=/usr/bin/chromium   # custom Chrome/Chromium binary
```

### Preview (optional)

Orbit does **not** auto-start a dev server. If a preview is already running for the task, the agent prompt includes the preview URL. Otherwise the agent can navigate to external URLs from the task description.

Agents with **Repository** unchecked use a neutral session directory (`~/.orbit-sessions/<taskId>/`) and can test URLs outside the task repository.

## Runtime selection per agent

Individual agents can override the global `AGENT_RUNTIME` (OpenCode vs Cursor). Configure runtimes and the Browser / Repository toggles in the Agents UI.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Agent exits immediately | `OPENCODE_PATH` or `CURSOR_API_KEY` |
| No streaming output | Worktree directory exists under `ORBIT_PROJECTS_DIR` |
| Browser MCP not available | Agent has Browser enabled; `npx` and Chromium available |
| Browser enabled but tools not used | Check runtime logs for `Browser MCP ready: N tools`; Martin/Cursor QA tasks need MCP navigate + snapshot |
| Browser can't reach local preview | Start preview manually from the task panel first |
| Chrome launch fails in Docker | `CHROME_PATH` points to a valid Chromium binary |
