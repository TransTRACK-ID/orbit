<script setup lang="ts">
import type { QaRun, QaRunCase, QaRunCaseStatus } from '~/types'

defineProps<{
  run: QaRun | null
}>()

const emit = defineEmits<{
  updateCase: [id: string, data: { status?: QaRunCaseStatus; actual?: string | null }]
}>()

const expandedId = ref<string | null>(null)

function statusClass(status: string) {
  if (status === 'passed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'failed') return 'bg-red-100 text-red-700'
  if (status === 'blocked') return 'bg-amber-100 text-amber-700'
  if (status === 'skipped') return 'bg-surface-100 text-surface-500'
  return 'bg-blue-50 text-blue-700'
}

function setStatus(rc: QaRunCase, status: QaRunCaseStatus) {
  emit('updateCase', rc.id, { status })
}
</script>

<template>
  <div v-if="!run" class="flex-1 flex items-center justify-center text-xs text-surface-400">
    Select a run
  </div>
  <div v-else class="flex flex-col h-full min-h-0 bg-white border border-surface-200 rounded-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-surface-100">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusClass(run.status)">
          {{ run.status }}
        </span>
        <span class="text-sm font-semibold text-surface-900">
          {{ run.plan?.name || 'Ad-hoc run' }}
        </span>
      </div>
      <div class="text-[10px] text-surface-500 space-x-2">
        <span>{{ run._passedCount || 0 }}/{{ run._totalCount || 0 }} passed</span>
        <span v-if="run.targetUrl">· {{ run.targetUrl }}</span>
        <span v-if="run.agent">· {{ run.agent.name }}</span>
      </div>
      <p v-if="run.summary" class="text-xs text-surface-600 mt-2">{{ run.summary }}</p>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-2">
      <div
        v-for="rc in run.runCases || []"
        :key="rc.id"
        class="border border-surface-200 rounded-xl overflow-hidden"
      >
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-50"
          @click="expandedId = expandedId === rc.id ? null : rc.id"
        >
          <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusClass(rc.status)">
            {{ rc.status }}
          </span>
          <span class="text-xs font-semibold text-surface-800 truncate flex-1">{{ rc.title }}</span>
          <Icon
            :name="expandedId === rc.id ? 'lucide:chevron-down' : 'lucide:chevron-right'"
            class="w-3.5 h-3.5 text-surface-400"
          />
        </button>

        <div v-if="expandedId === rc.id" class="px-3 pb-3 border-t border-surface-100 space-y-2">
          <div class="flex flex-wrap gap-1 pt-2">
            <button
              v-for="s in (['passed', 'failed', 'blocked', 'skipped', 'pending'] as QaRunCaseStatus[])"
              :key="s"
              type="button"
              class="text-[10px] px-2 py-1 rounded-md border"
              :class="rc.status === s ? 'border-surface-900 bg-surface-900 text-white dark:bg-black dark:border-black' : 'border-surface-200 text-surface-600'"
              @click="setStatus(rc, s)"
            >
              {{ s }}
            </button>
          </div>

          <div v-if="rc.steps?.length" class="space-y-1">
            <div v-for="step in rc.steps" :key="step.order" class="text-[10px] text-surface-600">
              <span class="font-semibold">{{ step.order }}.</span> {{ step.action }}
              <span class="text-surface-400"> → {{ step.expected }}</span>
            </div>
          </div>

          <div v-if="rc.actual" class="text-xs text-surface-700 bg-surface-50 rounded-lg p-2">
            {{ rc.actual }}
          </div>
          <div v-if="rc.error" class="text-xs text-red-600 bg-red-50 rounded-lg p-2">
            {{ rc.error }}
          </div>

          <div v-if="rc.attachments?.length" class="flex flex-wrap gap-2">
            <a
              v-for="att in rc.attachments"
              :key="att.id"
              :href="`/api/qa/attachments/${att.id}`"
              target="_blank"
              class="block w-16 h-16 rounded-lg overflow-hidden border border-surface-200"
            >
              <img
                :src="`/api/qa/attachments/${att.id}`"
                :alt="att.originalName"
                class="w-full h-full object-cover"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
