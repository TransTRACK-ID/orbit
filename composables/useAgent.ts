import type { Agent, AgentStatus, AgentCurrentTask, RuntimeInfo, AgentRuntimeOption } from '~/types'

const agents = ref<Agent[]>([])
const loading = ref(false)
const filterAgentId = ref<string | null>(null)
const agentPanelOpen = ref(false)
const healthStatus = ref<Record<string, 'idle' | 'busy' | 'offline'>>({})
const runtimeReachable = ref(false)
const cursorRuntimeReachable = ref(false)
const agentCurrentTasks = ref<Record<string, AgentCurrentTask[]>>({})
const enabledRuntimeOptions = ref<AgentRuntimeOption[]>([])
const defaultRuntime = ref<string | null>(null)

export const useAgent = () => {
  const config = useRuntimeConfig()
  if (!defaultRuntime.value) {
    defaultRuntime.value = config.public.agentRuntime || 'opencode'
  }

  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const runtimeInfo: Record<string, RuntimeInfo> = {
    'opencode':    { name:'OpenCode',    icon:'lucide:code',     color:'#2563EB', desc:'Open-source coding agent with multi-file editing' },
    'cursor':      { name:'Cursor',      icon:'lucide:sparkles', color:'#F59E0B', desc:'Cursor CLI agent with stream-json output' },
    'browser-qa':  { name:'Browser QA',  icon:'lucide:globe',    color:'#059669', desc:'Automated browser testing with AI agent' },
  }

  const runtimes = computed(() => {
    if (enabledRuntimeOptions.value.length > 0) {
      return enabledRuntimeOptions.value.map((runtime) => ({
        ...runtime,
        ...runtimeInfo[runtime.id],
      }))
    }
    return Object.entries(runtimeInfo).map(([id, r]) => ({ id, ...r }))
  })

  const computedStatuses = computed<Record<string, AgentStatus>>(() => {
    const map: Record<string, AgentStatus> = {}
    for (const a of agents.value) {
      map[a.id] = healthStatus.value[a.id] || (a.status as AgentStatus) || 'idle'
    }
    return map
  })

  const agentCounts = computed(() => ({
    total: agents.value.length,
    idle: agents.value.filter(a => computedStatuses.value[a.id] === 'idle').length,
    busy: agents.value.filter(a => computedStatuses.value[a.id] === 'busy').length,
    offline: agents.value.filter(a => computedStatuses.value[a.id] === 'offline').length,
  }))

  async function fetchEnabledRuntimes() {
    try {
      const res = await $fetch<{ runtimes: AgentRuntimeOption[]; defaultRuntime: string }>('/api/agents/runtimes', {
        headers: ssrHeaders,
      })
      enabledRuntimeOptions.value = res.runtimes.map((runtime) => ({
        ...runtime,
        ...runtimeInfo[runtime.id],
      }))
      defaultRuntime.value = res.defaultRuntime
    } catch (err) {
      console.error('Failed to fetch enabled runtimes:', err)
    }
  }

  function resolveTemplateRuntime(preferredRuntime: string): string {
    const fallback = defaultRuntime.value || config.public.agentRuntime || 'opencode'
    const enabledIds = new Set(runtimes.value.map(r => r.id))
    if (enabledIds.has(preferredRuntime)) return preferredRuntime
    if (enabledIds.has(fallback)) return fallback
    return runtimes.value[0]?.id || fallback
  }

  async function fetchHealth() {
    try {
      const res = await $fetch<{ runtimeReachable: boolean; cursorRuntimeReachable?: boolean; health: Record<string, 'idle' | 'busy' | 'offline'>; currentTasks?: Record<string, AgentCurrentTask[]> }>('/api/agents/health', {
        headers: ssrHeaders,
      })
      runtimeReachable.value = res.runtimeReachable
      cursorRuntimeReachable.value = res.cursorRuntimeReachable ?? false
      healthStatus.value = res.health
      agentCurrentTasks.value = res.currentTasks ?? {}
    } catch (err) {
      console.error('Failed to fetch agent health:', err)
      runtimeReachable.value = false
      cursorRuntimeReachable.value = false
    }
  }

  async function fetchAgents() {
    loading.value = true
    try {
      await fetchEnabledRuntimes()
      agents.value = await $fetch<Agent[]>('/api/agents', {
        headers: ssrHeaders,
      })
      await fetchHealth()
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      loading.value = false
    }
  }

  async function createAgent(data: { name: string; role: string; runtime: string; purpose: string; status: AgentStatus; color: string }) {
    const agent = await $fetch<Agent>('/api/agents', {
      method: 'POST',
      body: data,
    })
    agents.value.push(agent)
    return agent
  }

  async function updateAgent(id: string, data: Partial<Agent>) {
    const updated = await $fetch<Agent>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = agents.value.findIndex(a => a.id === id)
    if (idx !== -1) agents.value[idx] = updated
    return updated
  }

  async function deleteAgent(id: string) {
    await $fetch(`/api/agents/${id}`, { method: 'DELETE' })
    agents.value = agents.value.filter(a => a.id !== id)
  }

  function getAgentById(id: string) {
    return agents.value.find(a => a.id === id) || null
  }

  function toggleAgentPanel() {
    agentPanelOpen.value = !agentPanelOpen.value
  }

  function toggleFilter(agentId: string) {
    filterAgentId.value = filterAgentId.value === agentId ? null : agentId
  }

  function computeInitials(name: string) {
    return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function getAgentStatus(agentId: string): AgentStatus {
    return computedStatuses.value[agentId] || 'idle'
  }

  function getAgentCurrentTasks(agentId: string): AgentCurrentTask[] {
    return agentCurrentTasks.value[agentId] ?? []
  }

  return {
    agents, loading, filterAgentId, agentPanelOpen, runtimeInfo, runtimes, agentCounts,
    runtimeReachable, cursorRuntimeReachable, healthStatus, computedStatuses, getAgentStatus,
    agentCurrentTasks, getAgentCurrentTasks, defaultRuntime, enabledRuntimeOptions,
    fetchAgents, fetchHealth, fetchEnabledRuntimes, createAgent, updateAgent, deleteAgent,
    getAgentById, toggleAgentPanel, toggleFilter, computeInitials, resolveTemplateRuntime,
  }
}
