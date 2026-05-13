/**
 * Shared git helpers used across multiple API endpoints.
 * Extracted to avoid duplication between execute.get.ts, pr.post.ts, and brainstorm chat.
 */

export function injectTokenIntoRemoteUrl(url: string, platform: string, token?: string | null): string {
  if (!token) return url

  if (platform === 'github') {
    if (!url.startsWith('https://github.com/')) return url
    return url.replace(/^https:\/\/github\.com\//, `https://${token}@github.com/`)
  }

  // GitLab — self-hosted or gitlab.com
  if (!url.startsWith('https://')) return url
  return url.replace(/^https:\/\//, `https://oauth2:${token}@`)
}

const projectsDir = `${process.env.HOME || '/root'}/orbit-projects`

export function getCloneDir(repoUrl: string, repoName?: string): string {
  const name = repoName || repoUrl.split('/').pop()?.replace('.git', '') || 'repo'
  return `${projectsDir}/${name}`
}
