import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'

export type BrowserMcpSetup = {
  opencodeConfigPath?: string
  cursorMcpConfigPath?: string
}

export const MCP_SERVER_ID = 'chrome-devtools'

function getNpxPath(): string {
  return process.env.NPX_PATH || 'npx'
}

function getMcpProcessEnv(): Record<string, string> {
  return {
    CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1',
    ...(process.env.CHROME_PATH ? { CHROME_PATH: process.env.CHROME_PATH } : {}),
  }
}

/** Resolve chrome-devtools-mcp command + args (Docker uses pre-installed global binary). */
export function getChromeDevToolsMcpLaunch(): { command: string; args: string[] } {
  const args = ['--headless', '--isolated=true']
  const chromePath = process.env.CHROME_PATH || process.env.CHROME_EXECUTABLE_PATH
  if (chromePath) {
    args.push(`--executablePath=${chromePath}`)
    // Required for Chromium inside Docker containers
    args.push(
      '--chromeArg=--no-sandbox',
      '--chromeArg=--disable-setuid-sandbox',
      '--chromeArg=--disable-dev-shm-usage',
    )
  }

  const bin = process.env.CHROME_DEVTOOLS_MCP_BIN
  if (bin) {
    return { command: bin, args }
  }

  return {
    command: getNpxPath(),
    args: ['-y', 'chrome-devtools-mcp@latest', ...args],
  }
}

export function ensureOrbitGitignore(workDir: string) {
  const gitignorePath = path.join(workDir, '.gitignore')
  const entry = '.orbit/\n'
  try {
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8')
      if (!content.includes('.orbit/')) {
        appendFileSync(gitignorePath, `\n${entry}`)
      }
    } else if (existsSync(path.join(workDir, '.git'))) {
      writeFileSync(gitignorePath, entry)
    }
  } catch {
    // Non-fatal
  }
}

export function setupBrowserMcp(workDir: string, runtime: string): BrowserMcpSetup {
  const orbitDir = path.join(workDir, '.orbit')
  mkdirSync(orbitDir, { recursive: true })
  ensureOrbitGitignore(workDir)

  const { command, args } = getChromeDevToolsMcpLaunch()
  const mcpEnv = getMcpProcessEnv()

  if (runtime === 'cursor') {
    const cursorDir = path.join(workDir, '.cursor')
    mkdirSync(cursorDir, { recursive: true })
    const cursorMcpConfigPath = path.join(cursorDir, 'mcp.json')
    writeFileSync(
      cursorMcpConfigPath,
      JSON.stringify({
        mcpServers: {
          [MCP_SERVER_ID]: {
            command,
            args,
            env: mcpEnv,
          },
        },
      }, null, 2),
    )
    return { cursorMcpConfigPath }
  }

  const configPath = path.join(orbitDir, 'opencode.json')
  writeFileSync(
    configPath,
    JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        [MCP_SERVER_ID]: {
          type: 'local',
          command: [command, ...args],
          enabled: true,
          environment: mcpEnv,
        },
      },
    }, null, 2),
  )
  return { opencodeConfigPath: configPath }
}

export function buildBrowserContextBlock(previewUrl: string | null): string {
  const rules = [
    'You MUST use Chrome DevTools MCP tools (server: chrome-devtools) for any web login, UI verification, or browser testing.',
    'Do NOT claim you tested a website unless you called chrome-devtools MCP tools in this run.',
    'Do NOT substitute curl, fetch, or shell scripts for real browser interaction when the task requires UI testing.',
    'Summarize what you observed from MCP tool results (page snapshots, network, console).',
  ].join('\n')

  if (previewUrl) {
    return `\n\n[BROWSER]\nA preview is available at ${previewUrl}.\n${rules}\n`
  }
  return `\n\n[BROWSER]\n${rules}\nNavigate to URLs mentioned in the task. Start a preview manually only if you need to test a local build.\n`
}

/** Approve chrome-devtools in cursor-agent so --approve-mcps can load it for this workspace. */
export function ensureCursorBrowserMcpApproved(workDir: string): { ok: boolean; message: string } {
  const cursorPath = process.env.CURSOR_AGENT_PATH || 'cursor-agent'
  const result = spawnSync(cursorPath, ['mcp', 'enable', MCP_SERVER_ID], {
    cwd: workDir,
    encoding: 'utf-8',
    timeout: 30_000,
    env: { ...process.env },
  })
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  if (result.status !== 0) {
    return { ok: false, message: output || 'cursor-agent mcp enable failed' }
  }
  return { ok: true, message: output || `Approved MCP server: ${MCP_SERVER_ID}` }
}

const BROWSER_MCP_TOOL_HINTS = [
  'chrome-devtools',
  'chrome_devtools',
  'navigate_page',
  'take_screenshot',
  'take_snapshot',
  'list_pages',
  'new_page',
  'click',
  'fill',
  'fill_form',
  'hover',
  'press_key',
  'wait_for',
]

export function isBrowserMcpTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase()
  return BROWSER_MCP_TOOL_HINTS.some((hint) => normalized.includes(hint))
}

export function buildNoRepositoryBlock(): string {
  return `\n\n[NO REPOSITORY]\nThis agent is not bound to a repository worktree. Work from the task title and description only. You may browse external URLs mentioned in the task.\n`
}

export function resolvePreviewUrlForAgent(instanceId: string): string {
  const port = process.env.PORT || '3000'
  const host = process.env.HOST === '0.0.0.0' ? 'localhost' : (process.env.HOST || 'localhost')
  return `http://${host}:${port}/api/preview/${instanceId}`
}
