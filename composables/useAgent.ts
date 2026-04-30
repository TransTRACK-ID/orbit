import type { Agent, AgentStatus, RuntimeInfo } from '~/types'

const sampleAgents: Agent[] = [
  { id:'ga1', name:'Aria Codex',   initials:'AC', runtime:'claude-code', purpose:'Senior agent specialized in middleware refactoring, authentication chains, and embedding cache optimization',  status:'idle',    color:'#7C3AED', role:'Senior Agent', tasks:12 },
  { id:'ga2', name:'Nova Prime',   initials:'NP', runtime:'codex',       purpose:'Review agent focused on PR validation, code quality gates, context window verification, and tool registry audits', status:'busy',    color:'#2563EB', role:'Review Agent', tasks:8 },
  { id:'ga3', name:'Echo Shell',   initials:'ES', runtime:'opencode',    purpose:'Fix agent specialized in memory leak diagnosis, crash debugging, rate limiter edge cases, and state serialization bugs', status:'busy',    color:'#DC2626', role:'Fix Agent', tasks:15 },
  { id:'ga4', name:'Luna Fetch',   initials:'LF', runtime:'kimi-cli',    purpose:'Junior agent learning observability patterns, heartbeat monitoring, analytics dashboards, and cache layer patterns', status:'offline', color:'#D97706', role:'Junior Agent', tasks:4 },
  { id:'ga5', name:'Vector Prime', initials:'VP', runtime:'claude-code', purpose:'API gateway specialist focusing on rate limit headers, WebSocket throttling, and playground development',            status:'idle',    color:'#0891B2', role:'API Agent', tasks:6 },
  { id:'ga6', name:'Sage Logic',   initials:'SL', runtime:'codex',       purpose:'Gateway agent managing OAuth refresh flows, CORS policy, and blue-green gateway deployments',                         status:'idle',    color:'#7C3AED', role:'Gateway Agent', tasks:4 },
  { id:'ga7', name:'Clippy Bot',   initials:'CB', runtime:'opencode',    purpose:'CLI scaffolding specialist for kanvas init, commands, project presets, and developer tooling',                    status:'idle',    color:'#16A34A', role:'CLI Agent', tasks:3 },
  { id:'ga8', name:'Docs Sage',    initials:'DS', runtime:'droid',       purpose:'Documentation agent for SDK type definitions, integration test harnesses, and API reference generation',           status:'offline', color:'#D97706', role:'Docs Agent', tasks:2 },
]

export const useAgent = () => {
  const agents = ref<Agent[]>([...sampleAgents])
  const filterAgentId = ref<string | null>(null)

  const runtimeInfo: Record<string, RuntimeInfo> = {
    'claude-code': { name:'Claude Code', icon:'lucide:terminal', color:'#7C3AED', desc:'Anthropic CLI agent for code generation and analysis' },
    'opencode':    { name:'OpenCode',    icon:'lucide:code',     color:'#2563EB', desc:'Open-source coding agent with multi-file editing' },
    'codex':       { name:'Codex',       icon:'lucide:brain',    color:'#059669', desc:'OpenAI-powered agent for complex reasoning tasks' },
    'kimi-cli':    { name:'Kimi CLI',    icon:'lucide:terminal', color:'#D97706', desc:'Moonshot AI CLI for autonomous software engineering' },
    'droid':       { name:'Droid',       icon:'lucide:bot',      color:'#DC2626', desc:'Containerized agent sandbox with tool execution' },
    'custom':      { name:'Custom CLI',  icon:'lucide:cog',      color:'#6B7280', desc:'Bring your own runtime agent' },
  }

  const runtimes = Object.entries(runtimeInfo).map(([id, r]) => ({ id, ...r }))

  const agentCounts = computed(() => ({
    total: agents.value.length,
    idle: agents.value.filter(a => a.status === 'idle').length,
    busy: agents.value.filter(a => a.status === 'busy').length,
    offline: agents.value.filter(a => a.status === 'offline').length,
  }))

  function createAgent(data: {
    name: string
    role: string
    runtime: string
    purpose: string
    status: AgentStatus
    color: string
  }) {
    const id = 'ga' + Date.now()
    const agent: Agent = {
      id,
      name: data.name,
      initials: data.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      role: data.role,
      runtime: data.runtime,
      purpose: data.purpose,
      status: data.status,
      color: data.color,
      tasks: 0,
    }
    agents.value.push(agent)
    return agent
  }

  function updateAgent(id: string, data: Partial<Agent>) {
    const idx = agents.value.findIndex(a => a.id === id)
    if (idx !== -1) {
      agents.value[idx] = { ...agents.value[idx], ...data }
      return agents.value[idx]
    }
    return null
  }

  function deleteAgent(id: string) {
    agents.value = agents.value.filter(a => a.id !== id)
  }

  function getAgentById(id: string) {
    return agents.value.find(a => a.id === id) || null
  }

  function toggleFilter(agentId: string) {
    filterAgentId.value = filterAgentId.value === agentId ? null : agentId
  }

  return {
    agents,
    filterAgentId,
    runtimeInfo,
    runtimes,
    agentCounts,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgentById,
    toggleFilter,
  }
}
