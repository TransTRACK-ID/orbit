# Live Preview System — Full Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Live Preview system to support production-build previews only, with framework-agnostic adapter architecture supporting Nuxt, Next.js, Vue, React, Laravel, Flutter Web, and any future framework.

**Architecture:** Replace the dev-server-orchestrator + raw HTTP proxy with an adapter-based build-then-serve system. Each framework gets a PreviewAdapter that knows how to detect, build, and serve. Static outputs are served via a production-grade static server; SSR outputs are served via framework-specific production servers. A database-persisted state replaces the in-memory Map.

**Tech Stack:** TypeScript, Nitro (existing), Drizzle ORM (existing), serve-handler (static serving), http-proxy-middleware (SSR proxying), Docker (optional Phase 5)

---

## Database Schema Changes

### Task 1: Create `preview_instances` Table Migration

**Files:**
- Create: `server/database/migrations/000X_create_preview_instances.sql`
- Modify: `server/database/schema.ts` (add table definition)

**Step 1: Write migration**

```sql
CREATE TABLE preview_instances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'building',
  framework TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'build',
  port INTEGER,
  worktree_dir TEXT NOT NULL,
  output_dir TEXT,
  pid INTEGER,
  logs TEXT[] DEFAULT '{}',
  fail_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_preview_instances_task ON preview_instances(task_id);
CREATE INDEX idx_preview_instances_status ON preview_instances(status);
```

**Step 2: Add Drizzle schema definition**

In `server/database/schema.ts`, add:

```typescript
export const previewInstances = pgTable('preview_instances', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['building', 'running', 'failed', 'stopped'] }).notNull().default('building'),
  framework: text('framework').notNull(),
  mode: text('mode', { enum: ['build'] }).notNull().default('build'),
  port: integer('port'),
  worktreeDir: text('worktree_dir').notNull(),
  outputDir: text('output_dir'),
  pid: integer('pid'),
  logs: text('logs').array().default(sql`ARRAY[]::text[]`),
  failReason: text('fail_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**Step 3: Run migration**

```bash
cd /Users/zeinersyad/emdash-projects/orbit
npx drizzle-kit push
```

**Step 4: Commit**

```bash
git add server/database/
git commit -m "feat(preview): add preview_instances table for persistent state"
```

---

## Preview Adapter Interface

### Task 2: Create PreviewAdapter Interface

**Files:**
- Create: `server/utils/preview-adapters/types.ts`

**Step 1: Write interface definitions**

```typescript
export interface PreviewConfig {
  taskId: string;
  instanceId: string;
  port: number;
  baseUrl: string;
  worktreeDir: string;
  envVars: Record<string, string>;
}

export interface BuildResult {
  success: boolean;
  outputDir: string;
  isStatic: boolean;
  error?: string;
}

export interface ServerInfo {
  pid: number;
  port: number;
  command: string;
  isStaticServer: boolean;
}

export interface PreviewAdapter {
  name: string;
  
  /** Detect if this adapter applies to the project */
  detect(worktreeDir: string): Promise<boolean>;
  
  /** Build the project for preview */
  build(config: PreviewConfig): Promise<BuildResult>;
  
  /** Start serving the built output */
  start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo>;
  
