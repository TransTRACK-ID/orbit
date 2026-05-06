import type { Agent, AgentStatus, RuntimeInfo } from '~/types'

const agents = ref<Agent[]>([])
const loading = ref(false)
const filterAgentId = ref<string | null>(null)
const agentPanelOpen = ref(false)

export const useAgent = () => {

  const runtimeInfo: Record<string, RuntimeInfo> = {
    'opencode':    { name:'OpenCode',    icon:'lucide:code',     color:'#2563EB', desc:'Open-source coding agent with multi-file editing' },
  }

  const runtimes = Object.entries(runtimeInfo).map(([id, r]) => ({ id, ...r }))

  const agentCounts = computed(() => ({
    total: agents.value.length,
    idle: agents.value.filter(a => a.status === 'idle').length,
    busy: agents.value.filter(a => a.status === 'busy').length,
    offline: agents.value.filter(a => a.status === 'offline').length,
  }))

  async function fetchAgents() {
    loading.value = true
    try {
      agents.value = await $fetch<Agent[]>('/api/agents')
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

  return {
    agents, loading, filterAgentId, agentPanelOpen, runtimeInfo, runtimes, agentCounts,
    fetchAgents, createAgent, updateAgent, deleteAgent,
    getAgentById, toggleAgentPanel, toggleFilter, computeInitials,
  }
}
