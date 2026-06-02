import type { ChildProcess } from 'child_process'
import type { EventStream } from 'h3'

export type ProcState = {
  proc: ChildProcess
  streams: EventStream[]
  heartbeat: NodeJS.Timeout | null
  /** Set to true when the process is killed because of a detected command loop */
  isLoopKill?: boolean
  /** Set to true when the process is killed because it exceeded the runtime timeout */
  isTimeoutKill?: boolean
  /** Set to true when the process has exited (normal, crash, or error) */
  exited?: boolean
}

export const activeProcesses = new Map<string, ProcState>()

/** Stores pending feedback for a task before the EventSource connects */
export const pendingFeedback = new Map<string, string>()

export function addStreamToProc(taskId: string, stream: EventStream, entry: ProcState) {
  entry.streams.push(stream)
  stream.onClosed = () => {
    entry.streams = entry.streams.filter(s => s !== stream)
    if (entry.streams.length === 0) {
      if (entry.heartbeat) clearInterval(entry.heartbeat)
      try { entry.proc.kill('SIGTERM') } catch {}
      setTimeout(() => { try { entry.proc.kill('SIGKILL') } catch {} }, 5000)
    }
  }
}

export async function pushToStreams(entry: ProcState, data: string) {
  for (const s of entry.streams) {
    try { await s.push(data) } catch {}
  }
}
