import { requireWorkspaceAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireWorkspaceAccess(event, id)
  const db = getDb()

  // Check if workspace already has docs apps
  const existing = await db.query.docsApps.findFirst({
    where: eq(schema.docsApps.workspaceId, id),
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Workspace already has docs apps' })
  }

  // Seed apps
  const appsData = [
    { name: 'API Gateway', slug: 'api-gateway', currentVersion: 'v2.4.1' },
    { name: 'Auth Service', slug: 'auth-service', currentVersion: 'v1.8.0' },
    { name: 'Payment Core', slug: 'payment-core', currentVersion: 'v3.1.2' },
    { name: 'User Dashboard', slug: 'user-dashboard', currentVersion: 'v4.0.0' },
  ]

  const createdApps = await Promise.all(
    appsData.map(async (app) => {
      const result = await db.insert(schema.docsApps).values({
        workspaceId: id,
        name: app.name,
        slug: app.slug,
        currentVersion: app.currentVersion,
      }).returning()
      return result[0]
    })
  )

  // Seed versions + releases
  const versionsSeed = [
    {
      appSlug: 'api-gateway',
      versions: [
        {
          version: 'v2.4.1', date: '2026-05-18', author: 'Sarah Chen', status: 'published',
          release: {
            published: true,
            heroTitle: 'Request tracing, deep health checks, and retry reliability',
            summary: 'Webhook retry fixes, X-Request-ID tracing, and deep health checks.',
            features: [
              { id: 'request-tracing', heading: 'Trace every request across your stack', description: 'The gateway now propagates X-Request-ID headers through every hop. When a client sends a request ID, the gateway forwards it to upstream services and includes it in all log entries.', media: [{ type: 'image', src: '', alt: 'Request flow diagram' }] },
              { id: 'deep-health', heading: 'Know when dependencies are actually healthy', description: 'The new /health/deep endpoint checks every configured upstream and database connection before returning 200.', media: [] },
            ],
            categories: {
              fixed: ['Webhook retry logic now correctly backs off after 3 failed attempts', 'Edge routes forward custom headers as documented', 'Rate-limit counters reset on configuration reload'],
              added: ['Support for X-Request-ID tracing through the gateway', 'New endpoint /health/deep for dependency checks'],
              changed: ['Default timeout increased from 30s to 60s for long-polling clients', 'Log format now includes upstream response time'],
            },
          },
        },
        {
          version: 'v2.4.0', date: '2026-05-10', author: 'Sarah Chen', status: 'published',
          release: {
            published: true,
            heroTitle: 'GraphQL complexity analysis and Brotli compression',
            summary: 'GraphQL complexity analysis, Brotli compression, and batch endpoint deprecation.',
            features: [
              { id: 'graphql-analysis', heading: 'GraphQL query complexity analysis', description: 'The gateway now analyzes GraphQL query complexity before execution. Queries exceeding configured thresholds are rejected early, preventing resource exhaustion attacks.', media: [{ type: 'image', src: '', alt: 'GraphQL complexity analyzer UI' }] },
            ],
            categories: {
              added: ['GraphQL query complexity analysis', 'Brotli compression for responses > 1KB'],
              deprecated: ['Legacy /v1/batch endpoint — migrate to /v2/batch by Q3'],
              security: ['Updated OpenSSL to 3.2.1', 'CVE-2026-3847 patched in auth middleware'],
            },
          },
        },
        {
          version: 'v2.3.5', date: '2026-04-20', author: 'Mike Ross', status: 'published',
          release: {
            published: true,
            heroTitle: 'Critical memory leak fix',
            summary: 'Critical fix for memory leak in connection pool under high load.',
            features: [],
            categories: { fixed: ['Memory leak in connection pool under high load'] },
          },
        },
        {
          version: 'v2.3.2', date: '2026-04-28', author: 'Mike Ross', status: 'archived',
          release: null,
        },
      ],
    },
    {
      appSlug: 'auth-service',
      versions: [
        {
          version: 'v1.8.0', date: '2026-05-08', author: 'Sarah Chen', status: 'published',
          release: {
            published: true,
            heroTitle: 'OAuth 2.1 PKCE and session rotation',
            summary: 'OAuth 2.1 PKCE support, session rotation, and refreshed token flows.',
            features: [
              { id: 'pkce', heading: 'OAuth 2.1 PKCE support', description: 'Public clients can now use Proof Key for Code Exchange (PKCE) for secure authorization flows without a client secret.', media: [{ type: 'video', src: '', alt: 'PKCE flow demonstration' }, { type: 'image', src: '', alt: 'PKCE configuration panel' }] },
            ],
            categories: {
              added: ['OAuth 2.1 PKCE support for public clients', 'Session rotation on token refresh', 'Refreshed token flows with sliding expiration'],
              fixed: ['Race condition in concurrent token refresh'],
              changed: ['Password policy now requires 12 characters minimum'],
              security: ['Hardened token validation against timing attacks'],
            },
          },
        },
        {
          version: 'v1.7.3', date: '2026-04-15', author: 'Jen Park', status: 'published',
          release: {
            published: true,
            heroTitle: 'Security patches',
            summary: 'CVE patches and hardened password validation rules.',
            features: [],
            categories: {
              security: ['CVE-2026-2911 patched in JWT library', 'Updated bcrypt to v5.1.1'],
            },
          },
        },
      ],
    },
    {
      appSlug: 'payment-core',
      versions: [
        {
          version: 'v3.1.2', date: '2026-05-05', author: 'Mike Ross', status: 'published',
          release: {
            published: true,
            heroTitle: 'Stripe webhook reliability improvements',
            summary: 'Stripe webhook idempotency fix and retry logic for failed payouts.',
            features: [
              { id: 'webhook-retry', heading: 'Automatic webhook retry with exponential backoff', description: 'Failed Stripe webhooks are now automatically retried with exponential backoff up to 24 hours. Each retry is idempotent, preventing duplicate processing.', media: [{ type: 'image', src: '', alt: 'Webhook retry timeline' }, { type: 'image', src: '', alt: 'Retry configuration settings' }] },
            ],
            categories: {
              fixed: ['Stripe webhook idempotency key collision', 'Payout retry logic for transient failures'],
              changed: ['Webhook timeout increased to 30 seconds'],
            },
          },
        },
      ],
    },
    {
      appSlug: 'user-dashboard',
      versions: [
        {
          version: 'v4.0.0', date: '2026-04-28', author: 'Jen Park', status: 'published',
          release: {
            published: true,
            heroTitle: 'Complete UI refresh with real-time analytics',
            summary: 'Complete UI refresh with real-time analytics and new role-based access.',
            features: [
              { id: 'ui-refresh', heading: 'New design system and component library', description: 'Every screen has been rebuilt with the new Orbit design system. Components are consistent, accessible, and responsive.', media: [{ type: 'video', src: '', alt: 'UI refresh walkthrough' }, { type: 'image', src: '', alt: 'New dashboard overview' }, { type: 'image', src: '', alt: 'Component gallery' }] },
              { id: 'realtime-analytics', heading: 'Real-time usage analytics', description: 'Live event stream shows active users, API calls, and error rates updating every 5 seconds.', media: [{ type: 'video', src: '', alt: 'Real-time analytics demo' }] },
            ],
            categories: {
              added: ['Real-time usage analytics dashboard', 'Role-based access control (RBAC)', 'Dark mode support', 'Export to CSV and PDF', 'Custom alert thresholds'],
              changed: ['Navigation reorganized by function', 'Settings consolidated into single panel', 'Notification preferences moved to profile'],
            },
          },
        },
      ],
    },
  ]

  for (const group of versionsSeed) {
    const app = createdApps.find(a => a.slug === group.appSlug)
    if (!app) continue

    for (const v of group.versions) {
      const versionResult = await db.insert(schema.docsVersions).values({
        appId: app.id,
        version: v.version,
        date: v.date,
        author: v.author,
        status: v.status,
      }).returning()

      if (v.release) {
        await db.insert(schema.docsReleases).values({
          versionId: versionResult[0].id,
          published: v.release.published,
          heroTitle: v.release.heroTitle,
          summary: v.release.summary,
          features: v.release.features,
          categories: v.release.categories,
        })
      }
    }
  }

  return { success: true, apps: createdApps.length }
})
