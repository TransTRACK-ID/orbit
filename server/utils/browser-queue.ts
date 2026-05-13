import type { EventStream } from 'h3'
import type { BrowserRunConfig, BrowserContainerResult } from './browser-runtime'
import { runBrowserContainer } from './browser-runtime'

export type BrowserJob = {
  taskId: string
  workspaceId: string
  agentId: string
  config: BrowserRunConfig
  stream: EventStream
  resolve: (value: BrowserContainerResult) => void
  reject: (reason: Error) => void
}

let isRunning = false
const queue: BrowserJob[] = []

export function getQueueStatus() {
  return {
    isRunning,
    queued: queue.length,
    nextJob: queue[0]?.taskId || null,
  }
}

export async function enqueueBrowserJob(job: BrowserJob): Promise<BrowserContainerResult> {
  return new Promise((resolve, reject) => {
    queue.push({ ...job, resolve, reject })
    processQueue()
  })
}

async function processQueue() {
  if (isRunning || queue.length === 0) return

  isRunning = true
  const job = queue.shift()!

  try {
    const result = await runBrowserContainer(job.config, job.stream)
    job.resolve(result)
  } catch (err) {
    job.reject(err as Error)
  } finally {
    isRunning = false
    // Small delay before next job to let the system recover
    setTimeout(processQueue, 2000)
  }
}
