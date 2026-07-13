import type { ActivityLog } from '~/types'

export type AgentDiagnosticSeverity = 'info' | 'warning' | 'error' | 'success'

export type AgentDiagnosticCode =
  | 'loop_detected'
  | 'loop_limit_reached'
  | 'runtime_timeout'
  | 'agent_crashed'
  | 'agent_error'
  | 'finished_without_status'
  | 'status_changed'
  | 'run_completed'

export interface AgentDiagnosticEntry {
  id: string
  code: AgentDiagnosticCode | string
  title: string
  message: string
  severity: AgentDiagnosticSeverity
  meta?: Record<string, unknown>
  timestamp: number
}

export interface AgentRunInsights {
  headline: string
  severity: AgentDiagnosticSeverity
  hasIssue: boolean
  summary: string
  suggestions: string[]
  diagnostics: AgentDiagnosticEntry[]
  stats: {
    loopRestarts: number
    timeouts: number
    crashes: number
    errors: number
    doneCount: number
    lastDoneAt: number | null
    inReviewOrDone: boolean
    stillInProgress: boolean
  }
}

export interface BuildAgentRunInsightsInput {
  diagnostics: AgentDiagnosticEntry[]
  runtimeMessages?: string[]
  taskStatusName?: string | null
  maxLoopRestarts?: number
}

function parseRuntimeDiagnostic(message: string, timestamp: number, id: string): AgentDiagnosticEntry | null {
  const text = message.replace(/^>\s*/, '').trim()
  if (!text) return null

  const loopMatch = text.match(/Loop detected:\s*"(.+?)"\s+executed\s+(\d+)\s+times/i)
  if (loopMatch) {
    return {
      id,
      code: 'loop_detected',
      title: 'Command loop detected',
      message: `The agent repeated the same command too many times: "${loopMatch[1]}". Orbit restarted it to break the loop.`,
      severity: 'warning',
      meta: { command: loopMatch[1], count: Number(loopMatch[2]) },
      timestamp,
    }
  }

  if (/Loop restart limit/i.test(text)) {
    const moved = /moved to "([^"]+)"/i.exec(text)
    return {
      id,
      code: 'loop_limit_reached',
      title: 'Auto-restart limit reached',
      message: moved
        ? `Orbit stopped auto-restarting and moved this task to ${moved[1]} for manual review.`
        : 'Orbit stopped auto-restarting after repeated command loops.',
      severity: 'warning',
      timestamp,
    }
  }

  if (/Runtime timeout reached/i.test(text) || /timed out after 15 minutes/i.test(text)) {
    return {
      id,
      code: 'runtime_timeout',
      title: '15-minute time limit hit',
      message: 'The agent ran longer than 15 minutes in one session and was stopped. It may need a narrower task or a manual continue.',
      severity: 'warning',
      timestamp,
    }
  }

  if (/Agent will auto-restart after loop detection/i.test(text)) {
    const countMatch = text.match(/\((\d+)\/(\d+)\)/)
    return {
      id,
      code: 'loop_detected',
      title: 'Restarting after loop',
      message: countMatch
        ? `Orbit is restarting the agent (attempt ${countMatch[1]} of ${countMatch[2]}).`
        : 'Orbit is restarting the agent after detecting a command loop.',
      severity: 'info',
      meta: countMatch ? { restartCount: Number(countMatch[1]), maxRestarts: Number(countMatch[2]) } : undefined,
      timestamp,
    }
  }

  if (/^Done$/i.test(text)) {
    return {
      id,
      code: 'run_completed',
      title: 'Agent session finished',
      message: 'The agent process exited successfully. The task status only changes when the agent emits [ORBIT_STATUS: review] (or another status).',
      severity: 'success',
      timestamp,
    }
  }

  if (/Agent crashed/i.test(text) || /Agent exited with error/i.test(text)) {
    return {
      id,
      code: 'agent_error',
      title: 'Agent run ended unexpectedly',
      message: text.length > 160 ? `${text.slice(0, 160)}…` : text,
      severity: 'error',
      timestamp,
    }
  }

  return null
}

