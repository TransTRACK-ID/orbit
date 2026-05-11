<template>
  <Transition name="drawer">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/25" @click="closeDrawer" />

      <!-- Drawer panel -->
      <div class="absolute right-0 top-0 bottom-0 w-[440px] max-w-[100vw] sm:max-w-[90vw] bg-white shadow-lg flex flex-col">
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-3.5 border-b border-surface-200 flex-shrink-0">
          <h3 class="text-sm font-semibold flex-1 min-w-0 truncate">
            {{ currentTask?.title || 'Task Details' }}
          </h3>
          <button
            class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-100 transition-colors flex-shrink-0"
            @click="closeDrawer"
          >
            <Icon name="lucide:x" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Body -->
        <div v-if="currentTask" class="flex-1 overflow-y-auto p-5">
          <!-- Description -->
          <div class="mb-4">
            <h4 class="text-[9px] font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Description</h4>
            <div class="py-1.5 px-3 bg-surface-50 rounded-lg text-xs">
              {{ currentTask.description || 'No description provided' }}
            </div>
          </div>

          <!-- Type & Priority badges -->
          <div class="flex gap-2 flex-wrap mb-4">
            <span class="card-type px-2 py-0.5 text-[9px]" :class="typeBadgeClass">
              {{ typeLabel }}
            </span>
            <span class="inline-flex items-center gap-1 text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full" :class="priorityBadgeClass">
              {{ currentTask.priority }}
            </span>
          </div>

          <!-- Assignee -->
          <div class="mb-4">
            <h4 class="text-[9px] font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Assignee</h4>
            <div class="flex items-center gap-2 py-1">
              <div
                v-if="currentTask.assignee"
                class="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                :style="{ background: assigneeColor }"
              >
                {{ assigneeInitials }}
              </div>
              <span v-else class="text-xs text-surface-400">Unassigned</span>
              <span v-if="currentTask.assignee" class="text-xs font-semibold">{{ currentTask.assignee.name }}</span>
            </div>
          </div>

          <!-- Labels -->
          <div class="mb-4" v-if="currentTask.labels && currentTask.labels.length > 0">
            <h4 class="text-[9px] font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Labels</h4>
            <div class="flex gap-1.5 flex-wrap">
              <span
                v-for="label in currentTask.labels"
                :key="label.id"
                class="px-1.5 py-0.5 rounded text-[8px] font-semibold"
                :style="{ backgroundColor: label.color + '20', color: label.color }"
              >
                {{ label.name }}
              </span>
            </div>
          </div>

          <!-- Activity -->
          <div class="mb-4">
            <h4 class="text-[9px] font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Activity</h4>
            <div
              v-for="(act, i) in displayActivities"
              :key="i"
              class="flex gap-2.5 py-1.5 border-b border-surface-100 last:border-none"
            >
              <div class="w-[26px] h-[26px] rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0 text-[10px] text-surface-400">
                <Icon :name="act.icon" class="w-2.5 h-2.5" />
              </div>
              <div class="min-w-0">
                <div class="text-[10px] leading-snug" v-html="act.text"></div>
                <div class="text-[9px] text-surface-400 mt-0.5">{{ act.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const drawerState = useTaskDrawer()
const { agents } = useAgent()

const isOpen = computed(() => drawerState.isOpen.value)
const currentTask = computed(() => drawerState.task.value)

function closeDrawer() {
  drawerState.close()
}

const typeLabel = computed(() => {
  if (!currentTask.value) return 'Feature'
  const p = currentTask.value.priority
  if (p === 'urgent' || p === 'high') return 'Fix'
  if (p === 'medium') return 'Review'
  return 'Feature'
})

const typeBadgeClass = computed(() => {
  if (!currentTask.value) return 'card-type feature'
  const p = currentTask.value.priority
  if (p === 'urgent' || p === 'high') return 'card-type fix'
  if (p === 'medium') return 'card-type review'
  return 'card-type feature'
})

const priorityBadgeClass = computed(() => {
  if (!currentTask.value) return ''
  const m: Record<string, string> = {
    critical: 'bg-red-100 text-red-600',
    high: 'bg-amber-100 text-amber-600',
    medium: 'bg-blue-100 text-blue-600',
    low: 'bg-gray-100 text-gray-500',
    none: 'bg-gray-50 text-gray-400',
  }
  return m[currentTask.value.priority] || ''
})

const assigneeInitials = computed(() => {
  if (!currentTask.value?.assignee?.name) return ''
  return currentTask.value.assignee.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
})

const assigneeColor = computed(() => {
  if (!currentTask.value?.assignee?.name) return '#6366F1'
  const agent = agents.value.find(a => a.name === currentTask.value!.assignee!.name)
  return agent?.color || '#6366F1'
})

// Format display activities from the task
const displayActivities = computed(() => {
  const task = currentTask.value
  if (!task) return []

  const acts: Array<{ icon: string; text: string; time: string }> = [
    {
      icon: 'lucide:plus-circle',
      text: `Task created`,
      time: formatRelativeTime(task.createdAt),
    },
  ]

  if (task.assignee) {
    acts.push({
      icon: 'lucide:user-check',
      text: `Assigned to <strong>${task.assignee.name}</strong>`,
      time: 'Recently',
    })
  }

  return acts
})

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>

<style scoped>
.drawer-enter-from {
  transform: translateX(100%);
}
.drawer-enter-active {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.drawer-enter-to {
  transform: translateX(0);
}
.drawer-leave-from {
  transform: translateX(0);
}
.drawer-leave-active {
  transition: transform 0.2s ease-in;
}
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
