import { existsSync, readFileSync, readdirSync } from 'fs'

const DEFAULT_PROJECTS_DIR = `${process.env.HOME || '/root'}/orbit-projects`

function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

/** Sanitize a string for safe use as a directory name */
function sanitizeDirName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/[^a-zA-Z0-9._-]/g, '') // remove unsafe chars
    .replace(/^-+|-+$/g, '')        // trim leading/trailing hyphens
    || 'repo'
}

/** Resolve the main repository clone directory (shared across tasks) */
export function resolveCloneDir(repoUrl: string, repoName?: string | null, projectsDir: string = DEFAULT_PROJECTS_DIR): string {
  const urlName = sanitizeDirName(extractRepoName(repoUrl))
  const displayName = repoName ? sanitizeDirName(repoName) : null
  const rawDisplayName = repoName ? repoName.trim() : null

  // Prefer exact display name if directory already exists (preserves existing clones)
  if (rawDisplayName) {
    const rawDisplayDir = `${projectsDir}/${rawDisplayName}`
    if (existsSync(rawDisplayDir)) return rawDisplayDir
  }

  // Try sanitized display name
  if (displayName) {
    const displayDir = `${projectsDir}/${displayName}`
    if (existsSync(displayDir)) return displayDir
  }

  // If repo was renamed in UI, scan existing directories for one with matching remote URL
  try {
    const entries = readdirSync(projectsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const gitConfigPath = `${projectsDir}/${entry.name}/.git/config`
      if (existsSync(gitConfigPath)) {
        const config = readFileSync(gitConfigPath, 'utf-8')
        // Extract the remote URL from config and normalize by stripping auth tokens for comparison
        const urlMatch = config.match(/url\s*=\s*(.+)/)
        const storedUrl = urlMatch ? urlMatch[1].trim() : ''
        const normalize = (u: string) => u.replace(/^https?:\/\/[^@]+@/, 'https://').replace(/\.git$/, '')
        if (storedUrl && normalize(storedUrl) === normalize(repoUrl)) {
          return `${projectsDir}/${entry.name}`
        }
      }
    }
  } catch {}

  // Fall back to URL-derived name
  return `${projectsDir}/${urlName}`
}

/** Resolve the task-specific worktree directory */
export function resolveWorktreeDir(cloneDir: string, taskId: string): string {
  const standardPath = `${cloneDir}/.task-${taskId}`
  if (existsSync(standardPath)) return standardPath

  // Look for suffixed worktrees (e.g. .task-<id>-4lrebp)
  try {
    const entries = readdirSync(cloneDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(`.task-${taskId}`)) {
        return `${cloneDir}/${entry.name}`
      }
    }
  } catch {}

  return standardPath
}

export { DEFAULT_PROJECTS_DIR as projectsDir }
