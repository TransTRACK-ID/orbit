# Live Preview System — Redesign: Best Practices & Architecture

## Executive Summary

The current live preview system works for basic Nuxt SPA previews but has fundamental architectural limitations that prevent it from supporting SSR, WebSocket/HMR, Flutter, and Laravel properly. This document outlines a **preview adapter architecture** that isolates each framework's requirements while providing a unified proxy and UI experience.

---

## Current Pain Points

| Issue | Current Behavior | Impact |
|---|---|---|
| **SSR Disabled** | `nuxt.config.preview-override.ts` forces `ssr: false` | Cannot preview SSR apps, SEO meta, server routes, or hydration behavior |
| **No WebSocket Proxy** | Raw `http.request()` can't upgrade connections | HMR broken; full page reload on every change |
| **Framework Lock-in** | Hardcoded Nuxt patches, basic Laravel detection | Other frameworks (Next.js, SvelteKit, Flutter) get no special handling |
| **In-Memory State** | `activeDevServers` Map is lost on server restart | Previews die silently; no recovery after deploy |
| **Fragile URL Rewriting** | Regex string replacement of asset URLs | Breaks on edge cases (inline JS, data URLs, dynamic imports) |
| **No Isolation** | Dev servers run in main process namespace | Port collisions, process leaks, security boundaries blurred |
| **Flutter Unsupported** | No Flutter detection or build logic | Cannot preview mobile UI at all |
| **Laravel Unhandled** | Detected but no base-URL or asset rewriting | Asset URLs break, routes may 404 |

---

## Recommended Architecture: Preview Adapter System

### Core Principle

Instead of one "orchestrator" that tries to handle every framework, create a **pluggable adapter interface**. Each adapter knows how to:
1. Detect if it applies to a project
2. Install dependencies / build the project
3. Start a preview server (dev mode OR production build)
4. Provide proxy configuration (WebSocket support, base URL, headers)

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Orbit Main App (Nuxt)                                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  TaskSidePanel.vue                                  │  │
│  │  - PreviewModal (iframe)                            │  │
│  │  - LogViewer (streaming)                              │  │
│  │  - PathNavigator                                      │  │
│  └────────────────────┬────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────┴────────────────────────────────┐  │
│  │  Preview Orchestrator (persistent state in DB)      │  │
│  │  - DB table: `preview_instances`                    │  │
│  │  - Adapter registry: Map<framework, PreviewAdapter> │  │
│  └────────────────────┬────────────────────────────────┘  │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        │ POST /api/preview-instances
                        │ GET  /api/preview-instances/:id/status
                        │ GET  /api/preview-instances/:id/logs
                        │ WS   /api/preview-instances/:id/logs-stream
                        │
┌───────────────────────┼─────────────────────────────────────┐
│                       │                                     │
│  ┌────────────────────┴────────────────────────────────┐  │
│  │  Reverse Proxy (Traefik / Nginx / Caddy)           │  │
│  │  - Dynamic route: /api/preview/:instanceId/*        │  │
│  │  - WebSocket upgrade handling                        │  │
│  │  - Automatic discovery from Docker labels / ports   │  │
│  └────────────────────┬────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────┴────────────────────────────────┐  │
│  │  Preview Container (Docker — one per instance)      │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Preview Adapter (inside container)          │  │  │
│  │  │  - Framework detection                       │  │  │
│  │  │  - Dependency install                        │  │  │
│  │  │  - Build / dev server start                  │  │  │
│  │  │  - Health reporting                          │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Adapter Interface

```typescript
interface PreviewAdapter {
  /** Name of the adapter */
  name: string;
  
  /** Detect if this adapter can handle the project */
  detect(worktreeDir: string): Promise<boolean>;
  
  /** Build or prepare the project for preview */
  build(worktreeDir: string, config: PreviewConfig): Promise<BuildResult>;
  
  /** Start the preview server */
  start(worktreeDir: string, config: PreviewConfig): Promise<ServerInfo>;
  
  /** Stop the preview server */
  stop(serverInfo: ServerInfo): Promise<void>;
  
  /** Get health status */
  healthCheck(serverInfo: ServerInfo): Promise<HealthStatus>;
  
  /** Framework-specific proxy rules */
  proxyRules: ProxyRule[];
}

interface PreviewConfig {
  taskId: string;
  instanceId: string;
  baseUrl: string;        // e.g., /api/preview/:instanceId
  port: number;
  envVars: Record<string, string>;
  mode: 'dev' | 'build';  // dev server vs production build
}

