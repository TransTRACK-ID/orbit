import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { eq } from 'drizzle-orm'
import { getDb } from '~/server/database'
import {
  platformSettings,
  AGENT_RUNTIMES_SETTINGS_KEY,
  type AgentRuntimeSettingsValue,
} from '~/server/database/schema/platform-settings'

export type AgentRuntimeId = 'opencode' | 'cursor'

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

const RUNTIME_DEFINITIONS: AgentRuntimeDefinition[] = [
  { id: 'opencode', name: 'OpenCode', desc: 'Open-source coding agent with multi-file editing' },
  { id: 'cursor', name: 'Cursor', desc: 'Cursor CLI agent with stream-json output' },
]

const KNOWN_RUNTIME_IDS = new Set<string>(RUNTIME_DEFINITIONS.map(r => r.id))

const DEFAULT_SETTINGS: AgentRuntimeSettingsValue = { disabled: [] }

let cachedSettings: AgentRuntimeSettingsValue | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 2000

function resolveLegacySettingsFilePath(): string {
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'server/data/agent-runtimes.json'))) {
    return join(cwd, 'server/data/agent-runtimes.json')
  }

  try {
    const currentFileDir = dirname(fileURLToPath(import.meta.url))
    const candidates = [
      join(currentFileDir, '../..'),
      join(currentFileDir, '..'),
    ]
    for (const root of candidates) {
      const path = join(root, 'server/data/agent-runtimes.json')
      if (existsSync(path)) {
        return path
      }
    }
  } catch {
    // import.meta.url may not be available in some environments
  }

  return join(cwd, 'server/data/agent-runtimes.json')
}

function normalizeSettings(value: AgentRuntimeSettingsValue): AgentRuntimeSettingsValue {
  return {
    disabled: Array.isArray(value.disabled)
      ? value.disabled.filter((id): id is AgentRuntimeId => isKnownRuntime(id))
      : [],
  }
}

async function tryLoadLegacyJsonFile(): Promise<AgentRuntimeSettingsValue> {
  try {
    const data = await readFile(resolveLegacySettingsFilePath(), 'utf-8')
    const parsed = JSON.parse(data) as AgentRuntimeSettingsValue
    return normalizeSettings(parsed)
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function saveSettingsToDb(value: AgentRuntimeSettingsValue): Promise<void> {
  const db = getDb()
  await db
    .insert(platformSettings)
    .values({ key: AGENT_RUNTIMES_SETTINGS_KEY, value })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value, updatedAt: new Date() },
    })
}

async function loadSettingsFromDb(): Promise<AgentRuntimeSettingsValue> {
  const db = getDb()
  const row = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, AGENT_RUNTIMES_SETTINGS_KEY),
  })

  if (row) {
    return normalizeSettings(row.value)
  }

  const fromFile = await tryLoadLegacyJsonFile()
  await saveSettingsToDb(fromFile)
  return fromFile
}

function resolveRuntimeFromEnv(): string | undefined {
  // Match nuxt.config.ts: NUXT_* overrides take precedence over bare AGENT_RUNTIME.
  const value =
    process.env.NUXT_AGENT_RUNTIME ||
    process.env.NUXT_PUBLIC_AGENT_RUNTIME ||
    process.env.AGENT_RUNTIME
  return value?.trim() || undefined
}

export function getDefaultAgentRuntime(): string {
  try {
    // Nitro applies NUXT_AGENT_RUNTIME / NUXT_PUBLIC_AGENT_RUNTIME at runtime via applyEnv,
    // so this correctly reflects Docker/production overrides even when the build baked opencode.
    const config = useRuntimeConfig()
    const fromConfig = config.agentRuntime || config.public?.agentRuntime
    if (fromConfig) return fromConfig
  } catch {
    // Outside Nuxt request context (e.g. scripts)
  }

  const fromEnv = resolveRuntimeFromEnv()
  return fromEnv || 'opencode'
}

export function isKnownRuntime(runtime: string): runtime is AgentRuntimeId {
  return KNOWN_RUNTIME_IDS.has(runtime)
}

async function getSettings(): Promise<AgentRuntimeSettingsValue> {
  const now = Date.now()
  if (!cachedSettings || now - cacheTimestamp > CACHE_TTL_MS) {
    cachedSettings = await loadSettingsFromDb()
    cacheTimestamp = now
  }
  return cachedSettings
}

export async function isRuntimeEnabled(runtime: string): Promise<boolean> {
  if (!isKnownRuntime(runtime)) return false
  if (runtime === getDefaultAgentRuntime()) return true
  const settings = await getSettings()
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
  let runtime = requestedRuntime || fallback
  if (runtime === 'browser-qa') {
    runtime = fallback
  }
  if (await isRuntimeEnabled(runtime)) {
    return runtime
  }
  return fallback
}

export async function getRuntimeSettings(): Promise<AgentRuntimeSetting[]> {
  const settings = await getSettings()
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
  const settings = await getSettings()
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

  const nextSettings: AgentRuntimeSettingsValue = { disabled: [...disabled] }
  await saveSettingsToDb(nextSettings)
  cachedSettings = nextSettings
  cacheTimestamp = Date.now()

  return getRuntimeSettings()
}
