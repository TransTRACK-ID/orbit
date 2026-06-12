<template>
  <!-- Only render for open, non-draft PRs on supported platforms -->
  <div v-if="canAttemptMerge" class="relative" ref="rootRef">

    <!-- ── Merged (terminal state) ── -->
    <div
      v-if="mergedSuccess"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold"
    >
      <Icon name="lucide:git-merge" class="w-3.5 h-3.5" />
      Merged
    </div>

    <!-- ── Blocked state ── -->
    <div
      v-else-if="blockReason"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-surface-400 text-xs font-medium cursor-not-allowed"
      :title="blockReason"
    >
      <Icon name="lucide:git-merge" class="w-3.5 h-3.5" />
      Merge
      <Icon name="lucide:alert-circle" class="w-3 h-3" />
    </div>

    <!-- ── Active merge button (split button) ── -->
    <div v-else class="flex items-stretch">
      <!-- Primary button -->
      <button
        class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-xs font-semibold rounded-l-lg border transition-all duration-150"
        :class="confirmOpen
          ? 'bg-purple-600 border-purple-700 text-white'
          : 'bg-purple-500 border-purple-600 text-white hover:bg-purple-600'"
        :disabled="merging"
        @click="confirmOpen ? doMerge() : (confirmOpen = true)"
      >
        <svg v-if="merging" class="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <Icon v-else name="lucide:git-merge" class="w-3.5 h-3.5" />
        <span>{{ merging ? 'Merging…' : confirmOpen ? 'Confirm merge' : 'Merge' }}</span>
      </button>

      <!-- Dropdown arrow -->
      <button
        class="px-1.5 py-1.5 text-xs font-semibold rounded-r-lg border-l border-purple-700 transition-all duration-150"
        :class="confirmOpen
          ? 'bg-purple-600 border-purple-600 text-white'
          : 'bg-purple-500 border-purple-600 text-white hover:bg-purple-600'"
        :disabled="merging"
        :title="dropdownOpen ? 'Close options' : 'Merge options'"
        @click.stop="dropdownOpen = !dropdownOpen"
      >
        <Icon name="lucide:chevron-down" class="w-3.5 h-3.5 transition-transform duration-150" :class="{ 'rotate-180': dropdownOpen }" />
      </button>
    </div>

    <!-- ── Method dropdown (fixed position, portal-like) ── -->
    <Teleport to="body">
      <div
        v-if="dropdownOpen"
        class="fixed z-50 mt-1 w-52 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden"
        :style="dropdownStyle"
        @click.stop
      >
        <div class="px-3 py-2 border-b border-surface-100">
          <p class="text-xs font-semibold text-surface-700">Merge method</p>
        </div>
        <div class="py-1">
          <button
            v-for="opt in mergeOptions"
            :key="opt.value"
            class="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-50 transition-colors"
            :class="selectedMethod === opt.value ? 'bg-purple-50' : ''"
            @click="selectMethod(opt.value)"
          >
            <div class="mt-0.5 flex-shrink-0">
              <div class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                :class="selectedMethod === opt.value ? 'border-purple-500 bg-purple-500' : 'border-surface-300'">
                <div v-if="selectedMethod === opt.value" class="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold text-surface-900">{{ opt.label }}</p>
              <p class="text-xs text-surface-500 mt-0.5">{{ opt.description }}</p>
            </div>
          </button>
        </div>
      </div>

      <!-- Click-outside backdrop -->
      <div v-if="dropdownOpen" class="fixed inset-0 z-40" @click="dropdownOpen = false" />
    </Teleport>

    <!-- ── Confirmation popover ── -->
    <Teleport to="body">
      <div
        v-if="confirmOpen && !merging && !mergedSuccess"
        class="fixed z-50 w-64 rounded-xl border border-purple-200 bg-white shadow-lg overflow-hidden"
        :style="confirmStyle"
        @click.stop
      >
        <div class="p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Icon name="lucide:git-merge" class="w-4 h-4 text-purple-600" />
            </div>
            <p class="text-sm font-semibold text-surface-900">Merge pull request?</p>
          </div>
          <p class="text-xs text-surface-500 mb-1 leading-relaxed">
            <span class="font-medium text-surface-700">{{ methodLabel }}</span> into
            <code class="bg-surface-100 px-1 py-0.5 rounded font-mono text-xs">{{ baseBranch }}</code>
          </p>
          <p v-if="headBranch" class="text-xs text-surface-400 mb-4">
            from <code class="bg-surface-100 px-1 py-0.5 rounded font-mono text-xs">{{ headBranch }}</code>
          </p>

          <!-- Error message -->
          <div v-if="mergeError" class="mb-3 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
            <p class="text-xs text-red-700 leading-relaxed">{{ mergeError }}</p>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              :disabled="merging"
              @click="doMerge"
            >
              <svg v-if="merging" class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ merging ? 'Merging…' : 'Confirm' }}
            </button>
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 transition-colors"
              :disabled="merging"
              @click="cancelConfirm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Click-outside backdrop for confirm -->
      <div v-if="confirmOpen && !merging" class="fixed inset-0 z-40" @click="cancelConfirm" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { PullRequest } from '~/types'