  /** Stop the preview server */
  stop(serverInfo: ServerInfo): Promise<void>;
}
```

**Step 2: Commit**

```bash
git add server/utils/preview-adapters/types.ts
git commit -m "feat(preview): add PreviewAdapter interface"
```

---

## Nuxt Adapter

### Task 3: Implement NuxtPreviewAdapter

**Files:**
- Create: `server/utils/preview-adapters/nuxt-adapter.ts`

**Step 1: Write adapter implementation**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types';

const execAsync = promisify(exec);

export const NuxtAdapter: PreviewAdapter = {
  name: 'nuxt',
  
  async detect(worktreeDir: string): Promise<boolean> {
    const pkgPath = path.join(worktreeDir, 'package.json');
    if (!existsSync(pkgPath)) return false;
    
    const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return 'nuxt' in deps;
  },
  
  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, port, envVars, baseUrl } = config;
    
    // Set build-time env vars so assets get correct paths
    const buildEnv = {
      ...process.env,
      ...envVars,
      NUXT_APP_BASE_URL: baseUrl,
      NUXT_PUBLIC_API_BASE_URL: baseUrl.replace(/\/$/, ''),
      API_BASE_URL: `http://127.0.0.1:${port}${baseUrl}`,
      NODE_ENV: 'production',
    };
    
    try {
      // Run nuxt build
      const buildResult = await execAsync('npx nuxt build', {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000, // 5 minutes
      });
      
      if (buildResult.stderr) {
        console.warn('[nuxt-adapter] build stderr:', buildResult.stderr);
      }
      
      // Determine output directory
      const staticOutput = path.join(worktreeDir, '.output', 'public');
      const serverOutput = path.join(worktreeDir, '.output');
      
      if (existsSync(staticOutput)) {
        return { success: true, outputDir: staticOutput, isStatic: true };
      }
      
      if (existsSync(serverOutput)) {
        return { success: true, outputDir: serverOutput, isStatic: false };
      }
      
      return { success: false, outputDir: '', isStatic: true, error: 'Build completed but no output directory found' };
    } catch (error: any) {
      return { success: false, outputDir: '', isStatic: true, error: error.message };
    }
  },
  
  async start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo> {
    const { port, worktreeDir } = config;
    
    if (buildResult.isStatic) {
      // For static output, we don't need a separate process
      // The static file server will handle it
      return {
        pid: 0,
        port,
        command: 'static',
        isStaticServer: true,
      };
    }
    
    // For SSR output, start nuxt preview
    const proc = spawn('npx', ['nuxt', 'preview', '--port', String(port)], {
      cwd: worktreeDir,
      env: {
        ...process.env,
        PORT: String(port),
        NUXT_PORT: String(port),
      },
      stdio: 'pipe',
    });
    
    return {
      pid: proc.pid || 0,
      port,
      command: `npx nuxt preview --port ${port}`,
      isStaticServer: false,
    };
  },
  
  async stop(serverInfo: ServerInfo): Promise<void> {
    if (serverInfo.pid > 0) {
      try {
        process.kill(serverInfo.pid, 'SIGTERM');
      } catch {
        // Process may already be dead
      }
    }
  }
};
```

**Step 2: Commit**

```bash
git add server/utils/preview-adapters/nuxt-adapter.ts
git commit -m "feat(preview): add NuxtPreviewAdapter"
```

---

## Vite Adapter (Vue/React/Angular)

### Task 4: Implement VitePreviewAdapter

**Files:**
- Create: `server/utils/preview-adapters/vite-adapter.ts`

**Step 1: Write adapter implementation**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types';

const execAsync = promisify(exec);

export const ViteAdapter: PreviewAdapter = {
  name: 'vite',
  
  async detect(worktreeDir: string): Promise<boolean> {
    const hasViteConfig = existsSync(path.join(worktreeDir, 'vite.config.ts')) ||
                         existsSync(path.join(worktreeDir, 'vite.config.js'));
    
    if (!hasViteConfig) return false;
    
    // Check it's not Nuxt (which also uses Vite but has its own adapter)
    const pkgPath = path.join(worktreeDir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if ('nuxt' in deps) return false;
    }
    
    return true;
  },
  
  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, envVars } = config;
    
    const buildEnv = {
      ...process.env,
      ...envVars,
      NODE_ENV: 'production',
    };
    
    try {
      const result = await execAsync('npm run build', {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      });
      
      // Vite outputs to dist/ by default
      const outputDir = path.join(worktreeDir, 'dist');
      
      if (existsSync(outputDir)) {
        return { success: true, outputDir, isStatic: true };
      }
      
      return { success: false, outputDir: '', isStatic: true, error: 'dist/ directory not found after build' };
    } catch (error: any) {
      return { success: false, outputDir: '', isStatic: true, error: error.message };
    }
  },
  
  async start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo> {
    return {
      pid: 0,
      port: config.port,
      command: 'static',
      isStaticServer: true,
    };
  },
  
  async stop(serverInfo: ServerInfo): Promise<void> {
    // Static server — nothing to kill
  }
};
```

