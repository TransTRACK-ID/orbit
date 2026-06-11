import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export type AgentRuntimeId = 'opencode' | 'cursor' | 'browser-qa'

export interface AgentRuntimeDefinition {
  id: AgentRuntimeId
  name: string
  desc: string
}

export interface AgentRuntimeSetting extends AgentRuntimeDefinition {
  enabled: boolean
  isDefault: boolean
  canDisable: boolean
}

interface RuntimeSettingsFile {
  disabled: AgentRuntimeId[]
}

const RUNTIME_DEFINITIONS: AgentRuntimeDefinition[] = [
  { id: 'opencode', name: 'OpenCode', desc: 'Open-source coding agent with multi-file editing' },
  { id: 'cursor', name: 'Cursor', desc: 'Cursor CLI agent with stream-json output' },
  { id: 'browser-qa', name: 'Browser QA', desc: 'Automated browser testing with AI agent' },
]

const KNOWN_RUNTIME_IDS = new Set<string>(RUNTIME_DEFINITIONS.map(r => r.id))

function resolveProjectRoot(): string {
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'server/data/agent-runtimes.json'))) {
    return cwd
  }

  try {
    const currentFileDir = dirname(fileURLToPath(import.meta.url))
    const candidates = [
      join(currentFileDir, '../..'),
      join(currentFileDir, '..'),
      join(currentFileDir, '../..'),
    ]
    for (const root of candidates) {
      if (existsSync(join(root, 'server/data/agent-runtimes.json'))) {
        return root
      }
    }
  } catch {
    // import.meta.url may not be available in some environments
  }

  return cwd
}

const settingsFilePath = join(resolveProjectRoot(), 'server/data/agent-runtimes.json')

let cachedSettings: RuntimeSettingsFile | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 2000

export function getDefaultAgentRuntime(): string {
  try {
    const config = useRuntimeConfig()
    const fromConfig = config.agentRuntime || config.public?.agentRuntime
    if (fromConfig) return fromConfig
  } catch {
    // Outside Nuxt request context (e.g. scripts)
  }
  return process.env.AGENT_RUNTIME || 'opencode'
}

export function isKnownRuntime(runtime: string): runtime is AgentRuntimeId {
  return KNOWN_RUNTIME_IDS.has(runtime)
}

async function loadSettingsFile(): Promise<RuntimeSettingsFile> {
  try {
    const data = await readFile(settingsFilePath, 'utf-8')
    const parsed = JSON.parse(data) as RuntimeSettingsFile
    return {
      disabled: Array.isArray(parsed.disabled)
        ? parsed.disabled.filter((id): id is AgentRuntimeId => isKnownRuntime(id))
        : [],
    }
  } catch {
    return { disabled: [] }
  }
}

async function getSettingsFile(): Promise<RuntimeSettingsFile> {
  const now = Date.now()
  if (!cachedSettings || now - cacheTimestamp > CACHE_TTL_MS) {
    cachedSettings = await loadSettingsFile()
    cacheTimestamp = now
  }
  return cachedSettings
}

export async function isRuntimeEnabled(runtime: string): Promise<boolean> {
  if (!isKnownRuntime(runtime)) return false
  if (runtime === getDefaultAgentRuntime()) return true
  const settings = await getSettingsFile()
  return !settings.disabled.includes(runtime)
}

export async function assertRuntimeAllowed(runtime: string): Promise<void> {
  if (!isKnownRuntime(runtime)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown runtime: ${runtime}` })
  }
  if (!(await isRuntimeEnabled(runtime))) {
    throw createError({ statusCode: 400, statusMessage: `Runtime "${runtime}" is disabled by the administrator` })
  }
}

export async function resolveEffectiveRuntime(requestedRuntime: string | null | undefined): Promise<string> {
  const fallback = getDefaultAgentRuntime()
  const runtime = requestedRuntime || fallback
  if (await isRuntimeEnabled(runtime)) {
    return runtime
  }
  return fallback
}

export async function getRuntimeSettings(): Promise<AgentRuntimeSetting[]> {
  const settings = await getSettingsFile()
  const defaultRuntime = getDefaultAgentRuntime()

  return RUNTIME_DEFINITIONS.map((runtime) => {
    const isDefault = runtime.id === defaultRuntime
    const enabled = isDefault || !settings.disabled.includes(runtime.id)
    return {
      ...runtime,
      enabled,
      isDefault,
      canDisable: !isDefault,
    }
  })
}

export async function getEnabledRuntimes(): Promise<AgentRuntimeSetting[]> {
  const settings = await getRuntimeSettings()
  return settings.filter(r => r.enabled)
}

export async function updateRuntimeSettings(updates: { id: AgentRuntimeId; enabled: boolean }[]): Promise<AgentRuntimeSetting[]> {
  const defaultRuntime = getDefaultAgentRuntime()
  const settings = await getSettingsFile()
  const disabled = new Set(settings.disabled)

  for (const update of updates) {
    if (!isKnownRuntime(update.id)) {
      throw createError({ statusCode: 400, statusMessage: `Unknown runtime: ${update.id}` })
    }
    if (update.id === defaultRuntime && !update.enabled) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot disable the default runtime "${defaultRuntime}" configured in AGENT_RUNTIME`,
      })
    }
    if (update.enabled) {
      disabled.delete(update.id)
    } else {
      disabled.add(update.id)
    }
  }

  const nextSettings: RuntimeSettingsFile = { disabled: [...disabled] }
  await writeFile(settingsFilePath, JSON.stringify(nextSettings, null, 2) + '\n', 'utf-8')
  cachedSettings = nextSettings
  cacheTimestamp = Date.now()

  return getRuntimeSettings()
}
