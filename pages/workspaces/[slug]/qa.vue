<template>
  <div class="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-50">
    <div class="relative z-20 flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-surface-200 bg-white flex-shrink-0">
      <div class="flex items-center gap-2.5 min-w-0 shrink">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style="background: #0EA5E9"
        >
          <Icon name="lucide:flask-conical" class="w-4 h-4" />
        </div>
        <h2 class="text-sm font-semibold text-surface-900 flex-shrink-0">QA</h2>
        <span v-if="summary" class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">
          {{ summary.caseCount }} cases · {{ summary.runCount }} runs
        </span>
      </div>

      <div class="flex items-center gap-2 ml-auto flex-shrink-0 overflow-x-auto max-w-[min(100%,42rem)]">
        <QaProjectPicker
          v-model="selectedProjectId"
          :projects="projects"
          :disabled="pageLoading || projectLoading"
        />

        <div class="flex rounded-lg border border-surface-200 overflow-hidden">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="px-3 py-1.5 text-xs font-semibold"
            :class="activeTab === tab.id ? 'bg-surface-900 text-white dark:bg-black' : 'bg-white text-surface-600 hover:bg-surface-50 dark:hover:bg-surface-200'"
            :disabled="projectLoading"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-700 transition-colors"
          :disabled="!selectedProjectId || projectLoading"
          @click="openStartRun"
        >
          <Icon name="lucide:play" class="w-3 h-3" />
          Start run
        </button>
      </div>
    </div>

    <UiLoadingState v-if="pageLoading" text="Loading workspace..." class="flex-1" />

    <div v-else-if="!selectedProjectId" class="flex-1 flex items-center justify-center p-8">
      <UiEmptyState
        title="Select a project"
        description="QA suites, cases, plans, and runs are scoped to a project."
        icon="lucide:flask-conical"
      />
    </div>

    <UiLoadingState v-else-if="projectLoading" text="Loading QA data..." class="flex-1" />

    <div v-else class="flex flex-1 overflow-hidden min-h-0">
      <!-- Cases tab -->
      <template v-if="activeTab === 'cases'">
        <div class="w-52 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaSuiteTree
            :suites="suites"
            :selected-id="selectedSuiteId"
            :creating="creatingSuite"
            :deleting-id="deletingSuiteId"
            @select="onSelectSuite"
            @create="onCreateSuite"
            @remove="onDeleteSuite"
          />
        </div>
        <div class="w-72 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaCaseList
            :cases="filteredCases"
            :selected-id="selectedCaseId"
            :creating="creatingCase"
            @select="onSelectCase"
            @create="onCreateCase"
          />
        </div>
        <div class="flex-1 p-3 min-w-0 overflow-hidden">
          <QaCaseEditor
            :model-value="selectedCase"
            :suites="suites"
            :saving="savingCase"
            :saved="caseSaved"
            :deleting="deletingCaseId === selectedCaseId"
            :duplicating="duplicatingCase"
            @save="onSaveCase"
            @remove="onDeleteCase"
            @duplicate="onDuplicateCase"
          />
        </div>
      </template>

      <!-- Plans tab -->
      <template v-else-if="activeTab === 'plans'">
        <div class="w-72 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaPlanList
            :plans="plans"
            :selected-id="selectedPlanId"
            :creating="creatingPlan"
            @select="onSelectPlan"
            @create="onCreatePlan"
          />
        </div>
        <div class="flex-1 p-3 min-w-0 overflow-hidden">
          <QaPlanEditor
            :plan="selectedPlan"
            :all-cases="cases"
            :saving="savingPlan"
            :saved="planSaved"
            :updating-cases="updatingPlanCases"
            :cases-updated="planCasesUpdated"
            :deleting="deletingPlanId === selectedPlanId"
            @save="onSavePlan"
            @replace-cases="onReplacePlanCases"
            @remove="onDeletePlan"
          />
        </div>
      </template>

      <!-- Runs tab -->
      <template v-else>
        <div class="w-72 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaRunList
            :runs="runs"
            :selected-id="selectedRunId"
            @select="onSelectRun"
          />
        </div>
        <div class="flex-1 p-3 min-w-0 overflow-hidden">
          <QaRunDetail
            :run="selectedRun"
            :loading="loadingRun"
            :updating-case-id="updatingRunCaseId"
            :workspace-slug="slug"
            @update-case="onUpdateRunCase"
            @refresh="onRefreshRun"
          />
        </div>
      </template>
    </div>

    <QaStartRunModal
      :open="showStartRun"
      :plans="plans"
      :cases="cases"
      :agents="agents"
      :start-run="onStartRun"
      @close="showStartRun = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { Workspace, QaCase, QaPlan, QaRunCaseStatus } from '~/types'