export function diagnosticFromActivityLog(log: {
  id: string
  action: string
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  createdAt: string | Date
}): AgentDiagnosticEntry | null {
  const ts = new Date(log.createdAt).getTime()
  const id = `activity-${log.id}`

  if (log.action === 'agent_diagnostic' && log.newValue) {
    return {
      id,
      code: String(log.newValue.code || 'agent_diagnostic'),
      title: String(log.newValue.title || 'Agent note'),
      message: String(log.newValue.message || ''),
      severity: (log.newValue.severity as AgentDiagnosticSeverity) || 'info',
      meta: log.newValue.meta as Record<string, unknown> | undefined,
      timestamp: ts,
    }
  }

  if (log.action === 'agent_crash' || log.action === 'agent_timeout' || log.action === 'agent_error') {
    const message = String(log.newValue?.message || 'The agent stopped unexpectedly.')
    return {
      id,
      code: log.action === 'agent_timeout' ? 'runtime_timeout' : log.action === 'agent_crash' ? 'agent_crashed' : 'agent_error',
      title: log.action === 'agent_timeout'
        ? '15-minute time limit hit'
        : log.action === 'agent_crash'
          ? 'Agent crashed'
          : 'Agent error',
      message,
      severity: 'error',
      meta: {
        type: log.newValue?.type,
        exitCode: log.newValue?.exitCode,
        signal: log.newValue?.signal,
      },
      timestamp: ts,
    }
  }

  if (log.action === 'status_change' && log.newValue?.statusName) {
    return {
      id,
      code: 'status_changed',
      title: 'Task status updated',
      message: `Moved from "${log.oldValue?.statusName || '?'}" to "${log.newValue.statusName}".`,
      severity: 'success',
      meta: { from: log.oldValue?.statusName, to: log.newValue.statusName },
      timestamp: ts,
    }
  }

  if (log.action === 'runtime_log' && log.newValue?.message) {
    return parseRuntimeDiagnostic(String(log.newValue.message), ts, id)
  }

  return null
}

function activityToDiagnostic(log: ActivityLog): AgentDiagnosticEntry | null {
  return diagnosticFromActivityLog({
    id: log.id,
    action: log.action,
    oldValue: log.oldValue as Record<string, unknown> | null,
    newValue: log.newValue as Record<string, unknown> | null,
    createdAt: log.createdAt,
  })
}

export function buildAgentRunInsights(input: BuildAgentRunInsightsInput): AgentRunInsights {
  const maxRestarts = input.maxLoopRestarts ?? 3
  const stillInProgress = !!input.taskStatusName && /progress/i.test(input.taskStatusName)
  const inReviewOrDone = !!input.taskStatusName && /review|done/i.test(input.taskStatusName)

  const fromRuntime = (input.runtimeMessages || [])
    .map((msg, i) => parseRuntimeDiagnostic(msg, Date.now() - i, `runtime-${i}`))
    .filter((d): d is AgentDiagnosticEntry => !!d)

  const merged = [...input.diagnostics, ...fromRuntime]
    .sort((a, b) => b.timestamp - a.timestamp)

  // De-dupe near-identical entries within 5s
  const diagnostics: AgentDiagnosticEntry[] = []
  for (const entry of merged) {
    const dup = diagnostics.find(d =>
      d.code === entry.code &&
      Math.abs(d.timestamp - entry.timestamp) < 5000 &&
      d.title === entry.title,
    )
    if (!dup) diagnostics.push(entry)
  }

  const loopRestarts = diagnostics.filter(d =>
    d.code === 'loop_detected' || d.code === 'loop_limit_reached',
  ).length
  const timeouts = diagnostics.filter(d => d.code === 'runtime_timeout').length
  const crashes = diagnostics.filter(d => d.code === 'agent_crashed').length
  const errors = diagnostics.filter(d => d.code === 'agent_error').length
  const doneEntries = diagnostics.filter(d => d.code === 'run_completed')
  const doneCount = doneEntries.length
  const lastDoneAt = doneEntries[0]?.timestamp ?? null

  let headline = 'No agent issues detected yet'
  let severity: AgentDiagnosticSeverity = 'info'
  let summary = 'The agent has not reported any problems. If it is running, check the live log below.'
  const suggestions: string[] = []

  const latest = diagnostics[0]
  if (latest?.code === 'loop_limit_reached') {
    headline = 'Agent kept looping — moved to Review'
    severity = 'warning'
    summary = 'The agent hit the auto-restart limit while repeating commands and never finished cleanly. Orbit moved the task to Review so you can verify the work.'
    suggestions.push('Open the branch or PR and confirm whether the changes are already done.')
    suggestions.push('If work is incomplete, move back to In Progress and give the agent a shorter, specific instruction.')
  } else if (loopRestarts > 0 && stillInProgress) {
    headline = 'Agent is stuck in a command loop'
    severity = 'warning'
    summary = `The agent has been auto-restarted ${loopRestarts} time(s) because it kept running the same commands. It has not updated the task status yet.`
    suggestions.push('Stop the agent and add a comment with a clearer next step (e.g. "only verify login theme, then emit [ORBIT_STATUS: review]").')
    suggestions.push(`After ${maxRestarts} restarts, Orbit will move this task to Review automatically.`)
  } else if (timeouts > 0 && stillInProgress) {
    headline = 'Agent keeps timing out'
    severity = 'warning'
    summary = 'The agent exceeded the 15-minute session limit before finishing. Large browser QA or dev-server tasks often need multiple runs.'
    suggestions.push('Split the task into smaller steps or ask the agent to finish with [ORBIT_STATUS: review] once verification is done.')
    suggestions.push('Use Stop, then Run again to continue from the existing worktree.')
  } else if (crashes > 0 || errors > 0) {
    headline = 'Agent runs are failing'
    severity = 'error'
    summary = latest?.message || 'Recent agent sessions ended with errors.'
    suggestions.push('Try Restart Agent. If it keeps failing, check server memory and preview/browser setup.')
  } else if (doneCount > 0 && stillInProgress) {
    headline = 'Agent said Done but status unchanged'
    severity = 'warning'
    summary = 'The agent finished a session successfully but did not emit [ORBIT_STATUS: review] (or another status). The card stays In Progress until the agent updates status.'
    suggestions.push('Ask the agent in a comment to emit [ORBIT_STATUS: review] if the work is complete.')
    suggestions.push('Or move the task to Review manually if you have verified the changes.')
  } else if (inReviewOrDone && doneCount > 0) {
    headline = 'Agent completed its last session'
    severity = 'success'
    summary = 'The most recent agent run finished successfully and the task has left In Progress.'
  } else if (latest) {
    headline = latest.title
    severity = latest.severity
    summary = latest.message
  }

  if (suggestions.length === 0 && stillInProgress && (severity === 'warning' || severity === 'error')) {
    suggestions.push('When work is done, the agent should emit [ORBIT_STATUS: review] to move this card.')
  }

  const hasIssue = severity === 'warning' || severity === 'error'

  return {
    headline,
    severity,
    hasIssue,
    summary,
    suggestions,
    diagnostics: diagnostics.slice(0, 12),
    stats: {
      loopRestarts,
      timeouts,
      crashes,
      errors,
      doneCount,
      lastDoneAt,
      inReviewOrDone,
      stillInProgress,
    },
  }
}

