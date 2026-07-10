<script setup lang="ts">
import type { Agent, QaCase, QaPlan } from '~/types'
import {
  getApiErrorMessage,
  getApiFieldErrors,
  isValidHttpUrl,
  parseApiValidationIssues,
} from '~/utils/api-error'

export type QaStartRunPayload = {
  planId?: string | null
  caseIds?: string[]
  agentId?: string | null
  targetUrl: string
}

const props = defineProps<{
  open: boolean
  plans: QaPlan[]
  cases: QaCase[]
  agents: Agent[]
  startRun: (payload: QaStartRunPayload) => Promise<void>
}>()

const emit = defineEmits<{
  close: []
}>()

const mode = ref<'plan' | 'cases'>('plan')
const planId = ref<string | null>(null)
const selectedCaseIds = ref<string[]>([])
const agentId = ref<string | null>(null)
const targetUrl = ref('https://staging.example.com')
const submitting = ref(false)
const formError = ref('')
const fieldErrors = ref<Record<string, string>>({})

const browserAgents = computed(() => props.agents.filter((a) => a.browserEnabled))

const hasPlans = computed(() => props.plans.length > 0)
const hasCases = computed(() => props.cases.length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    planId.value = props.plans[0]?.id || null
    selectedCaseIds.value = []
    agentId.value = browserAgents.value[0]?.id || null
    submitting.value = false
    formError.value = ''
    fieldErrors.value = {}
    mode.value = props.plans.length > 0 ? 'plan' : 'cases'
  },
)

function clearFieldError(field: string) {
  if (!fieldErrors.value[field]) return
  const next = { ...fieldErrors.value }
  delete next[field]
  fieldErrors.value = next
}

function clearErrors() {
  formError.value = ''
  fieldErrors.value = {}
}

function applyApiError(err: unknown) {
  const issues = parseApiValidationIssues(err)
  if (issues.length > 0) {
    fieldErrors.value = getApiFieldErrors(issues)
    formError.value = 'Please fix the highlighted fields and try again.'
    return
  }
  formError.value = getApiErrorMessage(err, 'Failed to start QA run')
}

function validateClient(): boolean {
  clearErrors()
  let valid = true

  const url = targetUrl.value.trim()
  if (!url) {
    fieldErrors.value.targetUrl = 'Target URL is required'
    valid = false
  } else if (!isValidHttpUrl(url)) {
    fieldErrors.value.targetUrl = 'Enter a valid URL starting with http:// or https://'
    valid = false
  }

  if (mode.value === 'plan') {
    if (!hasPlans.value) {
      formError.value = 'Create a plan with cases before starting a run.'
      valid = false
    } else if (!planId.value) {
      fieldErrors.value.planId = 'Select a plan'
      valid = false
    }
  } else if (!hasCases.value) {
    formError.value = 'Create at least one test case before starting a run.'
    valid = false
  } else if (selectedCaseIds.value.length === 0) {
    fieldErrors.value.caseIds = 'Select at least one case'
    valid = false
  }

  if (!valid && !formError.value) {
    formError.value = 'Please fix the highlighted fields and try again.'
  }

  return valid
}

function toggleCase(id: string) {
  clearFieldError('caseIds')
  if (selectedCaseIds.value.includes(id)) {
    selectedCaseIds.value = selectedCaseIds.value.filter((x) => x !== id)
  } else {
    selectedCaseIds.value = [...selectedCaseIds.value, id]
  }
}

function fieldInputClass(field: string) {
  return fieldErrors.value[field]
    ? 'field-input w-full text-xs rounded-lg px-3 py-2 border-red-300 focus:border-red-500 focus:ring-red-200'
    : 'field-input w-full text-xs rounded-lg px-3 py-2'
}

