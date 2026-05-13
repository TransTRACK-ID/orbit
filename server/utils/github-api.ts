import { exec } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'

const execAsync = promisify(exec)

function parseGithubUrl(url: string): { host: string; owner: string; repo: string; number: number; isEnterprise: boolean } | null {
  const enterpriseMatch = url.match(/^(https?:\/\/[^\/]+)\/([^/]+)\/([^/]+?)(\/pull|\/issues)\/(\d+)/i)
  if (enterpriseMatch) {
    const host = enterpriseMatch[1]
    if (!host.includes('github.com')) {
      return { host, owner: enterpriseMatch[2], repo: enterpriseMatch[3].replace(/\.git$/, ''), number: parseInt(enterpriseMatch[5], 10), isEnterprise: true }
    }
  }
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(\/pull|\/issues)\/(\d+)/i)
  if (!match) return null
  return { host: 'https://github.com', owner: match[1], repo: match[2].replace(/\.git$/, ''), number: parseInt(match[4], 10), isEnterprise: false }
}

export function parseGitlabUrl(url: string): { host: string; projectPath: string; iid: number } | null {
  const match = url.match(/^(https?:\/\/[^\/]+)\/(.+?)\/\-\/merge_requests\/(\d+)/i)
  if (match) return { host: match[1], projectPath: match[2], iid: parseInt(match[3], 10) }
  return null
}

export { parseGithubUrl }

export async function githubApiGet(path: string, host: string, isEnterprise: boolean, token?: string) {
  const base = isEnterprise ? `${host}/api/v3` : 'https://api.github.com'
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'orbit-app',
  }

  // Only use the explicitly provided repository token — no env fallback
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

export async function fetchPullRequestDetails(owner: string, repo: string, number: number, host: string, isEnterprise: boolean, token?: string) {
  const pr: any = await githubApiGet(`/repos/${owner}/${repo}/pulls/${number}`, host, isEnterprise, token)
  return {
    githubNumber: pr.number,
    title: pr.title || '',
    url: pr.html_url || '',
    status: pr.state || 'open',
    draft: pr.draft || false,
    mergeableState: pr.mergeable_state || null,
    headBranch: pr.head?.ref || null,
    baseBranch: pr.base?.ref || null,
    createdAt: pr.created_at ? new Date(pr.created_at) : new Date(),
    updatedAt: pr.updated_at ? new Date(pr.updated_at) : new Date(),
  }
}

export async function fetchPullRequestReviews(owner: string, repo: string, number: number, host: string, isEnterprise: boolean, token?: string): Promise<any[]> {
  return githubApiGet(`/repos/${owner}/${repo}/pulls/${number}/reviews`, host, isEnterprise, token)
}

export async function fetchPullRequestComments(owner: string, repo: string, number: number, host: string, isEnterprise: boolean, token?: string): Promise<any[]> {
  return githubApiGet(`/repos/${owner}/${repo}/pulls/${number}/comments`, host, isEnterprise, token)
}

export async function fetchIssueComments(owner: string, repo: string, number: number, host: string, isEnterprise: boolean, token?: string): Promise<any[]> {
  return githubApiGet(`/repos/${owner}/${repo}/issues/${number}/comments`, host, isEnterprise, token)
}

export async function listRepositoryPulls(owner: string, repo: string, host: string, isEnterprise: boolean, token?: string, state = 'open'): Promise<any[]> {
  return githubApiGet(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`, host, isEnterprise, token)
}

// ─── GitLab API ───

export async function gitlabApiGet(path: string, host: string, token?: string) {
  const url = `${host}/api/v4${path}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'orbit-app',
  }
  if (token) headers['PRIVATE-TOKEN'] = token
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

export async function fetchGitlabMergeRequestDetails(projectPath: string, iid: number, host: string, token?: string) {
  const encodedPath = encodeURIComponent(projectPath)
  const mr: any = await gitlabApiGet(`/projects/${encodedPath}/merge_requests/${iid}`, host, token)
  return {
    githubNumber: mr.iid,
    title: mr.title || '',
    url: mr.web_url || '',
    status: mr.state === 'opened' ? 'open' : mr.state || 'open',
    draft: mr.draft || false,
    mergeableState: mr.detailed_merge_status || mr.merge_status || null,
    headBranch: mr.source_branch || null,
    baseBranch: mr.target_branch || null,
    createdAt: mr.created_at ? new Date(mr.created_at) : new Date(),
    updatedAt: mr.updated_at ? new Date(mr.updated_at) : new Date(),
  }
}

export async function fetchGitlabMergeRequestNotes(projectPath: string, iid: number, host: string, token?: string): Promise<any[]> {
  const encodedPath = encodeURIComponent(projectPath)
  return gitlabApiGet(`/projects/${encodedPath}/merge_requests/${iid}/notes`, host, token)
}

export function determineReviewState(reviews: any[]): 'pending' | 'approved' | 'changes_requested' | 'commented' {
  if (reviews.length === 0) return 'pending'
  const states = reviews.map((r: any) => r.state?.toLowerCase())
  if (states.includes('changes_requested')) return 'changes_requested'
  if (states.includes('approved')) return 'approved'
  return 'commented'
}

const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

function sanitizeDirName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^-+|-+$/g, '')
    || 'repo'
}

export function resolveCloneDir(projectsDir: string, repoUrl: string, repoName?: string | null): string {
  const urlName = sanitizeDirName(extractRepoName(repoUrl))
  const displayName = repoName ? sanitizeDirName(repoName) : null
  const rawDisplayName = repoName ? repoName.trim() : null

  if (rawDisplayName) {
    const rawDisplayDir = `${projectsDir}/${rawDisplayName}`
    if (existsSync(rawDisplayDir)) return rawDisplayDir
  }

  if (displayName) {
    const displayDir = `${projectsDir}/${displayName}`
    if (existsSync(displayDir)) return displayDir
  }

  return `${projectsDir}/${urlName}`
}

export async function getGitDiff(repoDir: string, baseBranch: string, headBranch: string): Promise<{ files: { path: string; additions: number; deletions: number }[]; totalAdditions: number; totalDeletions: number; rawDiff: string }> {
  try {
    const { stdout: diffStat } = await execAsync(`git diff --stat ${baseBranch}...${headBranch}`, { cwd: repoDir })
    const { stdout: diffOutput } = await execAsync(`git diff ${baseBranch}...${headBranch}`, { cwd: repoDir })

    const files: { path: string; additions: number; deletions: number }[] = []
    let totalAdditions = 0
    let totalDeletions = 0

    for (const line of diffStat.split('\n')) {
      const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([\-+]+)$/)
      if (match) {
        const path = match[1].trim()
        const adds = (match[3].match(/\+/g) || []).length
        const dels = (match[3].match(/-/g) || []).length
        files.push({ path, additions: adds, deletions: dels })
        totalAdditions += adds
        totalDeletions += dels
      }
    }

    return { files, totalAdditions, totalDeletions, rawDiff: diffOutput }
  } catch {
    return { files: [], totalAdditions: 0, totalDeletions: 0, rawDiff: '' }
  }
}