**Step 2: Commit**

```bash
git add server/utils/preview-adapters/vite-adapter.ts
git commit -m "feat(preview): add VitePreviewAdapter for Vue/React/Angular"
```

---

## Next.js Adapter

### Task 5: Implement NextJsPreviewAdapter

**Files:**
- Create: `server/utils/preview-adapters/nextjs-adapter.ts`

**Step 1: Write adapter implementation**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types';

const execAsync = promisify(exec);

export const NextJsAdapter: PreviewAdapter = {
  name: 'nextjs',
  
  async detect(worktreeDir: string): Promise<boolean> {
    const pkgPath = path.join(worktreeDir, 'package.json');
    if (!existsSync(pkgPath)) return false;
    
    const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return 'next' in deps;
  },
  
  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, port, envVars, baseUrl } = config;
    
    const buildEnv = {
      ...process.env,
      ...envVars,
      NEXT_PUBLIC_BASE_PATH: baseUrl.replace(/\/$/, ''),
      NODE_ENV: 'production',
    };
    
    try {
      const result = await execAsync('npx next build', {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      });
      
      // Check for static export
      const staticOutput = path.join(worktreeDir, 'out');
      const serverOutput = path.join(worktreeDir, '.next');
      
      if (existsSync(staticOutput)) {
        return { success: true, outputDir: staticOutput, isStatic: true };
      }
      
      if (existsSync(serverOutput)) {
        return { success: true, outputDir: serverOutput, isStatic: false };
      }
      
      return { success: false, outputDir: '', isStatic: true, error: 'No output directory found' };
    } catch (error: any) {
      return { success: false, outputDir: '', isStatic: true, error: error.message };
    }
  },
  
  async start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo> {
    const { port, worktreeDir } = config;
    
    if (buildResult.isStatic) {
      return {
        pid: 0,
        port,
        command: 'static',
        isStaticServer: true,
      };
    }
    
    // Start Next.js production server
    const proc = spawn('npx', ['next', 'start', '--port', String(port)], {
      cwd: worktreeDir,
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: 'pipe',
    });
    
    return {
      pid: proc.pid || 0,
      port,
      command: `npx next start --port ${port}`,
      isStaticServer: false,
    };
  },
  
  async stop(serverInfo: ServerInfo): Promise<void> {
    if (serverInfo.pid > 0) {
      try {
        process.kill(serverInfo.pid, 'SIGTERM');
      } catch {}
    }
  }
};
```

**Step 2: Commit**

```bash
git add server/utils/preview-adapters/nextjs-adapter.ts
git commit -m "feat(preview): add NextJsPreviewAdapter"
```

---

## Static File Server

### Task 6: Create Static Preview Server

**Files:**
- Create: `server/utils/preview-static-server.ts`
- Install: `npm install serve-handler`

**Step 1: Install dependency**

```bash
cd /Users/zeinersyad/emdash-projects/orbit
npm install serve-handler
npm install -D @types/serve-handler
```

**Step 2: Write static server**

```typescript
import http from 'http';
import handler from 'serve-handler';

export function createStaticServer(outputDir: string, port: number): http.Server {
  const server = http.createServer((req, res) => {
    return handler(req, res, {
      public: outputDir,
      // SPA fallback: serve index.html for non-file routes
      rewrites: [
        { source: '!**/*.@(js|css|png|jpg|jpeg|gif|svg|ico|woff2|woff|ttf|eot|map|json)', destination: '/index.html' }
      ],
      // Disable caching for preview freshness
      headers: [
        {
          source: '**',
          headers: [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }
          ]
        }
      ]
    });
  });
  
  server.listen(port, '127.0.0.1');
  return server;
}
```

**Step 3: Commit**

```bash
git add package*.json server/utils/preview-static-server.ts
git commit -m "feat(preview): add static file server for built outputs"
```

---

## Adapter Registry

### Task 7: Create Adapter Registry

**Files:**
- Create: `server/utils/preview-adapters/index.ts`

**Step 1: Write registry**

```typescript
import { NuxtAdapter } from './nuxt-adapter';
import { ViteAdapter } from './vite-adapter';
import { NextJsAdapter } from './nextjs-adapter';
import type { PreviewAdapter } from './types';