import { getApiErrorMessage } from '~/utils/api-error'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)

const { getWorkspaceBySlug } = useWorkspace()
const { projects, fetchProjects } = useProject()
const { agents, fetchAgents } = useAgent()
const { startRuntime } = useAgentRuntime()
const {
  suites,
  cases,
  plans,
  runs,
  selectedRun,
  summary,
  fetchSuites,
  createSuite,
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
  fetchSummary,
  createRun,
  fetchRun,
  updateRunCase,
  executeRun,
} = useQa()

const workspace = ref<Workspace | null>(null)
const selectedProjectId = ref<string | null>(null)
const activeTab = ref<'cases' | 'plans' | 'runs'>('cases')
const tabs = [
  { id: 'cases' as const, label: 'Cases' },
  { id: 'plans' as const, label: 'Plans' },
  { id: 'runs' as const, label: 'Runs' },
]

const selectedSuiteId = ref<string | null>(null)
const selectedCaseId = ref<string | null>(null)
const selectedPlanId = ref<string | null>(null)
const selectedRunId = ref<string | null>(null)

const pageLoading = ref(true)
const projectLoading = ref(false)
const showStartRun = ref(false)

function openStartRun() {
  if (!selectedProjectId.value || projectLoading.value) return
  showStartRun.value = true
}

const creatingSuite = ref(false)
const deletingSuiteId = ref<string | null>(null)
const creatingCase = ref(false)
const deletingCaseId = ref<string | null>(null)
const savingCase = ref(false)
const caseSaved = ref(false)
const duplicatingCase = ref(false)

const creatingPlan = ref(false)
const deletingPlanId = ref<string | null>(null)
const savingPlan = ref(false)
const planSaved = ref(false)
const updatingPlanCases = ref(false)
const planCasesUpdated = ref(false)

const loadingRun = ref(false)
const updatingRunCaseId = ref<string | null>(null)

const { success: toastSuccess, error: toastError } = useToast()

const selectedCase = computed(() => cases.value.find((c) => c.id === selectedCaseId.value) || null)
const selectedPlan = computed(() => plans.value.find((p) => p.id === selectedPlanId.value) || null)
const filteredCases = computed(() => {
  if (!selectedSuiteId.value) return cases.value
  return cases.value.filter((c) => c.suiteId === selectedSuiteId.value)
})

function flashSaved(savedRef: Ref<boolean>) {
  savedRef.value = true
  setTimeout(() => { savedRef.value = false }, 2000)
}

async function loadProjectData(projectId: string) {
  projectLoading.value = true
  try {
    await Promise.all([
      fetchSuites(projectId),
      fetchCases(projectId),
      fetchPlans(projectId),
      fetchRuns(projectId),
    ])
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to load QA data'), 'Load error')
  } finally {
    projectLoading.value = false
  }
}

watch(selectedProjectId, async (id, prev) => {
  if (prev != null && prev !== id) {
    selectedSuiteId.value = null
    selectedCaseId.value = null
    selectedPlanId.value = null
    selectedRunId.value = null
    selectedRun.value = null
    router.replace({ query: { ...route.query, plan: undefined, run: undefined } })
  }
  if (!id) return
  await loadProjectData(id)
})

watch(selectedCaseId, () => {
  caseSaved.value = false
})

watch(selectedPlanId, () => {
  planSaved.value = false
  planCasesUpdated.value = false
})

watch(activeTab, async (tab) => {
  if (tab === 'runs' && selectedRunId.value && !selectedRun.value) {
    loadingRun.value = true
    try {
      await fetchRun(selectedRunId.value)
    } catch (err: unknown) {
      toastError(getApiErrorMessage(err, 'Failed to load run'), 'Load error')
    } finally {
      loadingRun.value = false
    }
  }
})

