<script setup lang="ts">
import type { QaCase, QaPlan } from '~/types'

const props = defineProps<{
  plan: QaPlan | null
  allCases: QaCase[]
  saving?: boolean
  saved?: boolean
  updatingCases?: boolean
  casesUpdated?: boolean
  deleting?: boolean
}>()

const emit = defineEmits<{
  save: [data: { name: string; description: string | null }]
  replaceCases: [caseIds: string[]]
  remove: [id: string]
}>()

const name = ref('')
const description = ref('')
const selectedIds = ref<string[]>([])

watch(
  () => props.plan,
  (p) => {
    if (!p) return
    name.value = p.name
    description.value = p.description || ''
    selectedIds.value = (p.cases || []).map((c) => c.id)
  },
  { immediate: true },
)

function toggleCase(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

function saveMeta() {
  if (!props.plan || props.saving) return
  if (!name.value.trim()) return
  emit('save', { name: name.value.trim(), description: description.value || null })
}

function saveCases() {
  if (props.updatingCases) return
  emit('replaceCases', selectedIds.value)
}
</script>

<template>
  <div v-if="!plan" class="flex-1 flex items-center justify-center text-xs text-surface-400">
    Select a plan
  </div>
  <div v-else class="flex flex-col h-full min-h-0 bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-300 rounded-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
      <h3 class="text-sm font-semibold flex-1">Edit plan</h3>
      <button
        type="button"
        class="text-xs text-red-600 disabled:opacity-50 flex items-center gap-1"
        :disabled="deleting"
        @click="emit('remove', plan.id)"
      >
        <Icon v-if="deleting" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        {{ deleting ? 'Deleting…' : 'Delete' }}
      </button>
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg bg-surface-900 text-white dark:bg-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 min-w-[72px] justify-center transition-colors"
        :class="saved ? 'bg-emerald-600 dark:bg-emerald-700' : ''"
        :disabled="saving"
        @click="saveMeta"
      >
        <Icon v-if="saving" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        <Icon v-else-if="saved" name="lucide:check" class="w-3 h-3" />
        {{ saving ? 'Saving…' : saved ? 'Saved' : 'Save' }}
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div>
        <label class="block text-[10px] font-medium text-surface-500 mb-1">Name</label>
        <input v-model="name" type="text" class="field-input w-full text-sm rounded-lg px-3 py-2" />
      </div>
      <div>
        <label class="block text-[10px] font-medium text-surface-500 mb-1">Description</label>
        <textarea v-model="description" rows="2" class="field-input w-full text-xs rounded-lg px-3 py-2" />
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-[10px] font-medium text-surface-500">Cases in plan</label>
          <button
            type="button"
            class="text-xs font-semibold disabled:opacity-50 flex items-center gap-1 transition-colors"
            :class="casesUpdated ? 'text-emerald-600' : 'text-primary-600'"
            :disabled="updatingCases"
            @click="saveCases"
          >
            <Icon v-if="updatingCases" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
            <Icon v-else-if="casesUpdated" name="lucide:check" class="w-3 h-3" />
            {{ updatingCases ? 'Updating…' : casesUpdated ? 'Updated' : 'Update cases' }}
          </button>
        </div>
        <div v-if="allCases.length === 0" class="text-xs text-surface-400 py-3">No cases available</div>
        <div v-else class="space-y-1 max-h-80 overflow-y-auto">
          <label
            v-for="c in allCases"
            :key="c.id"
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 text-xs cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="selectedIds.includes(c.id)"
              :disabled="updatingCases"
              @change="toggleCase(c.id)"
            />
            <span class="truncate">{{ c.title }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
