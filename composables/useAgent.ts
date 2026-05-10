import type { Agent, AgentStatus, RuntimeInfo } from '~/types'

const agents = ref<Agent[]>([])
const loading = ref(false)
const filterAgentId = ref<string | null>(null)
const agentPanelOpen = ref(false)
const healthStatus = ref<Record<string, 'idle' | 'busy' | 'offline'>>({})
const runtimeReachable = ref(false)

export const useAgent = () => {

  const runtimeInfo: Record<string, RuntimeInfo> = {
    'opencode':    { name:'OpenCode',    icon:'lucide:code',     color:'#2563EB', desc:'Open-source coding agent with multi-file editing' },
  }

  const runtimes = Object.entries(runtimeInfo).map(([id, r]) => ({ id, ...r }))

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

  async function fetchHealth() {
    try {
      const res = await $fetch<{ runtimeReachable: boolean; health: Record<string, 'idle' | 'busy' | 'offline'> }>('/api/agents/health')
      runtimeReachable.value = res.runtimeReachable
      healthStatus.value = res.health
    } catch (err) {
      console.error('Failed to fetch agent health:', err)
      runtimeReachable.value = false
    }
  }

  async function fetchAgents() {
    loading.value = true
    try {
      agents.value = await $fetch<Agent[]>('/api/agents')
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

  return {
    agents, loading, filterAgentId, agentPanelOpen, runtimeInfo, runtimes, agentCounts,
    runtimeReachable, healthStatus, computedStatuses, getAgentStatus,
    fetchAgents, fetchHealth, createAgent, updateAgent, deleteAgent,
    getAgentById, toggleAgentPanel, toggleFilter, computeInitials,
  }
}