interface ServerInfo {
  pid: number;
  port: number;
  command: string;
  process: ChildProcess;
}
```

---

## Framework-Specific Strategies

### 1. Nuxt / Vue (SSR Support)

**Problem**: Current system disables SSR because of Vite Node IPC race condition.

**Solutions** (choose one based on use case):

#### Option A: Build-then-Preview (Recommended for QA/Review)
```bash
# In the preview container
nuxt build
nuxt preview --port $PORT
```
- **Pros**: True SSR behavior, production-like, no Vite Node IPC issues
- **Cons**: Slower startup (~30-60s for build), not live-reloading
- **Best for**: Final QA, SSR verification, testing production behavior

#### Option B: Dev Server with SSR Fix
Instead of disabling SSR, fix the root cause:
```typescript
// In adapter, set env var BEFORE any imports
const env = {
  ...process.env,
  NUXT_VITE_NODE_OPTIONS: JSON.stringify({
    socketPath: `/tmp/vite-node-${instanceId}.sock`
  }),
  // Ensure the socket path is set before any module loads it
};
```
Start the dev server with this env var already present, preventing the race condition.

#### Option C: Hybrid Mode
- **Dev mode** for active development (fast feedback, accept SPA-only)
- **Build mode** triggered on-demand for SSR verification

### 2. Flutter

**Web Preview**:
```bash
flutter build web --release
# Serve the build/web/ directory with a static file server
python3 -m http.server $PORT --directory build/web/
```

**Mobile Preview** (screenshot-based):
```
┌──────────────────────────────────────────┐
│  Flutter Preview Container               │
│  ┌────────────────────────────────────┐  │
│  │  Android Emulator (headless)     │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │  Screenshot Service          │  │  │
│  │  │  - Captures every 2s           │  │  │
│  │  │  - Streams to WebSocket        │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 3. Laravel

```bash
# Option 1: Artisan dev server (simple, no SSR issues)
php artisan serve --port=$PORT

# Option 2: Production-like (recommended)
composer install --no-dev
php artisan optimize
php artisan config:cache
php-fpm + nginx (in same container)
```

**Key configuration**:
- Set `APP_URL` to the preview base URL
- Configure nginx to serve from `public/` directory
- Handle `/_assets/` or `/storage/` routes properly

---

## Critical Infrastructure Changes

### 1. Replace HTTP Proxy with WebSocket-Capable Proxy

**Current**: Raw Node `http.request()`
**Recommended**: Use `http-proxy-middleware` or a dedicated reverse proxy

```typescript
// Using http-proxy-middleware (Express-style)
import { createProxyMiddleware } from 'http-proxy-middleware';

const previewProxy = createProxyMiddleware({
  target: 'http://localhost:9000',
  changeOrigin: true,
  ws: true, // <-- WebSocket support
  pathRewrite: {
    '^/api/preview/:taskId': '/', // Strip prefix
  },
  onProxyRes: (proxyRes, req, res) => {
    // Strip iframe-blocking headers
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
  },
});
```

**Even better**: Deploy **Traefik** or **Caddy** as a sidecar container. They handle WebSocket upgrades, automatic discovery, and path rewriting natively.

### 2. Persistent State in Database

```sql
CREATE TABLE preview_instances (
  id TEXT PRIMARY KEY,           -- uuid
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'starting' | 'running' | 'failed' | 'stopped'
  framework TEXT NOT NULL,       -- 'nuxt' | 'flutter' | 'laravel' | 'next'
  mode TEXT NOT NULL,            -- 'dev' | 'build'
  port INTEGER,
  container_id TEXT,             -- Docker container ID
  base_url TEXT,
  logs TEXT[],                   -- Array of recent log lines
  fail_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

**Benefits**:
- Survives server restarts
- Queryable for analytics
- Enables "resume preview" after deployment

### 3. Docker-Based Isolation

Each preview should run in its own Docker container:

```dockerfile
# preview-base/Dockerfile
FROM node:20-alpine
RUN apk add --no-cache git python3 make g++ php82 \
    flutter-sdk  # or mount as volume
