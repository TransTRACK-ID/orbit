import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, desc, or } from 'drizzle-orm'
import { activeProcesses } from '~/server/utils/runtime'
import { readFileSync } from 'fs'

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdmin(event)

  const db = getDb()

  // 1. Recent crash / error events from activity_logs
  const crashEvents = await db.query.activityLogs.findMany({
    where: or(
      eq(schema.activityLogs.action, 'agent_crash'),
      eq(schema.activityLogs.action, 'agent_error'),
    ),
    with: {
      task: {
        columns: { id: true, title: true },
      },
      user: {
        columns: { id: true, name: true, email: true },
      },
    },
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 50,
  })

  // 2. Current active agent processes
  const runningTasks = Array.from(activeProcesses.entries()).map(([taskId, entry]) => ({
    taskId,
    runtime: entry.runtime ?? 'unknown',
    pid: entry.proc.pid ?? null,
    exitCode: entry.proc.exitCode,
    signalCode: entry.proc.signalCode,
    streamCount: entry.streams.length,
  }))

  // 3. Node.js memory snapshot
  const mem = process.memoryUsage()
  const memoryMb = {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  }

  // 4. OOM indicators from /proc/meminfo (Linux/Docker only)
  let procMemInfo: Record<string, string> | null = null
  try {
    const raw = readFileSync('/proc/meminfo', 'utf-8')
    const lines = raw.split('\n').slice(0, 10) // MemTotal, MemFree, MemAvailable, etc.
    procMemInfo = Object.fromEntries(
      lines
        .filter(Boolean)
        .map(l => {
          const [key, ...rest] = l.split(':')
          return [key?.trim(), rest.join(':').trim()]
        })
        .filter(([k]) => k)
    )
  } catch {
    // Not available on macOS / non-Linux environments
  }

  // 5. Recent runtime_log entries for last 20 runs (admin-only full log view)
  const recentRuntimeLogs = await db.query.activityLogs.findMany({
    where: eq(schema.activityLogs.action, 'runtime_log'),
    with: {
      task: {
        columns: { id: true, title: true },
      },
    },
    orderBy: [desc(schema.activityLogs.createdAt)],
    limit: 200,
  })

  return {
    crashEvents: crashEvents.map(e => ({
      id: e.id,
      action: e.action,
      taskId: e.taskId,
      taskTitle: e.task?.title ?? 'Unknown',
      triggeredBy: e.user?.name ?? e.user?.email ?? 'system',
      exitCode: (e.newValue as any)?.exitCode ?? null,
      signal: (e.newValue as any)?.signal ?? null,
      message: (e.newValue as any)?.message ?? '',
      createdAt: e.createdAt,
    })),
    runningTasks,
    memoryMb,
    procMemInfo,
    recentRuntimeLogs: recentRuntimeLogs.map(l => ({
      id: l.id,
      taskId: l.taskId,
      taskTitle: (l as any).task?.title ?? 'Unknown',
      message: (l.newValue as any)?.message ?? '',
      createdAt: l.createdAt,
    })),
    generatedAt: new Date().toISOString(),
  }
})
