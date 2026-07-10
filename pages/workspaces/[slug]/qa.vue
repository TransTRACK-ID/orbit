<template>
  <div class="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-50">
    <div class="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-surface-200 bg-white flex-shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style="background: #0EA5E9"
        >
          <Icon name="lucide:flask-conical" class="w-4 h-4" />
        </div>
        <h2 class="text-sm font-semibold text-surface-900 flex-shrink-0">QA</h2>
        <span v-if="summary" class="text-xs text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0">
          {{ summary.caseCount }} cases · {{ summary.runCount }} runs
        </span>
      </div>

      <div class="flex items-center gap-2 ml-auto">
        <QaProjectPicker v-model="selectedProjectId" :projects="projects" />

        <div class="flex rounded-lg border border-surface-200 overflow-hidden">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="px-3 py-1.5 text-xs font-semibold"
            :class="activeTab === tab.id ? 'bg-surface-900 text-white dark:bg-black' : 'bg-white text-surface-600 hover:bg-surface-50 dark:hover:bg-surface-200'"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          :disabled="!selectedProjectId"
          @click="showStartRun = true"
        >
          <Icon name="lucide:play" class="w-3 h-3" />
          Start run
        </button>
      </div>
    </div>

    <div v-if="!selectedProjectId" class="flex-1 flex items-center justify-center p-8">
      <UiEmptyState
        title="Select a project"
        description="QA suites, cases, plans, and runs are scoped to a project."
        icon="lucide:flask-conical"
      />
    </div>

    <div v-else class="flex flex-1 overflow-hidden min-h-0">
      <!-- Cases tab -->
      <template v-if="activeTab === 'cases'">
        <div class="w-52 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaSuiteTree
            :suites="suites"
            :selected-id="selectedSuiteId"
            @select="onSelectSuite"
            @create="onCreateSuite"
            @remove="onDeleteSuite"
          />
        </div>
        <div class="w-72 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaCaseList
            :cases="filteredCases"
            :selected-id="selectedCaseId"
            :loading="tabLoading"
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
            @save="onSaveCase"
            @remove="onDeleteCase"
          />
        </div>
      </template>

      <!-- Plans tab -->
      <template v-else-if="activeTab === 'plans'">
        <div class="w-72 flex-shrink-0 border-r border-surface-200 bg-white p-3 overflow-hidden">
          <QaPlanList
            :plans="plans"
            :selected-id="selectedPlanId"
            @select="onSelectPlan"
            @create="onCreatePlan"
          />
        </div>
        <div class="flex-1 p-3 min-w-0 overflow-hidden">
          <QaPlanEditor
            :plan="selectedPlan"
            :all-cases="cases"
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
            @update-case="onUpdateRunCase"
          />
        </div>
      </template>
    </div>

    <QaStartRunModal
      :open="showStartRun"
      :plans="plans"
      :cases="cases"
      :agents="agents"
      @close="showStartRun = false"
      @start="onStartRun"
    />
  </div>
</template>

<script setup lang="ts">
import type { Workspace, QaCase, QaPlan, QaRunCaseStatus } from '~/types'

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
const tabLoading = ref(false)
const showStartRun = ref(false)
const savingCase = ref(false)
const caseSaved = ref(false)

const { success: toastSuccess, error: toastError } = useToast()

const selectedCase = computed(() => cases.value.find((c) => c.id === selectedCaseId.value) || null)
const selectedPlan = computed(() => plans.value.find((p) => p.id === selectedPlanId.value) || null)
const filteredCases = computed(() => {
  if (!selectedSuiteId.value) return cases.value
  return cases.value.filter((c) => c.suiteId === selectedSuiteId.value)
})

async function loadProjectData(projectId: string) {
  tabLoading.value = true
  try {
    await Promise.all([
      fetchSuites(projectId),
      fetchCases(projectId),
      fetchPlans(projectId),
      fetchRuns(projectId),
    ])
  } finally {
    tabLoading.value = false
  }
}

watch(selectedProjectId, async (id) => {
  selectedSuiteId.value = null
  selectedCaseId.value = null
  selectedPlanId.value = null
  selectedRunId.value = null
  selectedRun.value = null
  if (!id) return
  await loadProjectData(id)
})

watch(selectedCaseId, () => {
  caseSaved.value = false
})