onMounted(async () => {
  pageLoading.value = true
  try {
    workspace.value = await getWorkspaceBySlug(slug.value)
    if (!workspace.value) {
      toastError('Workspace not found', 'Error')
      return
    }
    await Promise.all([
      fetchProjects(workspace.value.id),
      fetchAgents(),
      fetchSummary(workspace.value.id),
    ])
    const runParam = route.query.run as string | undefined
    const planParam = route.query.plan as string | undefined
    let initialProjectId = projects.value[0]?.id || null

    if (runParam) {
      loadingRun.value = true
      try {
        await fetchRun(runParam)
        if (selectedRun.value?.projectId) {
          initialProjectId = selectedRun.value.projectId
        }
      } catch (err: unknown) {
        toastError(getApiErrorMessage(err, 'Failed to load run'), 'Load error')
      } finally {
        loadingRun.value = false
      }
    }

    if (planParam) {
      try {
        const plan = await $fetch<QaPlan>(`/api/qa/plans/${planParam}`)
        if (plan.projectId) {
          initialProjectId = plan.projectId
        }
      } catch (err: unknown) {
        toastError(getApiErrorMessage(err, 'Failed to load plan'), 'Load error')
      }
    }

    selectedProjectId.value = initialProjectId

    if (planParam) {
      activeTab.value = 'plans'
      selectedPlanId.value = planParam
    }

    if (runParam) {
      activeTab.value = 'runs'
      selectedRunId.value = runParam
      if (!selectedRun.value) {
        loadingRun.value = true
        try {
          await fetchRun(runParam)
        } catch (err: unknown) {
          toastError(getApiErrorMessage(err, 'Failed to load run'), 'Load error')
        } finally {
          loadingRun.value = false
        }
      }
    }
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to load workspace'), 'Load error')
  } finally {
    pageLoading.value = false
  }
})

function onSelectSuite(id: string | null) {
  selectedSuiteId.value = id
}

async function onCreateSuite(name: string) {
  if (!selectedProjectId.value || creatingSuite.value) return
  creatingSuite.value = true
  try {
    await createSuite(selectedProjectId.value, { name })
    toastSuccess(`Suite "${name}" created.`, 'Suite created')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to create suite'), 'Error')
  } finally {
    creatingSuite.value = false
  }
}

async function onDeleteSuite(id: string) {
  if (deletingSuiteId.value) return
  deletingSuiteId.value = id
  try {
    await deleteSuite(id)
    if (selectedSuiteId.value === id) selectedSuiteId.value = null
    toastSuccess('Suite deleted.', 'Deleted')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to delete suite'), 'Error')
  } finally {
    deletingSuiteId.value = null
  }
}

function onSelectCase(id: string) {
  selectedCaseId.value = id
}

async function onCreateCase() {
  if (!selectedProjectId.value || creatingCase.value) return
  creatingCase.value = true
  try {
    const created = await createCase(selectedProjectId.value, {
      title: 'New test case',
      suiteId: selectedSuiteId.value,
      steps: [{ order: 1, action: 'Open the page', expected: 'Page loads' }],
      priority: 'medium',
      status: 'draft',
    })
    selectedCaseId.value = created.id
    await fetchSuites(selectedProjectId.value)
    toastSuccess('New test case created.', 'Case created')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to create case'), 'Error')
  } finally {
    creatingCase.value = false
  }
}

async function onSaveCase(data: Partial<QaCase>) {
  if (!selectedCaseId.value || savingCase.value) return
  if (!data.title?.trim()) {
    toastError('Case title is required', 'Cannot save')
    return
  }

  savingCase.value = true
  caseSaved.value = false
  try {
    await updateCase(selectedCaseId.value, data as any)
    if (selectedProjectId.value) await fetchSuites(selectedProjectId.value)
    toastSuccess('Your changes were saved.', 'Case saved')
    flashSaved(caseSaved)
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to save case'), 'Error')
  } finally {
    savingCase.value = false
  }
}

async function onDuplicateCase() {
  if (!selectedCase.value || !selectedProjectId.value || duplicatingCase.value) return
  duplicatingCase.value = true
  const sourceTitle = selectedCase.value.title
  try {
    const dup = await duplicateCase(selectedCase.value)
    selectedCaseId.value = dup.id
    await fetchSuites(selectedProjectId.value)
    toastSuccess(`Created "${dup.title}" from "${sourceTitle}".`, 'Case duplicated')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to duplicate case'), 'Error')
  } finally {
    duplicatingCase.value = false
  }
}

async function onDeleteCase(id: string) {
  if (deletingCaseId.value) return
  deletingCaseId.value = id
  try {
    await deleteCase(id)
    if (selectedCaseId.value === id) selectedCaseId.value = null
    if (selectedProjectId.value) await fetchSuites(selectedProjectId.value)
    toastSuccess('Case deleted.', 'Deleted')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to delete case'), 'Error')
  } finally {
    deletingCaseId.value = null
  }
}

