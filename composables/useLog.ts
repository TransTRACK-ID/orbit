import type { ActivityLogEntry, ActivityFeedItem } from '~/types'

export const useLog = () => {
  const logs = useState<ActivityLogEntry[]>('app:logs', () => [])
  const isOpen = useState<boolean>('app:logPanelOpen', () => false)
  const feed = useState<ActivityFeedItem[]>('app:activityFeed', () => [])

  function addLog(agent: string, msg: string, taskId?: string) {
    logs.value = [{ time: Date.now(), agent, msg, taskId }, ...logs.value]
    if (logs.value.length > 200) {
      logs.value = logs.value.slice(0, 200)
    }
  }

  async function persistLog(workspaceId: string, data: {
    message: string
    entityType?: string
    entityId?: string | null
    entityName?: string | null
    action?: string
    taskId?: string
  }) {
    try {
      await $fetch(`/api/workspaces/${workspaceId}/activity`, {
        method: 'POST',
        body: {
          message: data.message,
          entityType: data.entityType || 'general',
          entityId: data.entityId || null,
          entityName: data.entityName || null,
          action: data.action || 'update',
        },
      })
    } catch {}
  }

  async function fetchFeed(workspaceId: string, limit = 200) {
    try {
      feed.value = await $fetch<ActivityFeedItem[]>(
        `/api/workspaces/${workspaceId}/activity?limit=${limit}`
      )
    } catch {
      feed.value = []
    }
    return feed.value
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return {
    logs: readonly(logs),
    feed: readonly(feed),
    isOpen: readonly(isOpen),
    addLog,
    persistLog,
    fetchFeed,
    toggle,
    open,
    close,
  }
}