watch(activeTab, (tab) => {
  if (tab === 'runs' && selectedRunId.value && !selectedRun.value) {
    fetchRun(selectedRunId.value)
  }
})

onMounted(async () => {
  workspace.value = await getWorkspaceBySlug(slug.value)
  if (!workspace.value) return
  await Promise.all([
    fetchProjects(workspace.value.id),
    fetchAgents(),
    fetchSummary(workspace.value.id),
  ])
  selectedProjectId.value = projects.value[0]?.id || null

  const runParam = route.query.run as string | undefined
  if (runParam) {
    activeTab.value = 'runs'
    selectedRunId.value = runParam
    await fetchRun(runParam)
    if (selectedRun.value?.projectId) {
      selectedProjectId.value = selectedRun.value.projectId
    }
  }
})

function onSelectSuite(id: string | null) {
  selectedSuiteId.value = id
}

async function onCreateSuite(name: string) {
  if (!selectedProjectId.value) return
  await createSuite(selectedProjectId.value, { name })
}

async function onDeleteSuite(id: string) {
  await deleteSuite(id)
  if (selectedSuiteId.value === id) selectedSuiteId.value = null
}

function onSelectCase(id: string) {
  selectedCaseId.value = id
}

async function onCreateCase() {
  if (!selectedProjectId.value) return
  const created = await createCase(selectedProjectId.value, {
    title: 'New test case',
    suiteId: selectedSuiteId.value,
    steps: [{ order: 1, action: 'Open the page', expected: 'Page loads' }],
    priority: 'medium',
    status: 'draft',
  })
  selectedCaseId.value = created.id
  await fetchSuites(selectedProjectId.value)
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
    caseSaved.value = true
    setTimeout(() => { caseSaved.value = false }, 2000)
  } catch (err: any) {
    toastError(err?.data?.statusMessage || err?.data?.message || 'Failed to save case', 'Error')
  } finally {
    savingCase.value = false
  }
}

async function onDeleteCase(id: string) {
  await deleteCase(id)
  if (selectedCaseId.value === id) selectedCaseId.value = null
  if (selectedProjectId.value) await fetchSuites(selectedProjectId.value)
}

function onSelectPlan(id: string) {
  selectedPlanId.value = id
}

async function onCreatePlan() {
  if (!selectedProjectId.value) return
  const plan = await createPlan(selectedProjectId.value, { name: 'New plan' })
  selectedPlanId.value = plan.id
}

async function onSavePlan(data: { name: string; description: string | null }) {
  if (!selectedPlanId.value) return
  await updatePlan(selectedPlanId.value, data)
}

async function onReplacePlanCases(caseIds: string[]) {
  if (!selectedPlanId.value) return
  await replacePlanCases(selectedPlanId.value, caseIds)
}

async function onDeletePlan(id: string) {
  await deletePlan(id)
  if (selectedPlanId.value === id) selectedPlanId.value = null
}

async function onSelectRun(id: string) {
  selectedRunId.value = id
  await fetchRun(id)
  router.replace({ query: { ...route.query, run: id } })
}

async function onUpdateRunCase(id: string, data: { status?: QaRunCaseStatus; actual?: string | null }) {
  await updateRunCase(id, data)
  if (selectedRunId.value) await fetchRun(selectedRunId.value)
  if (selectedProjectId.value) await fetchRuns(selectedProjectId.value)
}

async function onStartRun(payload: {
  planId?: string | null
  caseIds?: string[]
  agentId?: string | null
  targetUrl: string
}) {
  if (!selectedProjectId.value) return
  showStartRun.value = false
  const run = await createRun(selectedProjectId.value, {
    planId: payload.planId,
    caseIds: payload.caseIds,
    agentId: payload.agentId,
    targetUrl: payload.targetUrl,
  })
  activeTab.value = 'runs'
  selectedRunId.value = run.id
  await fetchRun(run.id)

  if (payload.agentId) {
    const executed = await executeRun(run.id, {
      agentId: payload.agentId,
      targetUrl: payload.targetUrl,
    })
    if (executed.taskId) {
      await startRuntime(executed.taskId)
    }
  }

  await fetchRuns(selectedProjectId.value)
  if (workspace.value) await fetchSummary(workspace.value.id)
  router.replace({ query: { ...route.query, run: run.id } })
}
</script>