const adapters: PreviewAdapter[] = [
  NuxtAdapter,
  NextJsAdapter,
  ViteAdapter,
  // Laravel and Flutter adapters can be added here
];

export async function detectFramework(worktreeDir: string): Promise<PreviewAdapter | null> {
  for (const adapter of adapters) {
    if (await adapter.detect(worktreeDir)) {
      return adapter;
    }
  }
  return null;
}

export { NuxtAdapter, ViteAdapter, NextJsAdapter };
export type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types';
```

**Step 2: Commit**

```bash
git add server/utils/preview-adapters/index.ts
git commit -m "feat(preview): add adapter registry with auto-detection"
```

---

## New Orchestrator

### Task 8: Create Preview Orchestrator

**Files:**
- Create: `server/utils/preview-orchestrator.ts`
- Create: `server/utils/preview-logger.ts`

**Step 1: Write logger utility**

```typescript
// server/utils/preview-logger.ts
import { getDb, schema } from '~/server/database';
import { eq } from 'drizzle-orm';

export async function appendPreviewLog(instanceId: string, line: string): Promise<void> {
  const db = getDb();
  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.id, instanceId),
  });
  
  if (!instance) return;
  
  const logs = [...instance.logs, line].slice(-500);
  
  await db.update(schema.previewInstances)
    .set({ logs })
    .where(eq(schema.previewInstances.id, instanceId));
}
```

**Step 2: Write orchestrator**

```typescript
// server/utils/preview-orchestrator.ts
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import http from 'http';
import { getDb, schema } from '~/server/database';
import { eq } from 'drizzle-orm';
import { detectFramework } from './preview-adapters';
import { createStaticServer } from './preview-static-server';
import type { PreviewConfig } from './preview-adapters/types';
import { appendPreviewLog } from './preview-logger';
import { resolveCloneDir, resolveWorktreeDir } from './worktree-resolver';

// Track active servers in memory (for quick access)
const activeServers = new Map<string, { server: http.Server; isStatic: boolean }>();

function getAvailablePort(): number {
  const used = Array.from(activeServers.values()).map(s => s.server.address()?.port).filter(Boolean);
  let port: number;
  do {
    port = 9000 + Math.floor(Math.random() * 1000);
  } while (used.includes(port));
  return port;
}

export async function startPreview(
  taskId: string,
  repositoryId: string | undefined,
  worktreeDir: string
): Promise<{ instanceId: string; url: string }> {
  const db = getDb();
  
  // Detect framework
  const adapter = await detectFramework(worktreeDir);
  if (!adapter) {
    throw new Error('No framework detected. Cannot build preview.');
  }
  
  await appendPreviewLog(instanceId, `Detected framework: ${adapter.name}`);
  
  // Create DB record
  const [instance] = await db.insert(schema.previewInstances)
    .values({
      taskId,
      framework: adapter.name,
      status: 'building',
      worktreeDir,
    })
    .returning();
  
  const instanceId = instance.id;
  const port = getAvailablePort();
  const baseUrl = `/api/preview/${instanceId}/`;
  
  const config: PreviewConfig = {
    taskId,
    instanceId,
    port,
    baseUrl,
    worktreeDir,
    envVars: {
      ORBIT_PREVIEW: 'true',
      NUXT_IS_PREVIEW: 'true',
    },
  };
  
  try {
    // Build
    await appendPreviewLog(instanceId, 'Starting build...');
    const buildResult = await adapter.build(config);
    
    if (!buildResult.success) {
      await db.update(schema.previewInstances)
        .set({ status: 'failed', failReason: buildResult.error })
        .where(eq(schema.previewInstances.id, instanceId));
      throw new Error(`Build failed: ${buildResult.error}`);
    }
    
    await db.update(schema.previewInstances)
      .set({ outputDir: buildResult.outputDir, status: 'running' })
      .where(eq(schema.previewInstances.id, instanceId));
    
    await appendPreviewLog(instanceId, `Build complete. Output: ${buildResult.outputDir}`);
    
    // Start serving
    let server: http.Server;
    
    if (buildResult.isStatic) {
      // Static output — serve directly
      server = createStaticServer(buildResult.outputDir, port);
      await appendPreviewLog(instanceId, `Static server listening on port ${port}`);
    } else {
      // SSR output — start production server
      const serverInfo = await adapter.start(config, buildResult);
      await db.update(schema.previewInstances)
        .set({ pid: serverInfo.pid, port: serverInfo.port })
        .where(eq(schema.previewInstances.id, instanceId));
      await appendPreviewLog(instanceId, `Production server started (pid: ${serverInfo.pid})`);
      
      // For SSR, we still proxy. Create a minimal proxy server.
      server = http.createServer((req, res) => {
        // Proxy to production server
        const proxyReq = http.request({
          hostname: '127.0.0.1',
          port: serverInfo.port,
          path: req.url,
          method: req.method,
          headers: req.headers,
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        });
        
        req.pipe(proxyReq);
      });
      
      server.listen(port, '127.0.0.1');
    }
    
    activeServers.set(instanceId, { server, isStatic: buildResult.isStatic });
    
    return {
      instanceId,
      url: `/api/preview/${instanceId}`,
    };
  } catch (error: any) {
    await db.update(schema.previewInstances)
      .set({ status: 'failed', failReason: error.message })
      .where(eq(schema.previewInstances.id, instanceId));
    throw error;
  }
}

