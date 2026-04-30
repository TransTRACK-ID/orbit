<template>
  <div
    class="log-panel-fixed fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-50 flex flex-col overflow-hidden transition-all duration-200"
    :class="isOpen ? 'open h-[200px]' : 'h-0'"
  >
    <div class="flex items-center gap-2.5 px-4 py-1.5 border-b border-surface-200 flex-shrink-0">
      <Icon name="lucide:terminal" class="w-3 h-3 text-accent" />
      <h4 class="text-[11px] font-semibold">Activity Log</h4>
      <span class="text-[10px] text-surface-400 ml-auto">{{ logProjectName }} · {{ logCount }} entries</span>
      <button
        class="px-2 py-0.5 rounded text-[10px] font-semibold border border-surface-200 hover:bg-surface-50 transition-colors"
        @click="toggle"
      >Close</button>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-1">
      <div
        v-for="(entry, i) in logs"
        :key="i"
        class="flex gap-2 py-0.5 font-mono text-[10px]"
      >
        <span class="text-surface-400 flex-shrink-0 w-[55px]">{{ formatTime(entry.time) }}</span>
        <span class="text-accent flex-shrink-0 w-[72px] font-semibold">{{ entry.agent }}</span>
        <span class="text-surface-900">{{ entry.msg }}</span>
      </div>
      <div v-if="logs.length === 0" class="text-center py-4 text-[11px] text-surface-400">No activity yet</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isOpen, logs, toggle } = useLog()

const logProjectName = computed(() => {
  return (route.params.projectId as string) || 'Kanvas'
})

const logCount = computed(() => logs.value.length)

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
</script>
