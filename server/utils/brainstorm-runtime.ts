import type { ChildProcess } from 'child_process'
import type { EventStream } from 'h3'

export type BrainstormProcState = {
  proc: ChildProcess
  streams: EventStream[]
  heartbeat: NodeJS.Timeout | null
}

export const activeBrainstormProcesses = new Map<string, BrainstormProcState>()

/** Stores pending chat message for a brainstorm before the EventSource connects */
export const pendingBrainstormMessages = new Map<string, string>()

export function addStreamToBrainstormProc(brainstormId: string, stream: EventStream, entry: BrainstormProcState) {
  entry.streams.push(stream)
  stream.onClosed = () => {
    entry.streams = entry.streams.filter(s => s !== stream)
    if (entry.streams.length === 0) {
      if (entry.heartbeat) clearInterval(entry.heartbeat)
      try { entry.proc.kill('SIGTERM') } catch {}
      setTimeout(() => { try { entry.proc.kill('SIGKILL') } catch {} }, 5000)
      activeBrainstormProcesses.delete(brainstormId)
    }
  }
}

export async function pushToBrainstormStreams(entry: BrainstormProcState, data: string) {
  for (const s of entry.streams) {
    try { await s.push(data) } catch {}
  }
}
