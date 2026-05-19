# Live Preview System Architecture

## Overview

The Live Preview system allows users to preview a development server running inside a Docker container through the main Orbit application. It works by:

1. Spawning a nested Nuxt dev server inside a Docker container (port 9000-9999)
2. Proxying all requests through `/api/preview/{taskId}/` to that dev server
3. Rewriting asset URLs and headers so the iframe can render the nested app

## File Structure

```
server/
├── api/
│   └── preview/
│       ├── [taskId].ts              # Base route: handles /api/preview/{taskId}/
│       └── [taskId]/
│           └── [...path].ts         # Catch-all: handles /api/preview/{taskId}/_nuxt/...
├── utils/
│   ├── dev-server-orchestrator.ts   # Spawns and manages dev servers
│   └── preview-proxy.ts             # Shared proxy logic (HTTP forwarding)
```

## How It Works

### 1. Route Registration

Two separate routes handle different path patterns:

- **`[taskId].ts`** — Matches exactly `/api/preview/{taskId}` or `/api/preview/{taskId}/` (no sub-paths)
- **`[taskId]/[...path].ts`** — Matches `/api/preview/{taskId}/_nuxt/entry.js` (any sub-paths)

**Why two routes?** Nitro's `[...path]` catch-all requires at least one path segment. Without the base route, `/api/preview/{taskId}/` returns 404.

### 2. Dev Server Spawn

When a user clicks "Start Preview":

1. `preview-start.post.ts` calls `startDevServer(worktreeDir, repositoryId, taskId)`
2. The orchestrator:
   - Installs dependencies with `bun install`
   - Runs `nuxt prepare`
   - Spawns `nuxt dev --port {randomPort}`
   - Sets `NUXT_APP_BASE_URL=/api/preview/{taskId}/` so Nuxt knows its base URL
3. Waits for the port to respond with HTTP 200 (not 503)

### 3. Request Proxying

When the browser requests `/api/preview/{taskId}/`:

1. The parent app's Nitro router matches the `[taskId].ts` route
2. `proxyPreviewRequest()` is called with the full `event.path`
3. The proxy forwards the **full path** (including `/api/preview/{taskId}/`) to `localhost:{devServerPort}`
4. The nested Nuxt dev server, knowing its `NUXT_APP_BASE_URL`, strips the prefix and serves the content

### 4. Response Processing

Before sending the response back to the browser:

- **Asset URL rewriting**: All `/_nuxt/`, `/@vite/`, etc. URLs are rewritten to include `/api/preview/{taskId}/` prefix so the browser routes them back through the proxy
- **Header stripping**: `X-Frame-Options` and `Content-Security-Policy` are removed so the iframe can render
- **Redirect trapping**: `Location` headers are rewritten to stay within `/api/preview/{taskId}/` boundary

## Key Design Decisions

### Why `NUXT_APP_BASE_URL`?

Nuxt's base URL is for **URL generation** (what Nuxt writes in HTML/JS), not for **request routing**. When we forward the full path `/api/preview/{taskId}/` to the dev server, Nuxt sees this as its own base URL and routes correctly.

### Why strip proxy prefix from browser but forward full path to dev server?

The browser sees `/api/preview/{taskId}/_nuxt/entry.js` → proxy forwards `/api/preview/{taskId}/_nuxt/entry.js` → Nuxt strips its base URL → serves `/_nuxt/entry.js`.

### Why not use `[[...path]]` (optional catch-all)?

Optional catch-all `[[...path]]` doesn't work reliably in Nitro for empty paths. Using two explicit routes is more predictable.

## Common Issues & Fixes

### Issue: 404 on preview URL
**Cause**: Old compiled build missing the catch-all route  
**Fix**: Rebuild Docker image with `--no-cache`

### Issue: "too many redirects"
**Cause**: Stripping proxy prefix before forwarding; Nuxt redirects to its base URL  
**Fix**: Forward full path including `/api/preview/{taskId}/`

### Issue: "Expected a JavaScript module but got text/html"
**Cause**: Stripping `/_nuxt/` prefix from asset paths; Nuxt returns `index.html` fallback  
**Fix**: Don't strip `/_nuxt/` — forward paths exactly as-is

### Issue: `ERR_BLOCKED_BY_RESPONSE` in iframe
**Cause**: `X-Frame-Options: DENY` or CSP headers from nested app  
**Fix**: Strip `X-Frame-Options` and `Content-Security-Policy` in proxy response

### Issue: Redirects escape the iframe (go to `/login` on parent origin)
**Cause**: `Location: /login` header forwarded verbatim  
**Fix**: Rewrite `Location` headers to include `/api/preview/{taskId}/` prefix

## Debugging Checklist

1. Check compiled routes exist:
   ```bash
   docker exec orbit-web sh -c "grep -E \"route: '/api/preview[^']*'\" /app/.output/server/chunks/nitro/nitro.mjs"
   # Should show BOTH:
   # route: '/api/preview/:taskId'
   # route: '/api/preview/:taskId/**:path'
   ```

2. Check handler is invoked:
   ```bash
   docker logs -f orbit-web | grep "HANDLER INVOKED"
   ```

3. Check dev server status:
   ```bash
   curl http://localhost:3031/api/tasks/{taskId}/preview-status
   ```

4. Test directly against container:
   ```bash
   curl -v http://localhost:3031/api/preview/{taskId}/
   ```

## Environment Variables

- `NUXT_APP_BASE_URL` — Set when spawning dev server so Nuxt knows its base path
- `PORT` / `NUXT_PORT` / `VITE_PORT` — Random port (9000-9999) assigned to dev server
- `AUTH_ORIGIN` — Set to `http://localhost:{port}` so auth works in preview

## Build Requirements

The `.output/` directory is **gitignored** and compiled at Docker build time. After any server route changes, you MUST:

```bash
docker compose down
docker compose build --no-cache web
docker compose up -d web
```

## Security Considerations

- Preview iframe uses `sandbox="allow-scripts allow-same-origin"` (standard browser warning)
- Auth middleware (`requireAuth`) runs before proxying
- Workspace membership is verified before serving preview
- Anti-framing headers are stripped to allow iframe rendering (intentional for preview use case)