const props = defineProps<{
  pullRequest: PullRequest
}>()

const emit = defineEmits<{
  merged: []
}>()

// ── State ─────────────────────────────────────────────────────────────────────

type MergeMethod = 'merge' | 'squash' | 'rebase'

const selectedMethod = ref<MergeMethod>('squash')
const dropdownOpen = ref(false)
const confirmOpen = ref(false)
const merging = ref(false)
const mergedSuccess = ref(props.pullRequest.status === 'merged')
const mergeError = ref<string | null>(null)

const rootRef = ref<HTMLElement | null>(null)

// ── Dropdown positioning ───────────────────────────────────────────────────────

const dropdownStyle = ref<Record<string, string>>({})
const confirmStyle = ref<Record<string, string>>({})

function positionPopovers() {
  if (!rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const top = `${rect.bottom + 6}px`
  const right = `${window.innerWidth - rect.right}px`
  dropdownStyle.value = { top, right }
  confirmStyle.value = { top, right }
}

watch(dropdownOpen, (open) => { if (open) nextTick(positionPopovers) })
watch(confirmOpen, (open) => { if (open) nextTick(positionPopovers) })

// ── Eligibility ───────────────────────────────────────────────────────────────

const canAttemptMerge = computed(() => {
  const p = props.pullRequest
  // Must be a PR from a known provider
  if (!p.url) return false
  const isGh = /github\.com/.test(p.url) || /\/pull\/\d+/.test(p.url)
  const isGl = /\/merge_requests\/\d+/.test(p.url)
  return isGh || isGl
})

const blockReason = computed<string | null>(() => {
  const p = props.pullRequest
  if (p.status === 'merged') return null // handled by mergedSuccess display
  if (p.status === 'closed') return 'This PR is closed and cannot be merged'
  if (p.draft) return 'Draft PRs cannot be merged — mark as ready first'
  const conflictStates = ['dirty', 'conflicting', 'has_conflicts', 'cannot_be_merged', 'unresolvable']
  if (p.mergeableState && conflictStates.includes(p.mergeableState)) {
    return 'This PR has merge conflicts — resolve them before merging'
  }
  return null
})

// Show terminal "Merged" badge if the DB already says merged
const isAlreadyMerged = computed(() => props.pullRequest.status === 'merged')

// ── Merge methods ─────────────────────────────────────────────────────────────

const mergeOptions: { value: MergeMethod; label: string; description: string }[] = [
  { value: 'squash', label: 'Squash and merge', description: 'Combine all commits into one and merge' },
  { value: 'merge', label: 'Create a merge commit', description: 'Preserve full commit history' },
  { value: 'rebase', label: 'Rebase and merge', description: 'Rebase commits onto base branch' },
]

const methodLabel = computed(() => mergeOptions.find(o => o.value === selectedMethod.value)?.label ?? 'Merge')

function selectMethod(method: MergeMethod) {
  selectedMethod.value = method
  dropdownOpen.value = false
}

// ── Actions ───────────────────────────────────────────────────────────────────

function cancelConfirm() {
  confirmOpen.value = false
  mergeError.value = null
}

async function doMerge() {
  if (merging.value) return
  merging.value = true
  mergeError.value = null

  try {
    await $fetch(`/api/pull-requests/${props.pullRequest.id}/merge`, {
      method: 'POST',
      body: { method: selectedMethod.value },
    })
    mergedSuccess.value = true
    confirmOpen.value = false
    emit('merged')
  } catch (err: any) {
    const msg = err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Merge failed. Please try again.'
    mergeError.value = msg
  } finally {
    merging.value = false
  }
}

// ── Computed shortcuts ─────────────────────────────────────────────────────────

const baseBranch = computed(() => props.pullRequest.baseBranch ?? 'main')
const headBranch = computed(() => props.pullRequest.headBranch ?? null)

// Sync external merged state
watch(() => props.pullRequest.status, (status) => {
  if (status === 'merged') mergedSuccess.value = true
})

// Close on Escape
onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dropdownOpen.value = false
      if (!merging.value) confirmOpen.value = false
    }
  }
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
})
</script>
