import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export type BrowserMcpSetup = {
  opencodeConfigPath?: string
}

const MCP_SERVER_ID = 'chrome-devtools'

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
    writeFileSync(
      path.join(cursorDir, 'mcp.json'),
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
    return {}
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
  if (previewUrl) {
    return `\n\n[BROWSER]\nA preview is available at ${previewUrl}.\nYou have Chrome DevTools MCP tools available (headless). Use them when the task requires interacting with the app. Summarize what you observed.\n`
  }
  return `\n\n[BROWSER]\nYou have Chrome DevTools MCP tools available (headless). Start a preview manually if you need to test a local build, or navigate to URLs specified in the task. Summarize what you observed.\n`
}

export function buildNoRepositoryBlock(): string {
  return `\n\n[NO REPOSITORY]\nThis agent is not bound to a repository worktree. Work from the task title and description only. You may browse external URLs mentioned in the task.\n`
}

export function resolvePreviewUrlForAgent(instanceId: string): string {
  const port = process.env.PORT || '3000'
  const host = process.env.HOST === '0.0.0.0' ? 'localhost' : (process.env.HOST || 'localhost')
  return `http://${host}:${port}/api/preview/${instanceId}`
}