async function submit() {
  if (submitting.value) return
  if (!validateClient()) return

  submitting.value = true
  try {
    await props.startRun({
      planId: mode.value === 'plan' ? planId.value : null,
      caseIds: mode.value === 'cases' ? selectedCaseIds.value : undefined,
      agentId: agentId.value,
      targetUrl: targetUrl.value.trim(),
    })
    emit('close')
  } catch (err) {
    applyApiError(err)
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
    <div class="bg-white dark:bg-surface-100 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
      <div class="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        <h3 class="text-sm font-semibold">Start QA run</h3>
        <button type="button" class="text-surface-400 hover:text-surface-600" @click="emit('close')">
          <Icon name="lucide:x" class="w-4 h-4" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div
          v-if="formError"
          class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
          role="alert"
        >
          <Icon name="lucide:alert-circle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{{ formError }}</p>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 text-xs py-2 rounded-lg border font-semibold"
            :class="mode === 'plan' ? 'border-surface-900 bg-surface-900 text-white dark:bg-black dark:border-black' : 'border-surface-200 bg-white text-surface-600'"
            @click="mode = 'plan'"
          >
            From plan
          </button>
          <button
            type="button"
            class="flex-1 text-xs py-2 rounded-lg border font-semibold"
            :class="mode === 'cases' ? 'border-surface-900 bg-surface-900 text-white dark:bg-black dark:border-black' : 'border-surface-200 bg-white text-surface-600'"
            @click="mode = 'cases'"
          >
            Selected cases
          </button>
        </div>

        <div v-if="mode === 'plan'">
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Plan</label>
          <select
            v-model="planId"
            :class="fieldInputClass('planId')"
            :disabled="!hasPlans"
            @change="clearFieldError('planId')"
          >
            <option v-if="!hasPlans" :value="null" disabled>No plans available</option>
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} ({{ p._caseCount || 0 }})</option>
          </select>
          <p v-if="fieldErrors.planId" class="mt-1 text-[10px] text-red-600">{{ fieldErrors.planId }}</p>
        </div>

        <div v-else>
          <div
            class="max-h-40 overflow-y-auto rounded-lg p-2 space-y-1"
            :class="fieldErrors.caseIds ? 'border border-red-300 bg-red-50/40' : 'border border-surface-200'"
          >
            <p v-if="!hasCases" class="text-xs text-surface-500 px-1 py-2">No cases available yet.</p>
            <label
              v-for="c in cases"
              :key="c.id"
              class="flex items-center gap-2 text-xs px-1 py-1 cursor-pointer"
            >
              <input type="checkbox" :checked="selectedCaseIds.includes(c.id)" @change="toggleCase(c.id)" />
              <span class="truncate">{{ c.title }}</span>
            </label>
          </div>
          <p v-if="fieldErrors.caseIds" class="mt-1 text-[10px] text-red-600">{{ fieldErrors.caseIds }}</p>
        </div>

        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Target URL</label>
          <input
            v-model="targetUrl"
            type="url"
            placeholder="https://staging.example.com"
            :class="fieldInputClass('targetUrl')"
            :aria-invalid="!!fieldErrors.targetUrl"
            @input="clearFieldError('targetUrl')"
          />
          <p v-if="fieldErrors.targetUrl" class="mt-1 text-[10px] text-red-600">{{ fieldErrors.targetUrl }}</p>
          <p v-else class="mt-1 text-[10px] text-surface-400">Must be a full URL with http:// or https://</p>
        </div>

        <div>
          <label class="block text-[10px] font-medium text-surface-500 mb-1">Agent (browser-enabled)</label>
          <select
            v-model="agentId"
            :class="fieldInputClass('agentId')"
            @change="clearFieldError('agentId')"
          >
            <option :value="null">Manual results only</option>
            <option v-for="a in browserAgents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <p v-if="fieldErrors.agentId" class="mt-1 text-[10px] text-red-600">{{ fieldErrors.agentId }}</p>
        </div>
      </div>

      <div class="px-5 py-4 border-t border-surface-100 flex justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-lg border border-surface-200"
          :disabled="submitting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-lg bg-surface-900 text-white dark:bg-black font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          :disabled="submitting"
          @click="submit"
        >
          <Icon v-if="submitting" name="lucide:loader-2" class="w-3 h-3 animate-spin" />
          {{ submitting ? 'Creating…' : 'Create run' }}
        </button>
      </div>
    </div>
  </div>
</template>
