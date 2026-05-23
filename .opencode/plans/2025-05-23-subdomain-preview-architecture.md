# Implementation Plan: Cloudflare Subdomain Preview Architecture

## Goal
Replace iframe-based proxy preview with wildcard subdomain preview using Cloudflare Tunnel + Nitro middleware proxy.

## Architecture
```
User opens preview → new tab
  preview-{instanceId}.orbit.transtrack.ai
    ↓
  Cloudflare DNS (*.orbit.transtrack.ai)
    ↓
  cloudflared tunnel
    ↓
  http://localhost:3000 (Orbit app)
    ↓
  Nitro middleware: preview-subdomain-proxy.ts
    Checks Host header → preview-{id}.orbit.transtrack.ai
    Looks up instanceId in Map → gets port
    Proxies to localhost:{port}
    Preserves Host header (no path rewriting needed)
```

## Files to Modify

### 1. NEW: server/middleware/preview-subdomain-proxy.ts
- Intercepts requests with Host matching preview-{id}.orbit.transtrack.ai
- Looks up instanceId → port from in-memory Map (with DB fallback)
- Proxies to localhost:{port} preserving Host header
- No path rewriting, no cookie rewriting, no frame header stripping
- Exports: registerPreviewSubdomain(), unregisterPreviewSubdomain()

### 2. UPDATE: server/utils/preview-orchestrator.ts
- Import register/unregister functions from middleware
- In startPreview(): register subdomain after server starts
- In stopPreview(): unregister subdomain before cleanup
- Return subdomain URL instead of /api/preview/{id} path
- Remove isPreviewStatic export (no longer needed)

### 3. UPDATE: server/utils/preview-adapters/nuxt-adapter.ts
- Remove NUXT_APP_BASE_URL injection (not needed with subdomains)
- Keep ssr: false injection (SPA mode prevents server auth loops)
- Keep env var passthrough (DB URL, auth secrets)
- Build command stays `npx nuxt build`
- Start command stays `node .output/server/index.mjs`

### 4. UPDATE: server/api/tasks/[id]/preview-start.post.ts
- Return `url: https://preview-{instanceId}.orbit.transtrack.ai` instead of `/api/preview/{id}`

### 5. UPDATE: server/api/tasks/[id]/preview-restart.post.ts
- Same as above

### 6. UPDATE: components/kanban/TaskSidePanel.vue
- Replace iframe with preview status card + "Open Preview" button
- Button opens `previewUrl` in new tab (`target="_blank"`)
- Display subdomain URL with copy button
- Add warning: "⚠️ Logging into preview uses staging data"
- Keep logs panel for debugging
- Keep stop/restart buttons

### 7. DELETE: server/api/preview/[instanceId].ts
- Remove old proxy routes

### 8. DELETE: server/api/preview/[instanceId]/[...path].ts
- Remove old proxy routes

## One-Time Setup (User Action Required)

1. **Cloudflare DNS**: Add wildcard CNAME `*.orbit.transtrack.ai`
2. **Cloudflared config**: Add `*.orbit.transtrack.ai` ingress rule
3. **Restart cloudflared**

## Benefits
- Each preview has own origin → no path prefix issues
- Auth middleware works normally (paths are /login, /dashboard)
- No iframe sandbox restrictions
- No cookie conflicts (same domain but different paths OK)
- No memory leaks on restart (tab fully destroyed)
- Browser handles all navigation natively

## Testing Checklist
- [ ] Preview starts and returns subdomain URL
- [ ] New tab opens at preview-{id}.orbit.transtrack.ai
- [ ] Login page loads without redirect loops
- [ ] Login works with staging credentials
- [ ] Dashboard loads after login
- [ ] API calls work (real staging data)
- [ ] Stop/restart works cleanly
- [ ] No browser tab crashes