WORKDIR /workspace
COPY ./start-preview.sh /usr/local/bin/
CMD ["start-preview.sh"]
```

```yaml
# docker-compose.yml (orchestrator adds these dynamically)
services:
  preview-nuxt-abc123:
    image: orbit-preview-base:latest
    volumes:
      - ~/.orbit-projects/repo/.task-abc123:/workspace
    environment:
      - PREVIEW_PORT=9001
      - PREVIEW_TASK_ID=abc123
      - NUXT_APP_BASE_URL=/api/preview/abc123/
    ports:
      - "9001:9001"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.preview-abc123.rule=PathPrefix(\`/api/preview/abc123/\`)"
      - "traefik.http.services.preview-abc123.loadbalancer.server.port=9001"
```

**Benefits**:
- Port isolation (no collisions)
- Resource limits (CPU/memory per preview)
- Clean shutdown (kill container, not process)
- Security boundary

### 4. Fix URL Rewriting (Base URL Strategy)

**Current**: Regex string replacement in response body
**Recommended**: Configure the dev server to generate correct URLs from the start

For each framework:
- **Nuxt**: `NUXT_APP_BASE_URL=/api/preview/:taskId/`
- **Vite**: `base: '/api/preview/:taskId/'`
- **Next.js**: `basePath: '/api/preview/:taskId'`
- **Laravel**: `APP_URL=https://orbit.app/api/preview/:taskId`

**When base URL isn't enough** (dev servers that don't support it):
Use an **HTML rewriter** like `cheerio` or `posthtml` for structured parsing instead of regex:
```typescript
import * as cheerio from 'cheerio';

const $ = cheerio.load(html);
$('script[src^="/"]').each((_, el) => {
  const src = $(el).attr('src');
  $(el).attr('src', proxyPrefix + src);
});
$('link[href^="/"]').each((_, el) => {
  const href = $(el).attr('href');
  $(el).attr('href', proxyPrefix + href);
});
return $.html();
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. Create `PreviewAdapter` interface
2. Extract Nuxt logic into `NuxtPreviewAdapter`
3. Add database migration for `preview_instances` table
4. Refactor orchestrator to use adapter pattern

### Phase 2: WebSocket & Proxy (Week 2)
1. Replace raw `http.request()` with `http-proxy-middleware` or integrate Traefik
2. Enable HMR for Nuxt/Vite previews
3. Test with Next.js adapter

### Phase 3: SSR Support (Week 3)
1. Implement `nuxt build` + `nuxt preview` mode
2. Add mode toggle in UI ("Dev Mode" vs "Build Mode")
3. Remove `ssr: false` hack

### Phase 4: Multi-Framework (Week 4)
1. Implement `LaravelPreviewAdapter`
2. Implement `FlutterWebPreviewAdapter`
3. Add framework auto-detection UI

### Phase 5: Isolation & Scale (Week 5-6)
1. Dockerize preview containers
2. Add resource limits
3. Implement cleanup policies (auto-stop after 30 min idle)

---

## Recommended Immediate Fixes (No Architecture Change)

If a full rewrite isn't feasible yet, these changes improve the current system:

### 1. Enable WebSocket Proxying
Replace `preview-proxy.ts` to handle `Upgrade` headers:
```typescript
if (req.headers.upgrade === 'websocket') {
  // Use a WebSocket-capable proxy library
  // or forward to ws://localhost:{port}
}
```

### 2. Add Port Collision Detection
```typescript
function getAvailablePort(): number {
  const used = Array.from(activeDevServers.values()).map(s => s.port);
  let port: number;
  do {
    port = 9000 + Math.floor(Math.random() * 1000);
  } while (used.includes(port));
  return port;
}
```

### 3. Use `nuxt preview` Instead of `nuxt dev` for SSR
When the user needs SSR verification, offer a "Build & Preview" button that runs:
```bash
nuxt build && nuxt preview --port $PORT
```
Instead of forcing `ssr: false`.

### 4. Add Basic Laravel Support
```typescript
function patchLaravelForPreview(worktreeDir: string, baseUrl: string): void {
  const envPath = path.join(worktreeDir, '.env');
  if (existsSync(envPath)) {
    let content = readFileSync(envPath, 'utf-8');
    content = content.replace(/APP_URL=.*/, `APP_URL=${baseUrl}`);
    writeFileSync(envPath, content);
  }
}
```

---

## Flutter Mobile Preview (Advanced)

For true mobile preview (not just Flutter Web), use a screenshot pipeline:

```
User clicks "Preview on Mobile" 
  → Orbit spins up Android Emulator container
  → Installs Flutter app APK
  → Starts screenshot service (adb shell screencap)
  → Streams JPEG frames over WebSocket
  → UI shows live "screen" in a phone-frame component
```

**Tools**:
- `docker-android` images for headless emulator
- `adb` for screenshot capture
- WebSocket for real-time streaming
- Canvas or `<img>` tag for display in UI

This is complex but provides the most realistic mobile preview.

---

## Summary: Key Recommendations

| Priority | Change | Effort | Impact |
|---|---|---|---|
| 🔴 Critical | Replace proxy with WebSocket-capable solution | Medium | Fixes HMR, live reload |
| 🔴 Critical | Implement Build-then-Preview mode for SSR | Medium | Enables true SSR preview |
| 🟡 High | Adapter pattern for framework support | Medium | Enables Laravel, Flutter, Next.js |
| 🟡 High | Persistent state in database | Low | Survives restarts, better UX |
| 🟢 Medium | Docker-based isolation | High | Security, scale, resource management |
| 🟢 Medium | HTML parser for URL rewriting | Low | More reliable than regex |
| 🔵 Low | Flutter mobile screenshot pipeline | High | Full mobile preview capability |

The **minimum viable fix** for your immediate SSR issue: Add a "Build Mode" that runs `nuxt build && nuxt preview` instead of `nuxt dev`, while keeping the existing dev mode for fast feedback. This gives you SSR previews without a full architecture rewrite.
