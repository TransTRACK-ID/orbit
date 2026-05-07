<template>
  <div
    class="log-panel-fixed fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-50 flex flex-col overflow-hidden transition-all duration-200"
    :class="isOpen ? 'open h-[280px]' : 'h-0'"
  >
    <div class="flex items-center gap-2.5 px-4 py-1.5 border-b border-surface-200 flex-shrink-0">
      <Icon name="lucide:terminal" class="w-3 h-3 text-accent" />
      <h4 class="text-[11px] font-semibold">Activity Log</h4>
      <span class="text-[10px] text-surface-400 ml-auto">{{ workspaceName }} · {{ totalCount }} entries</span>
      <button
        class="px-2 py-0.5 rounded text-[10px] font-semibold border border-surface-200 hover:bg-surface-50 transition-colors"
        @click="toggle"
      >Close</button>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-1">
      <div v-if="allEntries.length > 0">
        <div
          v-for="entry in allEntries"
          :key="entry.key"
          class="flex items-start gap-2 py-1.5 text-[11px] border-b border-surface-50 last:border-0"
        >
          <!-- Entity type badge -->
          <span
            class="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase whitespace-nowrap"
            :class="badgeClass(entry.entityType)"
          >{{ entry.entityIcon }} {{ entry.entityType }}</span>

          <!-- User -->
          <span class="flex-shrink-0 font-semibold text-surface-700 whitespace-nowrap">{{ entry.userName }}</span>

          <!-- Message -->
          <span class="text-surface-600 flex-1 min-w-0 truncate">{{ entry.message }}</span>

          <!-- Time -->
          <span class="flex-shrink-0 text-surface-400 whitespace-nowrap">{{ entry.timeLabel }}</span>
        </div>
      </div>
      <div v-else class="text-center py-4 text-[11px] text-surface-400">No activity yet</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActivityFeedItem } from '~/types'

const route = useRoute()
const { isOpen, logs, feed, toggle, fetchFeed } = useLog()

const workspaceName = ref('')
const workspaceId = ref('')

const entityTypeMeta: Record<string, { icon: string; badge: string }> = {
  workspace: { icon: '⚡', badge: 'bg-purple-100 text-purple-700' },
  project: { icon: '📋', badge: 'bg-blue-100 text-blue-700' },
  task: { icon: '☑', badge: 'bg-green-100 text-green-700' },
  agent: { icon: '🤖', badge: 'bg-amber-100 text-amber-700' },
  runtime: { icon: '▶', badge: 'bg-primary-100 text-primary-700' },
  system: { icon: '⚙', badge: 'bg-gray-100 text-gray-600' },
  general: { icon: '•', badge: 'bg-surface-100 text-surface-600' },
}

function badgeClass(entityType: string): string {
  return entityTypeMeta[entityType]?.badge || entityTypeMeta.general.badge
}

const allEntries = computed(() => {
  const result: {
    key: string
    entityType: string
    entityIcon: string
    userName: string
    message: string
    timeLabel: string
    time: number
  }[] = []

  // Persisted feed entries
  for (const item of feed.value) {
    const meta = entityTypeMeta[item.entityType] || entityTypeMeta.general
    result.push({
      key: `feed-${item.id}`,
      entityType: item.entityType,
      entityIcon: meta.icon,
      userName: item.user?.name || 'System',
      message: item.message,
      timeLabel: formatRelativeTime(item.createdAt),
      time: new Date(item.createdAt).getTime(),
    })
  }

  // In-memory logs (prepend)
  for (const log of logs.value) {
    const entityType = log.agent === 'Runtime' ? 'runtime' : 'system'
    const meta = entityTypeMeta[entityType] || entityTypeMeta.general
    result.push({
      key: `mem-${log.time}`,
      entityType,
      entityIcon: meta.icon,
      userName: log.agent,
      message: log.msg,
      timeLabel: formatTime(log.time),
      time: log.time,
    })
  }

  return result.sort((a, b) => b.time - a.time).slice(0, 200)
})

const totalCount = computed(() => allEntries.value.length)

async function resolveWorkspace() {
  const slug = route.params.slug as string
  if (!slug) return

  try {
    const workspaces = await $fetch<any[]>('/api/workspaces')
    const ws = workspaces.find((w: any) => w.slug === slug)
    if (ws) {
      workspaceId.value = ws.id
      workspaceName.value = ws.name
      await fetchFeed(ws.id)
    }
  } catch {}
}

onMounted(resolveWorkspace)

watch(() => route.params.slug, () => {
  resolveWorkspace()
})

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
</script>
