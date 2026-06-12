import { homedir } from 'os'

/** Resolve the user's home directory with a safe fallback for containers. */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir() || '/root'
}

/** Directory where agent worktrees and repository clones are stored. */
export function getProjectsDir(): string {
  return process.env.ORBIT_PROJECTS_DIR || `${getHomeDir()}/orbit-projects`
}

/** Directory for task and brainstorm file attachments. */
export function getAttachmentsDir(): string {
  return process.env.ORBIT_ATTACHMENTS_DIR || `${getHomeDir()}/orbit-attachments`
}

/** Subdirectory for brainstorm image attachments. */
export function getBrainstormAttachmentsDir(): string {
  return `${getAttachmentsDir()}/brainstorms`
}

/**
 * Host machine home directory when Orbit runs inside Docker but mounts host paths
 * (e.g. browser-agent volume mapping).
 */
export function getHostHome(): string {
  return process.env.HOST_HOME || getHomeDir()
}

/** Path to the OpenCode CLI binary. */
export function getOpencodePath(): string {
  return process.env.OPENCODE_PATH || `${getHomeDir()}/.opencode/bin/opencode`
}