export async function stopPreview(instanceId: string): Promise<void> {
  const db = getDb();
  const active = activeServers.get(instanceId);
  
  if (active) {
    active.server.close();
    activeServers.delete(instanceId);
  }
  
  await db.update(schema.previewInstances)
    .set({ status: 'stopped' })
    .where(eq(schema.previewInstances.id, instanceId));
}

export async function getPreviewStatus(instanceId: string) {
  const db = getDb();
  return db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.id, instanceId),
  });
}
```

**Step 3: Commit**

```bash
git add server/utils/preview-orchestrator.ts server/utils/preview-logger.ts
git commit -m "feat(preview): add new preview orchestrator with DB persistence"
```

---

## New Proxy Handler

### Task 9: Replace Proxy with Simplified Version

**Files:**
- Create: `server/api/preview/[instanceId].ts`
- Create: `server/api/preview/[instanceId]/[...path].ts`

**Step 1: Write new proxy handlers**

```typescript
// server/api/preview/[instanceId].ts
import { proxyPreviewRequest } from '~/server/utils/preview-proxy-v2';

export default defineEventHandler(async (event) => {
  const { instanceId } = getRouterParams(event);
  return proxyPreviewRequest(event, instanceId);
});
```

```typescript
// server/api/preview/[instanceId]/[...path].ts
import { proxyPreviewRequest } from '~/server/utils/preview-proxy-v2';

export default defineEventHandler(async (event) => {
  const { instanceId } = getRouterParams(event);
  return proxyPreviewRequest(event, instanceId);
});
```

**Step 2: Write simplified proxy**

```typescript
// server/utils/preview-proxy-v2.ts
import http from 'http';
import { getDb, schema } from '~/server/database';
import { eq } from 'drizzle-orm';
import { requireAuth } from './auth';

