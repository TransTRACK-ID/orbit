/**
 * Shared git helpers used across multiple API endpoints.
 * Extracted to avoid duplication between execute.get.ts, pr.post.ts, and brainstorm chat.
 */

export function injectTokenIntoRemoteUrl(url: string, platform: string, token?: string | null): string {
  if (!token) return url

  if (platform === 'github') {
    if (!url.startsWith('https://github.com/')) return url
    // Fine-grained PATs (github_pat_...) require a username in the URL.
    // Classic PATs (ghp_...) also work with oauth2 as username.
    // Using "oauth2:<token>" works reliably for both token types.
    return url.replace(/^https:\/\/github\.com\//, `https://oauth2:${token}@github.com/`)
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
