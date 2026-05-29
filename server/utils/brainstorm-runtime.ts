import type { ChildProcess } from 'child_process'
import type { EventStream } from 'h3'

export type BrainstormProcState = {
  proc: ChildProcess | null
  streams: EventStream[]
  heartbeat: NodeJS.Timeout | null
  completedAt?: number
  exitMessage?: string
  // Store output for polling when SSE is not available
  outputBuffer: string[]
  lastOutputIndex: number
}

export const activeBrainstormProcesses = new Map<string, BrainstormProcState>()

/** Stores pending chat message for a brainstorm before the EventSource connects */
export const pendingBrainstormMessages = new Map<string, string>()

export function addStreamToBrainstormProc(brainstormId: string, stream: EventStream, entry: BrainstormProcState) {
  entry.streams.push(stream)
  stream.onClosed = () => {
    entry.streams = entry.streams.filter(s => s !== stream)
    // Don't kill the process when streams close - let it continue running
    // The process will be cleaned up by the close handler or timeout
  }
}

export async function pushToBrainstormStreams(entry: BrainstormProcState, data: string) {
  // Store in buffer for polling
  entry.outputBuffer.push(data)
  
  // Push to active streams
  for (const s of entry.streams) {
    try { await s.push(data) } catch {}
  }
}

export function getBrainstormOutput(entry: BrainstormProcState, fromIndex: number): { output: string[], nextIndex: number } {
  const output = entry.outputBuffer.slice(fromIndex)
  return {
    output,
    nextIndex: entry.outputBuffer.length,
  }
}
