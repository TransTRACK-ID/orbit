import type {
  QaSuite,
  QaCase,
  QaPlan,
  QaRun,
  QaRunCase,
  QaWorkspaceSummary,
  QaCaseStep,
  QaCasePriority,
  QaCaseStatus,
  QaRunCaseStatus,
} from '~/types'

const suites = ref<QaSuite[]>([])
const cases = ref<QaCase[]>([])
const plans = ref<QaPlan[]>([])
const runs = ref<QaRun[]>([])
const selectedRun = ref<QaRun | null>(null)
const summary = ref<QaWorkspaceSummary | null>(null)
const loading = ref(false)

export const useQa = () => {
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  async function fetchSuites(projectId: string) {
    suites.value = await $fetch<QaSuite[]>(`/api/projects/${projectId}/qa/suites`, {
      headers: ssrHeaders,
    })
    return suites.value
  }

  async function createSuite(projectId: string, data: { name: string; parentId?: string | null }) {
    const suite = await $fetch<QaSuite>(`/api/projects/${projectId}/qa/suites`, {
      method: 'POST',
      body: data,
    })
    suites.value = [...suites.value, suite]
    return suite
  }

  async function updateSuite(id: string, data: Partial<{ name: string; parentId: string | null; sortOrder: number }>) {
    const updated = await $fetch<QaSuite>(`/api/qa/suites/${id}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = suites.value.findIndex((s) => s.id === id)
    if (idx !== -1) suites.value[idx] = { ...suites.value[idx], ...updated }
    return updated
  }

  async function deleteSuite(id: string) {
    await $fetch(`/api/qa/suites/${id}`, { method: 'DELETE' })
    suites.value = suites.value.filter((s) => s.id !== id)
  }

  async function fetchCases(projectId: string, opts?: { suiteId?: string; status?: string }) {
    cases.value = await $fetch<QaCase[]>(`/api/projects/${projectId}/qa/cases`, {
      headers: ssrHeaders,
      query: opts,
    })
    return cases.value
  }

  async function createCase(projectId: string, data: {
    title: string
    suiteId?: string | null
    preconditions?: string | null
    steps?: QaCaseStep[]
    priority?: QaCasePriority
    status?: QaCaseStatus
  }) {
    const qaCase = await $fetch<QaCase>(`/api/projects/${projectId}/qa/cases`, {
      method: 'POST',
      body: data,
    })
    cases.value = [qaCase, ...cases.value]
    return qaCase
  }

  async function duplicateCase(source: QaCase) {
    const qaCase = await createCase(source.projectId, {
      title: `${source.title} (copy)`,
      suiteId: source.suiteId,
      preconditions: source.preconditions,
      steps: (source.steps ?? []).map((s) => ({
        order: s.order,
        action: s.action,
        expected: s.expected,
      })),
      priority: source.priority,
      status: source.status,
    })
    return qaCase
  }

  async function updateCase(id: string, data: Partial<{
    title: string
    suiteId: string | null
    preconditions: string | null
    steps: QaCaseStep[]
    priority: QaCasePriority
    status: QaCaseStatus
    sortOrder: number
  }>) {
    const updated = await $fetch<QaCase>(`/api/qa/cases/${id}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = cases.value.findIndex((c) => c.id === id)
    if (idx !== -1) cases.value[idx] = { ...cases.value[idx], ...updated }
    return updated
  }

  async function deleteCase(id: string) {
    await $fetch(`/api/qa/cases/${id}`, { method: 'DELETE' })
    cases.value = cases.value.filter((c) => c.id !== id)
  }

  async function fetchPlans(projectId: string) {
    plans.value = await $fetch<QaPlan[]>(`/api/projects/${projectId}/qa/plans`, {
      headers: ssrHeaders,
    })
    return plans.value
  }

  async function createPlan(projectId: string, data: { name: string; description?: string | null }) {
    const plan = await $fetch<QaPlan>(`/api/projects/${projectId}/qa/plans`, {
      method: 'POST',
      body: data,
    })
    plans.value = [plan, ...plans.value]
    return plan
  }

  async function updatePlan(id: string, data: Partial<{ name: string; description: string | null }>) {
    const updated = await $fetch<QaPlan>(`/api/qa/plans/${id}`, {
      method: 'PATCH',
      body: data,
    })
    await fetchPlans(updated.projectId)
    return plans.value.find((p) => p.id === id) ?? updated
  }

  async function deletePlan(id: string) {
    await $fetch(`/api/qa/plans/${id}`, { method: 'DELETE' })
    plans.value = plans.value.filter((p) => p.id !== id)
  }

  async function replacePlanCases(planId: string, caseIds: string[]) {
    const updated = await $fetch<QaPlan>(`/api/qa/plans/${planId}/cases`, {
      method: 'PUT',
      body: { caseIds },
    })
    await fetchPlans(updated.projectId)
    return plans.value.find((p) => p.id === planId) ?? updated
  }

  async function fetchRuns(projectId: string) {
    runs.value = await $fetch<QaRun[]>(`/api/projects/${projectId}/qa/runs`, {
      headers: ssrHeaders,
    })
    return runs.value
  }

  async function fetchWorkspaceRuns(workspaceId: string) {
    runs.value = await $fetch<QaRun[]>(`/api/workspaces/${workspaceId}/qa/runs`, {
      headers: ssrHeaders,
    })
    return runs.value
  }

  async function fetchSummary(workspaceId: string) {
    summary.value = await $fetch<QaWorkspaceSummary>(`/api/workspaces/${workspaceId}/qa/summary`, {
      headers: ssrHeaders,
    })
    return summary.value
  }

  async function createRun(projectId: string, data: {
    planId?: string | null
    caseIds?: string[]
    taskId?: string | null
    agentId?: string | null
    targetUrl?: string | null
    runtime?: 'cursor' | 'opencode'
  }) {
    const run = await $fetch<QaRun>(`/api/projects/${projectId}/qa/runs`, {
      method: 'POST',
      body: data,
    })
    runs.value = [run, ...runs.value]
    selectedRun.value = run
    return run
  }

  async function fetchRun(runId: string) {
    selectedRun.value = await $fetch<QaRun>(`/api/qa/runs/${runId}`, {
      headers: ssrHeaders,
    })
    return selectedRun.value
  }

  async function updateRun(runId: string, data: Partial<{
    status: string
    summary: string | null
  }>) {
    const updated = await $fetch<QaRun>(`/api/qa/runs/${runId}`, {
      method: 'PATCH',
      body: data,
    })
    selectedRun.value = updated
    const idx = runs.value.findIndex((r) => r.id === runId)
    if (idx !== -1) runs.value[idx] = { ...runs.value[idx], ...updated }
    return updated
  }

  async function updateRunCase(runCaseId: string, data: Partial<{
    status: QaRunCaseStatus
    actual: string | null
    error: string | null
  }>) {
    const updated = await $fetch<QaRunCase>(`/api/qa/run-cases/${runCaseId}`, {
      method: 'PATCH',
      body: data,
    })
    if (selectedRun.value?.runCases) {
      const idx = selectedRun.value.runCases.findIndex((c) => c.id === runCaseId)
      if (idx !== -1) {
        selectedRun.value.runCases[idx] = { ...selectedRun.value.runCases[idx], ...updated }
      }
    }
    return updated
  }

  async function executeRun(runId: string, data: {
    agentId?: string
    taskId?: string | null
    targetUrl?: string
  }) {
    const updated = await $fetch<QaRun>(`/api/qa/runs/${runId}/execute`, {
      method: 'POST',
      body: data,
    })
    selectedRun.value = updated
    const idx = runs.value.findIndex((r) => r.id === runId)
    if (idx !== -1) runs.value[idx] = { ...runs.value[idx], ...updated }
    return updated
  }

  async function fetchTaskQaRuns(taskId: string) {
    return $fetch<QaRun[]>(`/api/tasks/${taskId}/qa-runs`, {
      headers: ssrHeaders,
    })
  }

  return {
    suites,
    cases,
    plans,
    runs,
    selectedRun,
    summary,
    loading,
    fetchSuites,
    createSuite,
    updateSuite,
    deleteSuite,
    fetchCases,
    createCase,
    duplicateCase,
    updateCase,
    deleteCase,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    replacePlanCases,
    fetchRuns,
    fetchWorkspaceRuns,
    fetchSummary,
    createRun,
    fetchRun,
    updateRun,
    updateRunCase,
    executeRun,
    fetchTaskQaRuns,
  }
}
