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
  () => {
    const p = props.plan
    if (!p) return null
    const caseIds = (p.cases || []).map((c) => c.id).join(',')
    return `${p.id}:${p.updatedAt}:${caseIds}`
  },
  () => {
    const p = props.plan
    if (!p) return
    name.value = p.name
    description.value = p.description || ''
    selectedIds.value = (p.cases || []).map((c) => c.id)
  },
  { immediate: true },
)

const detailsDirty = computed(() => {
  if (!props.plan) return false
  return (
    name.value.trim() !== props.plan.name
    || (description.value || '') !== (props.plan.description || '')
  )
})

const casesDirty = computed(() => {
  if (!props.plan) return false
  const saved = (props.plan.cases || []).map((c) => c.id).sort().join(',')
  const current = [...selectedIds.value].sort().join(',')
  return saved !== current
})

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
    <div class="px-4 py-3 border-b border-surface-200 dark:border-surface-300 flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-surface-900 truncate">{{ plan.name }}</h3>
        <p class="text-xs text-surface-500 mt-0.5">Two sections save independently.</p>
      </div>
      <button
        type="button"
        class="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 flex items-center gap-1 shrink-0"
        :disabled="deleting || saving || updatingCases"
        @click="emit('remove', plan.id)"
      >
        <Icon v-if="deleting" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
        {{ deleting ? 'Deleting…' : 'Delete plan' }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Plan details -->
      <section class="p-4 border-b border-surface-200 dark:border-surface-300">
        <div class="mb-3">
          <h4 class="text-xs font-semibold text-surface-900">Plan details</h4>
          <p class="text-xs text-surface-500 mt-0.5">Name and description for this plan.</p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-surface-600 mb-1">Name</label>
            <input
              v-model="name"
              type="text"
              class="field-input w-full text-sm rounded-lg px-3 py-2"
              :disabled="saving"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-surface-600 mb-1">Description</label>
            <textarea
              v-model="description"
              rows="2"
              class="field-input w-full text-xs rounded-lg px-3 py-2"
              placeholder="Optional notes about when to use this plan"
              :disabled="saving"
            />
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-surface-100 dark:border-surface-300 flex items-center justify-between gap-3">
          <p v-if="detailsDirty" class="text-xs text-amber-600">Unsaved changes</p>
          <p v-else class="text-xs text-surface-400">Details saved</p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 min-w-[108px] justify-center transition-colors"
            :class="saved
              ? 'bg-emerald-600 text-white dark:bg-emerald-700'
              : 'bg-surface-900 text-white dark:bg-black'"
            :disabled="saving || !detailsDirty"
            @click="saveMeta"
          >
            <Icon v-if="saving" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
            <Icon v-else-if="saved" name="lucide:check" class="w-3 h-3" />
            {{ saving ? 'Saving…' : saved ? 'Saved' : 'Save details' }}
          </button>
        </div>
      </section>

      <!-- Case selection -->
      <section class="p-4">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 class="text-xs font-semibold text-surface-900">Test cases</h4>
            <p class="text-xs text-surface-500 mt-0.5">Choose which cases run when this plan is used.</p>
          </div>
          <span class="text-xs font-medium text-surface-500 tabular-nums shrink-0">
            {{ selectedIds.length }} selected
          </span>
        </div>

        <div v-if="allCases.length === 0" class="text-xs text-surface-400 py-6 text-center rounded-lg bg-surface-50 dark:bg-surface-200/50">
          No cases available. Create cases on the Cases tab first.
        </div>
        <div
          v-else
          class="rounded-lg border border-surface-200 dark:border-surface-300 divide-y divide-surface-100 dark:divide-surface-300 max-h-72 overflow-y-auto"
        >
          <label
            v-for="c in allCases"
            :key="c.id"
            class="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-200/50 text-xs cursor-pointer transition-colors"
            :class="selectedIds.includes(c.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''"
          >
            <input
              type="checkbox"
              class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              :checked="selectedIds.includes(c.id)"
              :disabled="updatingCases"
              @change="toggleCase(c.id)"
            />
            <span class="truncate text-surface-900">{{ c.title }}</span>
          </label>
        </div>

        <div class="mt-4 pt-3 border-t border-surface-100 dark:border-surface-300 flex items-center justify-between gap-3">
          <p v-if="casesDirty" class="text-xs text-amber-600">Selection changed</p>
          <p v-else class="text-xs text-surface-400">Selection saved</p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 min-w-[132px] justify-center transition-colors"
            :class="casesUpdated
              ? 'bg-emerald-600 text-white dark:bg-emerald-700'
              : 'bg-surface-900 text-white dark:bg-black'"
            :disabled="updatingCases || !casesDirty"
            @click="saveCases"
          >
            <Icon v-if="updatingCases" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
            <Icon v-else-if="casesUpdated" name="lucide:check" class="w-3 h-3" />
            {{ updatingCases ? 'Saving…' : casesUpdated ? 'Saved' : 'Save selection' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
