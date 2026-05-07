import type { ChildProcess } from 'child_process'
import type { EventStream } from 'h3'

export type ProcState = {
  proc: ChildProcess
  streams: EventStream[]
  heartbeat: NodeJS.Timeout | null
}

export const activeProcesses = new Map<string, ProcState>()

export function addStreamToProc(taskId: string, stream: EventStream, entry: ProcState) {
  entry.streams.push(stream)
  stream.onClosed = () => {
    entry.streams = entry.streams.filter(s => s !== stream)
    if (entry.streams.length === 0) {
      if (entry.heartbeat) clearInterval(entry.heartbeat)
      try { entry.proc.kill('SIGTERM') } catch {}
      setTimeout(() => { try { entry.proc.kill('SIGKILL') } catch {} }, 5000)
      activeProcesses.delete(taskId)
    }
  }
}

export async function pushToStreams(entry: ProcState, data: string) {
  for (const s of entry.streams) {
    try { await s.push(data) } catch {}
  }
}
