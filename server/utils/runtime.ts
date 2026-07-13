import type { ChildProcess } from 'child_process'
import type { EventStream } from 'h3'

export type ProcState = {
  proc: ChildProcess
  streams: EventStream[]
  heartbeat: NodeJS.Timeout | null
  /** Agent runtime that spawned this process (e.g. 'opencode', 'cursor') */
  runtime?: string
  /** Set to true when the process is killed because of a detected command loop */
  isLoopKill?: boolean
  /** Set to true when the process is killed because it exceeded the runtime timeout */
  isTimeoutKill?: boolean
  /** Set to true when the process has exited (normal, crash, or error) */
  exited?: boolean
  /** Set to true after a browser-MCP auto-retry has been scheduled */
  browserRetryIssued?: boolean
  /** Last bash command that triggered loop detection */
  lastLoopCommand?: string
}

export const activeProcesses = new Map<string, ProcState>()

/** Stores pending feedback for a task before the EventSource connects */
export const pendingFeedback = new Map<string, string>()

export function addStreamToProc(taskId: string, stream: EventStream, entry: ProcState) {
  entry.streams.push(stream)
  stream.onClosed = () => {
    entry.streams = entry.streams.filter(s => s !== stream)
    // Do NOT kill the process when all streams close.
    // The agent continues running in the background even when the browser disconnects.
    // The process can only be explicitly stopped via the kill endpoint.
  }
}

export async function pushToStreams(entry: ProcState, data: string) {
  for (const s of entry.streams) {
    try { await s.push(data) } catch {}
  }
}