export async function proxyPreviewRequest(event: any, instanceId: string): Promise<void> {
  const user = await requireAuth(event);
  
  const db = getDb();
  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.id, instanceId),
    with: { task: { with: { project: { with: { workspace: true } } } } },
  });
  
  if (!instance) {
    throw createError({ statusCode: 404, statusMessage: 'Preview not found' });
  }
  
  // Verify workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, instance.task.project.workspaceId), eq(wm.userId, user.id)),
  });
  
  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  
  if (instance.status !== 'running') {
    throw createError({ statusCode: 503, statusMessage: 'Preview is not running' });
  }
  
  const port = instance.port;
  if (!port) {
    throw createError({ statusCode: 503, statusMessage: 'Preview port not configured' });
  }
  
  return new Promise<void>((resolve, reject) => {
    const req = event.node.req;
    const res = event.node.res;
    
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port,
      path: req.url?.replace(`/api/preview/${instanceId}`, '') || '/',
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${port}`,
      },
      timeout: 30000,
    }, (proxyRes) => {
      // Strip iframe-blocking headers
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
      
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
      proxyRes.on('end', resolve);
      proxyRes.on('error', reject);
    });
    
    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end(`Preview proxy error: ${err.message}`);
      }
      reject(err);
    });
    
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.statusCode = 504;
        res.end('Preview proxy timeout');
      }
      reject(new Error('Timeout'));
    });
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
}
```

**Step 3: Commit**

```bash
git add server/api/preview/ server/utils/preview-proxy-v2.ts
git commit -m "feat(preview): add simplified v2 proxy for built outputs"
```

---

## API Routes Update

### Task 10: Update Preview API Routes

**Files:**
- Modify: `server/api/tasks/[id]/preview-start.post.ts`
- Modify: `server/api/tasks/[id]/preview-status.get.ts`
- Modify: `server/api/tasks/[id]/preview-restart.post.ts`

**Step 1: Update preview-start.post.ts**

Replace the content to use the new orchestrator:

```typescript
import { existsSync } from 'fs';
import { requireAuth } from '~/server/utils/auth';
import { getDb, schema } from '~/server/database';
import { eq } from 'drizzle-orm';
import { startPreview, stopPreview } from '~/server/utils/preview-orchestrator';
import { resolveCloneDir, resolveWorktreeDir } from '~/server/utils/worktree-resolver';

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { id } = getRouterParams(event);
  
  const db = getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      repository: true,
      project: { with: { workspace: true } },
    },
  });
  
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' });
  }
  
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  });
  
  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  
  if (!task.repository?.url) {
    throw createError({ statusCode: 400, statusMessage: 'Task has no repository' });
  }
  
  const cloneDir = resolveCloneDir(task.repository.url, task.repository.name);
  const worktreeDir = resolveWorktreeDir(cloneDir, task.id);
  
  if (!existsSync(worktreeDir)) {
    throw createError({ statusCode: 400, statusMessage: 'Task worktree not found. Run the agent first.' });
  }
  
  // Stop any existing preview
  const existing = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.taskId, task.id),
  });
  
  if (existing && existing.status === 'running') {
    await stopPreview(existing.id);
  }
  
  try {
    const result = await startPreview(task.id, task.repository.id || undefined, worktreeDir);
    return {
      available: true,
      url: result.url,
      instanceId: result.instanceId,
      message: 'Preview started successfully',
    };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: `Failed to start preview: ${err.message}` });
  }
});
```

**Step 2: Update preview-status.get.ts**

```typescript
import { requireAuth } from '~/server/utils/auth';
import { getDb, schema } from '~/server/database';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { id } = getRouterParams(event);
  
  const db = getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      repository: true,
      project: { with: { workspace: true } },
    },
  });
  
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' });
  }
  
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  });
  
  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
  
  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.taskId, task.id),
    orderBy: (instances, { desc }) => [desc(instances.createdAt)],
  });
  
  if (!instance) {
    return { available: false };
  }
  
  return {
    available: instance.status === 'running',
    starting: instance.status === 'building',
    failed: instance.status === 'failed',
    failReason: instance.failReason,
    url: instance.status === 'running' ? `/api/preview/${instance.id}` : null,
    instanceId: instance.id,
  };
});
```

**Step 3: Commit**

```bash
git add server/api/tasks/[id]/preview-start.post.ts server/api/tasks/[id]/preview-status.get.ts server/api/tasks/[id]/preview-restart.post.ts
git commit -m "feat(preview): update API routes to use new orchestrator"
```

---

## Cleanup Legacy Code

### Task 11: Remove Legacy Orchestrator and Proxy

**Files:**
- Delete: `server/utils/dev-server-orchestrator.ts` (after verifying new system works)
- Delete: `server/utils/preview-proxy.ts` (after migrating)
- Note: Keep old files until testing is complete, then remove

**Step 1: Mark legacy files as deprecated**

Add a comment at the top of each file:

```typescript
// @deprecated Use preview-orchestrator.ts and preview-proxy-v2.ts instead
// This file will be removed after the new system is fully tested
```

**Step 2: Commit**

```bash
git add server/utils/dev-server-orchestrator.ts server/utils/preview-proxy.ts
git commit -m "chore(preview): mark legacy orchestrator and proxy as deprecated"
```

---

## Frontend Updates

### Task 12: Update TaskSidePanel.vue

**Files:**
- Modify: `components/kanban/TaskSidePanel.vue`

**Step 1: Update preview URL references**

The frontend currently uses `previewUrl.value` which references `/api/preview/${taskId}`. This stays the same — the new system uses the same URL structure but with `instanceId` instead of `taskId`.

Update the `previewIframeUrl` computed to use `instanceId`:

```typescript
const previewInstanceId = ref('');

const previewIframeUrl = computed(() => {
  if (!previewUrl.value || !previewInstanceId.value) return '';
  const base = previewUrl.value.replace(/\/$/, '');
  const path = committedPreviewPath.value.startsWith('/') ? committedPreviewPath.value : '/' + committedPreviewPath.value;
  return base + path;
});
```

**Step 2: Update status polling**

In the status polling function, extract `instanceId` from the response:

```typescript
const status = await $fetch(`/api/tasks/${task.value.id}/preview-status`);
previewInstanceId.value = status.instanceId || '';
```

**Step 3: Commit**

```bash
git add components/kanban/TaskSidePanel.vue
git commit -m "feat(preview): update frontend to use instanceId-based URLs"
```

---

## Testing Plan

### Task 13: Create Preview System Tests

**Files:**
- Create: `tests/preview-system.test.ts` (or similar)

**Step 1: Write tests**

Test cases to cover:
1. Framework detection (Nuxt, Vite, Next.js)
2. Build process (success and failure)
3. Static file serving
4. SSR proxy serving
5. Stop and cleanup
6. Database state persistence
7. Auth/workspace access control

**Step 2: Commit**

```bash
git add tests/
git commit -m "test(preview): add preview system test suite"
```

---

## Documentation

### Task 14: Update Architecture Documentation

**Files:**
- Update: `docs/LIVE_PREVIEW.md`
- Create: `docs/PREVIEW_ADAPTERS.md`

**Step 1: Update LIVE_PREVIEW.md**

Replace the entire document with the new architecture description.

**Step 2: Create adapter documentation**

Document how to add a new adapter:
1. Create adapter file
2. Implement interface
3. Add to registry
4. Document build command and output directory

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs(preview): update architecture docs for new system"
```

---

## Execution Order

**Phase 1: Foundation (Tasks 1-3)**
1. Database migration
2. Adapter interface
3. Nuxt adapter

**Phase 2: Core System (Tasks 4-7)**
4. Vite adapter
5. Next.js adapter
6. Static server
7. Adapter registry

**Phase 3: Orchestrator (Tasks 8-10)**
8. New orchestrator
9. New proxy
10. API routes

**Phase 4: Integration (Tasks 11-14)**
11. Cleanup legacy
12. Frontend updates
13. Tests
14. Documentation

---

## Key Design Decisions

1. **No dev mode** — Only production builds. This eliminates HMR, Vite IPC, and WebSocket complexity.

2. **Base URL at build time** — Framework-specific env vars bake the preview path into generated assets. No runtime URL rewriting needed.

3. **Static-first** — Most frameworks output static files. Only SSR frameworks (Nuxt SSR, Next.js SSR) need a running production server.

4. **Database persistence** — Preview state survives server restarts and is queryable.

5. **Simple proxy** — No response body rewriting. Proxy only handles path stripping and iframe headers.

6. **Framework auto-detection** — Adapters are tried in order. First matching adapter wins.

## Questions for Review

1. Should we support Laravel in Phase 1 or Phase 2? (Requires PHP in container)
2. Should we support Flutter Web in Phase 1 or Phase 2? (Requires Flutter SDK)
3. Do we need the old dev mode as a fallback option?
4. Should we add Docker container isolation in Phase 1 or later?
5. What port range should we use? (Currently 9000-9999)
