<template>
  <div
    class="agent-panel flex-shrink-0 border-l border-surface-200 bg-white flex flex-col overflow-hidden transition-all duration-200"
    :class="isOpen ? 'w-[220px]' : 'w-0'"
  >
    <div class="flex items-center gap-2 px-3.5 py-3 border-b border-surface-200 flex-shrink-0">
      <Icon name="lucide:bot" class="w-3.5 h-3.5 text-accent" />
      <h4 class="text-[11px] font-semibold">Agents</h4>
      <button class="ml-auto text-[10px] px-1.5 py-0.5 rounded hover:bg-surface-100" @click="togglePanel">
        <Icon name="lucide:x" class="w-3 h-3" />
      </button>
    </div>

    <!-- Agent list -->
    <div class="flex-1 overflow-y-auto p-2">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors hover:bg-surface-100"
        :class="{ 'bg-accent/10': filterAgentId === agent.id }"
        @click="toggleFilter(agent.id)"
      >
        <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" :style="{ background: agent.color }">
          {{ agent.initials }}
          <span
            class="absolute -bottom-0.5 -right-0.5 w-[7px] h-[7px] rounded-full border-2 border-white"
            :class="statusDotClass(agent.status)"
          />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] font-semibold truncate">{{ agent.name }}</div>
          <div class="text-[9px] text-surface-400">{{ agent.role }}</div>
        </div>
      </div>
    </div>

    <!-- Queue -->
    <div class="border-t border-surface-200 p-2">
      <div class="text-[9px] font-semibold uppercase tracking-wider text-surface-400 mb-1.5 px-2">Queue</div>
      <div class="flex flex-col gap-1">
        <div
          v-for="item in queue"
          :key="item.id"
          class="px-2.5 py-1.5 rounded text-[10px] bg-surface-50 border-l-[3px] cursor-pointer hover:shadow-sm transition-shadow"
          :style="{ borderLeftColor: '#CF513D' }"
          @click="openTaskDrawer(item)"
        >
          <div class="font-semibold truncate">{{ item.title }}</div>
          <div class="text-[9px] text-surface-400 mt-0.5">{{ item.type }} · {{ item.priority }}</div>
        </div>
        <div v-if="queue.length === 0" class="text-center py-2 text-[10px] text-surface-400">
          All tasks assigned
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const { agents, filterAgentId, toggleFilter } = useAgent()
const drawerState = useTaskDrawer()

const isOpen = ref(false)

function togglePanel() {
  isOpen.value = !isOpen.value
}

// Expose toggle for parent
defineExpose({ isOpen, togglePanel })

const statusDotClass = (status: string) => ({
  'bg-green-500': status === 'idle',
  'bg-accent': status === 'busy',
  'bg-surface-400': status === 'offline',
})

// Queue = unassigned tasks from current project
const route = useRoute()
const { tasks } = useTask()

const queue = computed(() => {
  return tasks.value
    .filter((t: Task) => !t.assigneeId && t.priority !== 'none')
    .slice(0, 5)
    .map((t: Task) => ({
      id: t.id,
      title: t.title,
      type: t.priority || 'task',
      priority: t.priority,
    }))
})

function openTaskDrawer(item: any) {
  const task = tasks.value.find((t: Task) => t.id === item.id)
  if (task) {
    drawerState.open(task)
  }
}
</script>
