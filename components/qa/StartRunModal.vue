<script setup lang="ts">
import type { Agent, QaCase, QaPlan } from '~/types'

const props = defineProps<{
  open: boolean
  plans: QaPlan[]
  cases: QaCase[]
  agents: Agent[]
}>()

const emit = defineEmits<{
  close: []
  start: [payload: {
    planId?: string | null
    caseIds?: string[]
    agentId?: string | null
    targetUrl: string
  }]
}>()

const mode = ref<'plan' | 'cases'>('plan')
const planId = ref<string | null>(null)
const selectedCaseIds = ref<string[]>([])
const agentId = ref<string | null>(null)
const targetUrl = ref('https://staging.example.com')
const submitting = ref(false)

const browserAgents = computed(() => props.agents.filter((a) => a.browserEnabled))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    planId.value = props.plans[0]?.id || null
    selectedCaseIds.value = []
    agentId.value = browserAgents.value[0]?.id || null
    submitting.value = false
  },
)

function toggleCase(id: string) {
  if (selectedCaseIds.value.includes(id)) {
    selectedCaseIds.value = selectedCaseIds.value.filter((x) => x !== id)
  } else {
    selectedCaseIds.value = [...selectedCaseIds.value, id]
  }
}

async function submit() {
  if (!targetUrl.value.trim()) return
  if (mode.value === 'plan' && !planId.value) return
  if (mode.value === 'cases' && selectedCaseIds.value.length === 0) return

  submitting.value = true
  try {
    emit('start', {
      planId: mode.value === 'plan' ? planId.value : null,
      caseIds: mode.value === 'cases' ? selectedCaseIds.value : undefined,
      agentId: agentId.value,
      targetUrl: targetUrl.value.trim(),
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
      <div class="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        <h3 class="text-sm font-semibold">Start QA run</h3>
        <button type="button" class="text-surface-400 hover:text-surface-600" @click="emit('close')">
          <Icon name="lucide:x" class="w-4 h-4" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 text-xs py-2 rounded-lg border font-semibold"
            :class="mode === 'plan' ? 'border-surface-900 bg-surface-900 text-white' : 'border-surface-200'"
            @click="mode = 'plan'"
          >
            From plan
          </button>
          <button
            type="button"
            class="flex-1 text-xs py-2 rounded-lg border font-semibold"
            :class="mode === 'cases' ? 'border-surface-900 bg-surface-900 text-white' : 'border-surface-200'"
            @click="mode = 'cases'"
          >
            Selected cases
          </button>
        </div>

        <div v-if="mode === 'plan'">
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Plan</label>
          <select v-model="planId" class="w-full text-xs border border-surface-200 rounded-lg px-3 py-2">
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} ({{ p._caseCount || 0 }})</option>
          </select>
        </div>

        <div v-else class="max-h-40 overflow-y-auto border border-surface-200 rounded-lg p-2 space-y-1">
          <label
            v-for="c in cases"
            :key="c.id"
            class="flex items-center gap-2 text-xs px-1 py-1 cursor-pointer"
          >
            <input type="checkbox" :checked="selectedCaseIds.includes(c.id)" @change="toggleCase(c.id)" />
            <span class="truncate">{{ c.title }}</span>
          </label>
        </div>

        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Target URL</label>
          <input v-model="targetUrl" type="url" class="w-full text-xs border border-surface-200 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Agent (browser-enabled)</label>
          <select v-model="agentId" class="w-full text-xs border border-surface-200 rounded-lg px-3 py-2">
            <option :value="null">Manual results only</option>
            <option v-for="a in browserAgents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
      </div>

      <div class="px-5 py-4 border-t border-surface-100 flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-xs rounded-lg border border-surface-200" @click="emit('close')">
          Cancel
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-lg bg-surface-900 text-white font-semibold disabled:opacity-50"
          :disabled="submitting"
          @click="submit"
        >
          Create run
        </button>
      </div>
    </div>
  </div>
</template>