function onSelectPlan(id: string) {
  selectedPlanId.value = id
  router.replace({ query: { ...route.query, plan: id, run: undefined } })
}

async function onCreatePlan() {
  if (!selectedProjectId.value || creatingPlan.value) return
  creatingPlan.value = true
  try {
    const plan = await createPlan(selectedProjectId.value, { name: 'New plan' })
    selectedPlanId.value = plan.id
    router.replace({ query: { ...route.query, plan: plan.id, run: undefined } })
    toastSuccess('New plan created.', 'Plan created')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to create plan'), 'Error')
  } finally {
    creatingPlan.value = false
  }
}

async function onSavePlan(data: { name: string; description: string | null }) {
  if (!selectedPlanId.value || savingPlan.value) return
  if (!data.name.trim()) {
    toastError('Plan name is required', 'Cannot save')
    return
  }

  savingPlan.value = true
  planSaved.value = false
  try {
    await updatePlan(selectedPlanId.value, data)
    toastSuccess('Plan details saved.', 'Plan saved')
    flashSaved(planSaved)
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to save plan'), 'Error')
  } finally {
    savingPlan.value = false
  }
}

async function onReplacePlanCases(caseIds: string[]) {
  if (!selectedPlanId.value || updatingPlanCases.value) return
  updatingPlanCases.value = true
  planCasesUpdated.value = false
  try {
    await replacePlanCases(selectedPlanId.value, caseIds)
    toastSuccess(`${caseIds.length} case(s) added to plan.`, 'Cases updated')
    flashSaved(planCasesUpdated)
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to update plan cases'), 'Error')
  } finally {
    updatingPlanCases.value = false
  }
}

async function onDeletePlan(id: string) {
  if (deletingPlanId.value) return
  deletingPlanId.value = id
  try {
    await deletePlan(id)
    if (selectedPlanId.value === id) selectedPlanId.value = null
    toastSuccess('Plan deleted.', 'Deleted')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to delete plan'), 'Error')
  } finally {
    deletingPlanId.value = null
  }
}

async function onSelectRun(id: string) {
  if (loadingRun.value) return
  selectedRunId.value = id
  loadingRun.value = true
  try {
    await fetchRun(id)
    router.replace({ query: { ...route.query, run: id } })
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to load run'), 'Load error')
  } finally {
    loadingRun.value = false
  }
}

async function onUpdateRunCase(id: string, data: { status?: QaRunCaseStatus; actual?: string | null }) {
  if (updatingRunCaseId.value) return
  updatingRunCaseId.value = id
  try {
    await updateRunCase(id, data)
    if (selectedRunId.value) await fetchRun(selectedRunId.value)
    if (selectedProjectId.value) await fetchRuns(selectedProjectId.value)
    toastSuccess('Run case updated.', 'Saved')
  } catch (err: unknown) {
    toastError(getApiErrorMessage(err, 'Failed to update run case'), 'Error')
  } finally {
    updatingRunCaseId.value = null
  }
}

async function onRefreshRun() {
  if (!selectedRunId.value || loadingRun.value) return
  try {
    await fetchRun(selectedRunId.value)
    if (selectedProjectId.value) await fetchRuns(selectedProjectId.value)
  } catch {
    // Ignore transient refresh errors during polling
  }
}

async function onStartRun(payload: {
  planId?: string | null
  caseIds?: string[]
  agentId?: string | null
  targetUrl: string
}) {
  if (!selectedProjectId.value) return

  const run = await createRun(selectedProjectId.value, {
    planId: payload.planId,
    caseIds: payload.caseIds,
    agentId: payload.agentId,
    targetUrl: payload.targetUrl,
  })
  activeTab.value = 'runs'
  selectedRunId.value = run.id
  loadingRun.value = true
  try {
    await fetchRun(run.id)
  } finally {
    loadingRun.value = false
  }

  if (payload.agentId) {
    try {
      const executed = await executeRun(run.id, {
        agentId: payload.agentId,
        targetUrl: payload.targetUrl,
      })
      if (executed.taskId) {
        await startRuntime(executed.taskId)
      }
    } catch (err: unknown) {
      toastError(
        getApiErrorMessage(err, 'Run created but agent execution failed'),
        'Execution error',
      )
    }
  }

  await fetchRuns(selectedProjectId.value)
  if (workspace.value) await fetchSummary(workspace.value.id)
  router.replace({ query: { ...route.query, run: run.id } })
  toastSuccess('QA run created.', 'Run started')
}
</script>
