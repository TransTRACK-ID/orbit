<script setup lang="ts">
import type { QaCase, QaCaseStep, QaSuite } from '~/types'

const props = defineProps<{
  modelValue: QaCase | null
  suites: QaSuite[]
  saving?: boolean
  saved?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: QaCase | null]
  save: [value: Partial<QaCase>]
  remove: [id: string]
}>()

const draft = reactive({
  title: '',
  suiteId: null as string | null,
  preconditions: '',
  priority: 'medium' as QaCase['priority'],
  status: 'active' as QaCase['status'],
  steps: [] as QaCaseStep[],
})

watch(
  () => props.modelValue,
  (c) => {
    if (!c) return
    draft.title = c.title
    draft.suiteId = c.suiteId
    draft.preconditions = c.preconditions || ''
    draft.priority = c.priority
    draft.status = c.status
    draft.steps = (c.steps || []).map((s) => ({ ...s }))
  },
  { immediate: true },
)

function addStep() {
  draft.steps.push({
    order: draft.steps.length + 1,
    action: '',
    expected: '',
  })
}

function removeStep(idx: number) {
  draft.steps.splice(idx, 1)
  draft.steps.forEach((s, i) => { s.order = i + 1 })
}

function save() {
  if (!props.modelValue || props.saving) return
  if (!draft.title.trim()) return
  emit('save', {
    title: draft.title.trim(),
    suiteId: draft.suiteId,
    preconditions: draft.preconditions || null,
    priority: draft.priority,
    status: draft.status,
    steps: draft.steps.map((s, i) => ({
      order: i + 1,
      action: s.action.trim(),
      expected: s.expected.trim(),
    })),
  })
}
</script>

<template>
  <div v-if="!modelValue" class="flex-1 flex items-center justify-center text-xs text-surface-400">
    Select a case to edit
  </div>
  <div v-else class="flex flex-col h-full min-h-0 bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-300 rounded-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
      <h3 class="text-sm font-semibold text-surface-900 flex-1 truncate">Edit case</h3>
      <button
        type="button"
        class="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 flex items-center gap-1"
        :disabled="deleting || saving"
        @click="emit('remove', modelValue.id)"
      >
        <Icon v-if="deleting" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        {{ deleting ? 'Deleting…' : 'Delete' }}
      </button>
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg bg-surface-900 text-white dark:bg-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 min-w-[72px] justify-center transition-colors"
        :class="saved ? 'bg-emerald-600 dark:bg-emerald-700' : ''"
        :disabled="saving"
        @click="save"
      >
        <Icon v-if="saving" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        <Icon v-else-if="saved" name="lucide:check" class="w-3 h-3" />
        {{ saving ? 'Saving...' : saved ? 'Saved' : 'Save' }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div>
        <label class="block text-[10px] font-medium text-surface-500 mb-1">Title</label>
        <input v-model="draft.title" type="text" class="field-input w-full text-sm rounded-lg px-3 py-2" />
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Suite</label>
          <select v-model="draft.suiteId" class="field-input w-full text-xs rounded-lg px-2 py-2">
            <option :value="null">No suite</option>
            <option v-for="s in suites" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Priority</label>
          <select v-model="draft.priority" class="field-input w-full text-xs rounded-lg px-2 py-2">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Status</label>
          <select v-model="draft.status" class="field-input w-full text-xs rounded-lg px-2 py-2">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-[10px] font-medium text-surface-500 mb-1">Preconditions</label>
        <textarea
          v-model="draft.preconditions"
          rows="2"
          class="field-input w-full text-xs rounded-lg px-3 py-2"
          placeholder="e.g. Login: user@example.com / password123"
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-[10px] font-medium text-surface-500">Steps</label>
          <button type="button" class="text-xs text-primary-600 font-semibold" @click="addStep">
            + Add step
          </button>
        </div>
        <div v-if="draft.steps.length === 0" class="text-xs text-surface-400 py-3">No steps yet</div>
        <div v-for="(step, idx) in draft.steps" :key="idx" class="border border-surface-200 dark:border-surface-300 rounded-lg p-2.5 mb-2 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-surface-500">Step {{ idx + 1 }}</span>
            <button type="button" class="text-surface-400 hover:text-red-500" @click="removeStep(idx)">
              <Icon name="lucide:x" class="w-3 h-3" />
            </button>
          </div>
          <input v-model="step.action" type="text" placeholder="Action" class="field-input w-full text-xs rounded px-2 py-1.5" />
          <input v-model="step.expected" type="text" placeholder="Expected result" class="field-input w-full text-xs rounded px-2 py-1.5" />
        </div>
      </div>
    </div>
  </div>
</template>