export function agentRunHasIssue(insights: AgentRunInsights | null | undefined): boolean {
  return !!insights?.hasIssue
}

export type AgentRunInsightsCopyLogLine = {
  displayTime?: string
  message: string
}

export function formatAgentRunInsightsForCopy(
  insights: AgentRunInsights,
  opts?: {
    taskTitle?: string | null
    runtimeLogs?: AgentRunInsightsCopyLogLine[]
    maxLogLines?: number
  },
): string {
  const maxLogLines = opts?.maxLogLines ?? 40
  const lines: string[] = [
    '## Agent run diagnostics',
    '',
  ]

  if (opts?.taskTitle?.trim()) {
    lines.push(`Task: ${opts.taskTitle.trim()}`, '')
  }

  lines.push(
    `Issue: ${insights.headline}`,
    `Severity: ${insights.severity}`,
    '',
    '### Summary',
    insights.summary,
    '',
  )

  const stats = insights.stats
  const statParts: string[] = []
  if (stats.loopRestarts) statParts.push(`${stats.loopRestarts} loop event(s)`)
  if (stats.timeouts) statParts.push(`${stats.timeouts} timeout(s)`)
  const failures = stats.errors + stats.crashes
  if (failures) statParts.push(`${failures} failed run(s)`)
  if (stats.doneCount && stats.stillInProgress) {
    statParts.push(`${stats.doneCount} finished session(s) without status change`)
  }
  if (statParts.length) {
    lines.push('### Stats', statParts.join(', '), '')
  }

  if (insights.suggestions.length) {
    lines.push('### Suggested next steps')
    for (const [i, tip] of insights.suggestions.entries()) {
      lines.push(`${i + 1}. ${tip}`)
    }
    lines.push('')
  }

  if (insights.diagnostics.length) {
    lines.push('### Recent events')
    for (const item of insights.diagnostics.slice(0, 12)) {
      const when = new Date(item.timestamp).toISOString()
      lines.push(`- [${item.code}] ${item.title} (${when})`)
      lines.push(`  ${item.message}`)
    }
    lines.push('')
  }

  const logs = opts?.runtimeLogs ?? []
  if (logs.length) {
    lines.push('### Runtime log (most recent)')
    for (const line of logs.slice(-maxLogLines)) {
      const prefix = line.displayTime ? `[${line.displayTime}] ` : ''
      lines.push(`${prefix}${line.message}`)
    }
    lines.push('')
  }

  lines.push(
    '### Request',
    'Investigate the failures above, identify the root cause, and propose or apply a fix. If the agent timed out or looped, suggest how to narrow the task or adjust the workflow.',
  )

  return lines.join('\n').trim()
}
