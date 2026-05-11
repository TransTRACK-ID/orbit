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

interface LogEntry {
  key: string
  entityType: string
  entityIcon: string
  userName: string
  message: string
  timeLabel: string
  time: number
  taskId: string | null
  taskName: string | null
}

/** Derive a task label for grouping. Falls back to a short ID string. */
function taskLabel(taskId: string | null, taskName: string | null): string {
  if (taskName) return taskName
  if (taskId) return `Task ${taskId.slice(0, 8)}`
  return ''
}

const allEntries = computed(() => {
  const result: LogEntry[] = []

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
      taskId: item.entityType === 'task' || item.entityType === 'runtime' ? item.entityId : null,
      taskName: item.entityName,
    })
  }

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
      taskId: log.taskId || null,
      taskName: null,
    })
  }

  return result.sort((a, b) => b.time - a.time).slice(0, 200)
})

const totalCount = computed(() => allEntries.value.length)

// ─── Task-based grouping & collapse state ───

type EntryGroup = {
  id: string
  taskName: string
  entries: LogEntry[]
}

/** All groups collapsed by default — expandedIds tracks which are open. */
const expandedGroupIds = ref<Set<string>>(new Set())

function toggleGroup(id: string) {
  const next = new Set(expandedGroupIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedGroupIds.value = next
}

const groupedEntries = computed(() => {
  const groups = new Map<string, EntryGroup>()

  for (const entry of allEntries.value) {
    const groupId = entry.taskId || `_ungrouped_${entry.entityType}`

    if (!groups.has(groupId)) {
      groups.set(groupId, { id: groupId, taskName: '', entries: [] })
    }
    groups.get(groupId)!.entries.push(entry)
  }

  return Array.from(groups.values())
    .map(g => {
      // Resolve the best task name for this group — prefer the first
      // non-null taskName from a feed entry, then fall back to short ID.
      const named = g.entries.find(e => e.taskName)
      return {
        ...g,
        taskName: named?.taskName ||
          (g.id.startsWith('_ungrouped_')
            ? g.entries[0]?.entityType.charAt(0).toUpperCase() + g.entries[0]?.entityType.slice(1)
            : `Task ${g.id.slice(0, 8)}`),
        expanded: expandedGroupIds.value.has(g.id),
      }
    })
    .sort((a, b) => {
      const aTime = a.entries[0]?.time || 0
      const bTime = b.entries[0]?.time || 0
      return bTime - aTime
    })
})

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

<template>
  <div
    class="log-panel-fixed fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-50 flex flex-col overflow-hidden transition-all duration-200"
    :class="isOpen ? 'open h-[280px] max-lg:h-[60vh]' : 'h-0'"
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
      <div v-if="groupedEntries.length > 0">
        <div v-for="group in groupedEntries" :key="group.id">
          <!-- Group header -->
          <div
            class="flex items-center gap-2 py-2 text-[11px] cursor-pointer select-none hover:bg-surface-50 -mx-4 px-4 transition-colors sticky top-0 bg-white z-10 border-b border-surface-100"
            @click="toggleGroup(group.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-surface-400 transition-transform duration-150 flex-shrink-0"
              :class="{ 'rotate-90': group.expanded }"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span class="font-semibold text-surface-700 flex-1 min-w-0 truncate">{{ group.taskName }}</span>
            <span class="text-[10px] text-surface-400 flex-shrink-0">{{ group.entries.length }} entries</span>
          </div>

          <!-- Group entries (collapsed by default) -->
          <template v-if="group.expanded">
            <div
              v-for="entry in group.entries"
              :key="entry.key"
              class="flex items-start gap-2 py-1.5 text-[11px] border-b border-surface-50 last:border-0 pl-1"
            >
              <span
                class="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase whitespace-nowrap"
                :class="badgeClass(entry.entityType)"
              >{{ entry.entityIcon }} {{ entry.entityType }}</span>
              <span class="flex-shrink-0 font-semibold text-surface-700 whitespace-nowrap">{{ entry.userName }}</span>
              <span class="text-surface-600 flex-1 min-w-0 truncate">{{ entry.message }}</span>
              <span class="flex-shrink-0 text-surface-400 whitespace-nowrap">{{ entry.timeLabel }}</span>
            </div>
          </template>
        </div>
      </div>
      <div v-else class="text-center py-4 text-[11px] text-surface-400">No activity yet</div>
    </div>
  </div>
</template>
