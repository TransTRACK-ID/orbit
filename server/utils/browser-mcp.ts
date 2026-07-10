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

export function setupBrowserMcp(workDir: string, runtime: string, taskUrls: string[] = []): BrowserMcpSetup {
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
    setupCursorBrowserRules(workDir, taskUrls)
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

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi

export function extractUrlsFromText(...texts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(URL_RE)) {
      const url = match[0].replace(/[.,;:!?)]+$/, '')
      if (!seen.has(url)) {
        seen.add(url)
        urls.push(url)
      }
    }
  }
  return urls
}

export function setupCursorBrowserRules(workDir: string, taskUrls: string[] = []) {
  const rulesDir = path.join(workDir, '.cursor', 'rules')
  mkdirSync(rulesDir, { recursive: true })
  const urlLine = taskUrls.length > 0
    ? `\nTest these URLs: ${taskUrls.join(', ')}`
    : ''
  writeFileSync(
    path.join(rulesDir, 'browser-testing.mdc'),
    `---
description: Mandatory Chrome DevTools MCP browser testing
alwaysApply: true
---

# Browser testing required

Chrome DevTools MCP (chrome-devtools) is enabled for this run.${urlLine}

Before finishing any QA, login, or UI verification task you MUST:

1. Call **navigate_page** or **new_page** to open the target site
2. Call **take_snapshot** and use element **uid** values from the snapshot
3. Use **fill**, **click**, and **press_key** for interactions
4. Capture the final state with **take_snapshot** or **take_screenshot**

Tool names are prefixed as \`mcp_chrome-devtools_*\` in Cursor (e.g. \`mcp_chrome-devtools_navigate_page\`).

Never report browser test results without using these MCP tools in this run.
Never substitute curl, wget, fetch, or HTTP-only checks for real UI testing.
`,
  )
}

export function buildBrowserContextBlock(previewUrl: string | null, taskUrls: string[] = []): string {
  const targets = [...taskUrls]
  if (previewUrl && !targets.includes(previewUrl)) {
    targets.unshift(previewUrl)
  }

  const targetBlock = targets.length > 0
    ? `Target URL(s) to test:\n${targets.map(u => `- ${u}`).join('\n')}\n`
    : 'Extract target URL(s) from the task title and description.\n'

  const workflow = [
    'MANDATORY: Browser is enabled. You MUST use Chrome DevTools MCP before reporting any test results.',
    'Required workflow (do not skip):',
    '1. navigate_page or new_page → open the target URL',
    '2. take_snapshot → inspect the page and note element uids',
    '3. fill / click / press_key → perform login or UI actions',
    '4. take_snapshot or take_screenshot → capture evidence of the outcome',
    'In Cursor, tools appear as mcp_chrome-devtools_navigate_page, mcp_chrome-devtools_take_snapshot, etc.',
    'Do NOT use curl, wget, fetch, or shell HTTP checks instead of Chrome DevTools MCP.',
    'Do NOT claim you tested a website unless MCP tools were called in this session.',
    'Summarize what you observed from snapshots (visible text, errors, login success/failure).',
  ].join('\n')

  if (previewUrl) {
    return `\n\n[BROWSER — MANDATORY]\nA preview is available at ${previewUrl}.\n${targetBlock}\n${workflow}\n`
  }
  return `\n\n[BROWSER — MANDATORY]\n${targetBlock}\n${workflow}\n`
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

/** Verify chrome-devtools tools are loadable before spawning the agent. */
export function verifyCursorBrowserMcpTools(workDir: string): { ok: boolean; toolCount: number; message: string } {
  const cursorPath = process.env.CURSOR_AGENT_PATH || 'cursor-agent'
  const result = spawnSync(cursorPath, ['mcp', 'list-tools', MCP_SERVER_ID], {
    cwd: workDir,
    encoding: 'utf-8',
    timeout: 120_000,
    env: { ...process.env },
  })
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  const match = output.match(/Tools for chrome-devtools \((\d+)\)/)
  const toolCount = match ? Number.parseInt(match[1]!, 10) : 0
  if (toolCount > 0) {
    return { ok: true, toolCount, message: `${toolCount} Chrome DevTools MCP tools available` }
  }
  return { ok: false, toolCount: 0, message: output || 'Failed to list Chrome DevTools MCP tools' }
}

const BROWSER_MCP_TOOL_HINTS = [
  'chrome-devtools',
  'chrome_devtools',
  'mcp_chrome-devtools',
  'mcp_chrome_devtools',
  'navigate_page',
  'new_page',
  'take_screenshot',
  'take_snapshot',
  'list_pages',
  'select_page',
  'close_page',
  'click',
  'fill',
  'fill_form',
  'hover',
  'press_key',
  'type_text',
  'wait_for',
  'upload_file',
  'handle_dialog',
  'list_console_messages',
  'list_network_requests',
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
