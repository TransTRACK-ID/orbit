<script setup lang="ts">
import type { QaRun, QaRunAgentExecution } from '~/types'
import KanbanAgentRunInsightsPanel from '~/components/kanban/AgentRunInsightsPanel.vue'
import { agentRunHasIssue } from '~/utils/agent-diagnostics'

const props = defineProps<{
  run: QaRun
  agentExecution: QaRunAgentExecution | null | undefined
  workspaceSlug: string
}>()

const runtimeLogsForDisplay = computed(() => {
  return (props.agentExecution?.runtimeLogs ?? []).map(log => ({
    id: log.id,
    message: log.message.startsWith('>') ? log.message : `> ${log.message}`,
    displayTime: formatTime(log.createdAt),
  }))
})

function formatTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const taskLink = computed(() => {
  const taskId = props.run.taskId || props.agentExecution?.task?.id
  if (!taskId) return null
  return `/workspaces/${props.workspaceSlug}/projects/${props.run.projectId}/board?task=${taskId}`
})

const taskTitle = computed(() => props.agentExecution?.task?.title || 'Linked task')

const showDiagnostics = computed(() => agentRunHasIssue(props.agentExecution?.insights ?? null))

const showRunningBanner = computed(() => props.run.status === 'running')

const showAgentSection = computed(() => {
  if (!props.run.taskId && !props.agentExecution?.task) return false
  return showRunningBanner.value || showDiagnostics.value || props.run.status === 'failed' || props.run.status === 'blocked'
})

const agentIssueSummary = computed(() => {
  if (showDiagnostics.value) return null
  if (props.run.status === 'failed' && props.run.summary?.includes('qa-result')) {
    return props.run.summary
  }
  if (props.run.status === 'failed' || props.run.status === 'blocked') {
    return props.run.summary || 'The agent finished but the QA run did not pass all cases.'
  }
  return null
})
</script>

<template>
  <section v-if="showAgentSection" class="border-b border-surface-100 px-4 py-3 space-y-3 bg-surface-50/60">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold text-surface-800">Agent execution</p>
        <p v-if="agentExecution?.task?.statusName" class="mt-0.5 text-xs text-surface-500">
          Task status: {{ agentExecution.task.statusName }}
        </p>
      </div>
      <NuxtLink
        v-if="taskLink"
        :to="taskLink"
        class="flex-shrink-0 text-xs font-medium text-primary-600 hover:text-primary-700"
      >
        Open task
      </NuxtLink>
    </div>

    <div
      v-if="showRunningBanner"
      class="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2.5"
    >
      <span class="relative flex h-2 w-2 flex-shrink-0">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
      <p class="text-xs text-blue-800">
        Agent is running this QA session. Results will appear here when execution finishes.
      </p>
    </div>

    <KanbanAgentRunInsightsPanel
      v-if="showDiagnostics && agentExecution?.insights"
      :insights="agentExecution.insights"
      :runtime-logs="runtimeLogsForDisplay"
      :task-title="taskTitle"
    />

    <div
      v-else-if="agentIssueSummary"
      class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5"
    >
      <p class="text-xs leading-relaxed text-amber-900">{{ agentIssueSummary }}</p>
    </div>
  </section>
</template>
