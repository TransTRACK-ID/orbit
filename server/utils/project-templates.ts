import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile, cp, mkdir, rename, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { injectTokenIntoRemoteUrl } from './git-helpers'

const execAsync = promisify(exec)
const projectsDir = `${process.env.HOME || '/root'}/orbit-projects`

/**
 * Resolve the project root directory by checking multiple strategies.
 * Works in:
 *   - Local dev (process.cwd() is project root)
 *   - Docker production (process.cwd() is /app, files copied to /app/server/)
 *   - Vercel/serverless (process.cwd() may be .output/server/, falls back to import.meta.url)
 */
function resolveProjectRoot(): string {
  // Strategy 1: process.cwd() (works in local dev and Docker where WORKDIR=/app)
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'server/data/templates.json'))) {
    return cwd
  }

  // Strategy 2: relative to current file (works in production builds where code is bundled)
  try {
    const currentFileDir = dirname(fileURLToPath(import.meta.url))

    // From server/utils/ → project root (dev)
    const devRoot = join(currentFileDir, '../..')
    if (existsSync(join(devRoot, 'server/data/templates.json'))) {
      return devRoot
    }

    // From .output/server/ or deeper → .output/ (production build)
    const prodRoot = join(currentFileDir, '..')
    if (existsSync(join(prodRoot, 'server/data/templates.json'))) {
      return prodRoot
    }

    // From .output/server/chunks/nitro/ → .output/ (deep nested production build)
    const deepProdRoot = join(currentFileDir, '../..')
    if (existsSync(join(deepProdRoot, 'server/data/templates.json'))) {
      return deepProdRoot
    }
  } catch {
    // import.meta.url may not be available in some environments
  }

  // Fallback: assume process.cwd() even if file doesn't exist yet
  return cwd
}

const projectRoot = resolveProjectRoot()
const templatesFilePath = join(projectRoot, 'server/data/templates.json')

let cachedTemplates: TemplateConfig[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5000 // 5 seconds

async function loadTemplates(): Promise<TemplateConfig[]> {
  try {
    const data = await readFile(templatesFilePath, 'utf-8')
    return JSON.parse(data) as TemplateConfig[]
  } catch {
    return []
  }
}

export async function getTemplates(): Promise<TemplateConfig[]> {
  const now = Date.now()
  if (!cachedTemplates || now - cacheTimestamp > CACHE_TTL_MS) {
    cachedTemplates = await loadTemplates()
    cacheTimestamp = now
  }
  return cachedTemplates
}

export async function saveTemplates(templates: TemplateConfig[]) {
  await writeFile(templatesFilePath, JSON.stringify(templates, null, 2) + '\n', 'utf-8')
  cachedTemplates = templates
  cacheTimestamp = Date.now()
}

export interface TemplateConfig {
  id: string
  name: string
  description: string
  category: string
  stack: string
  sourceType: 'local_path' | 'git' | 'npx' | 'command'
  sourcePath: string
  branch?: string
  variables: Array<{
    key: string
    label: string
    required: boolean
    default?: string
    autoGenerate?: boolean
    length?: number
  }>
  fileSubstitutions: Array<{
    path: string
    replacements: Record<string, string>
  }>
  renameFiles?: Array<{ from: string; to: string }>
  postInitCommands: Array<{
    command: string
    timeout?: number
    description: string
  }>
  gitInit: boolean
  initialCommitMessage: string
}

export async function getTemplateById(id: string): Promise<TemplateConfig | undefined> {
  const templates = await getTemplates()
  return templates.find(t => t.id === id)
}

export async function listTemplates() {
  const templates = await getTemplates()
  return templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    stack: t.stack,
    variables: t.variables,
  }))
}

export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('')
}

export function resolveVariables(template: TemplateConfig, userInputs: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {}

  for (const variable of template.variables) {
    if (userInputs[variable.key]) {
      resolved[variable.key] = userInputs[variable.key]
    } else if (variable.autoGenerate && variable.length) {
      resolved[variable.key] = generateRandomString(variable.length)
    } else if (variable.default) {
      resolved[variable.key] = variable.default
    } else if (variable.required) {
      throw new Error(`Missing required variable: ${variable.key}`)
    }
  }

  return resolved
}

export async function substituteFile(targetDir: string, filePath: string, variables: Record<string, string>) {
  const fullPath = `${targetDir}/${filePath}`
  if (!existsSync(fullPath)) return

  let content = await readFile(fullPath, 'utf-8')

  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  await writeFile(fullPath, content)
}

export async function removeProjectDirectory(repoName: string): Promise<void> {
  const targetDir = `${projectsDir}/${repoName}`
  if (existsSync(targetDir)) {
    await rm(targetDir, { recursive: true, force: true })
  }
}

export async function initializeFromTemplate(
  templateId: string,
  projectName: string,
  repoName: string,
  userInputs: Record<string, string>,
  remoteUrl?: string,
  token?: string,
  platform?: string
): Promise<{ targetDir: string; remoteUrl?: string }> {
  const template = await getTemplateById(templateId)
  if (!template) throw createError({ statusCode: 400, message: `Template not found: ${templateId}` })

  // Resolve target directory
  const targetDir = `${projectsDir}/${repoName}`
  if (existsSync(targetDir)) {
    throw createError({ statusCode: 409, message: `Directory already exists: ${targetDir}. Remove the existing directory or use a different repository name.` })
  }

  await mkdir(targetDir, { recursive: true })

  // Copy template
  const templatePath = join(projectRoot, template.sourcePath)
  await cp(templatePath, targetDir, {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.includes('.git') && !src.includes('vendor') && !src.includes('build') && !src.includes('dist') && !src.includes('.nuxt'),
  })

  // Resolve variables
  const variables = resolveVariables(template, userInputs)

  // Substitute files
  for (const sub of template.fileSubstitutions) {
    await substituteFile(targetDir, sub.path, variables)
  }

  // Rename files
  if (template.renameFiles) {
    for (const { from, to } of template.renameFiles) {
      await rename(`${targetDir}/${from}`, `${targetDir}/${to}`)
    }
  }

  const execOptions = { cwd: targetDir, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer

  // Run post-init commands
  for (const cmd of template.postInitCommands) {
    await execAsync(cmd.command, {
      ...execOptions,
      timeout: cmd.timeout || 120000,
      env: { ...process.env, FORCE_COLOR: '0' }, // Prevent ANSI color codes in logs
    })
  }

  // Git init
  if (template.gitInit) {
    await execAsync('git init', execOptions)
    await execAsync('git config user.email "orbit@transtrack.ai"', execOptions)
    await execAsync('git config user.name "Orbit"', execOptions)
    await execAsync('git add -A', execOptions)
    await execAsync(`git commit -m "${template.initialCommitMessage}"`, execOptions)

    if (remoteUrl) {
      const authUrl = token && platform ? injectTokenIntoRemoteUrl(remoteUrl, platform, token) : remoteUrl
      await execAsync(`git remote add origin ${authUrl}`, execOptions)
      await execAsync(`git branch -M ${template.branch || 'main'}`, execOptions)
      await execAsync('git push -u origin main', execOptions)
    }
  }

  return { targetDir, remoteUrl }
}
