import { spawn } from 'child_process'
import { accessSync, constants } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { extractJsonFromAiResponse } from '~/server/utils/parse-ai-json'
import { processOpencodeLine } from '~/server/utils/opencode-parser'

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
const MAX_RUNTIME_MS = 8 * 60 * 1000 // 8 minutes

// In-memory job store for polling
const jobStore = new Map<string, {
  status: 'running' | 'completed' | 'error'
  progress: number
  step: string
  tasks?: any[]
  error?: string
  rawOutput?: string
  createdAt: number
}>()

// Clean up old jobs every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobStore.entries()) {
    if (now - job.createdAt > 30 * 60 * 1000) { // 30 minutes
      jobStore.delete(id)
    }
  }
}, 5 * 60 * 1000)

const generateTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  sections: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const { id: prdId } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, generateTasksSchema.parse)
  const db = getDb()

  // Fetch PRD with sections
  const prd = await db.query.prds.findFirst({
    where: eq(schema.prds.id, prdId),
    with: { sections: true },
  })

  if (!prd) {
    throw createError({ statusCode: 404, statusMessage: 'PRD not found' })
  }

  // Filter sections if requested
  let sections = prd.sections || []
  if (body.sections && body.sections.length > 0) {
    sections = sections.filter(s => body.sections!.includes(s.sectionType))
  }

  if (sections.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No sections found to extract tasks from' })
  }

  let opencodeOk = false
  try {
    accessSync(opencodePath, constants.X_OK)
    opencodeOk = true
  }
  catch {}

  if (!opencodeOk) {
    throw createError({ statusCode: 500, statusMessage: 'opencode not found' })
  }

  // Create a job ID
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  jobStore.set(jobId, {
    status: 'running',
    progress: 10,
    step: 'Analyzing PRD sections...',
    createdAt: Date.now(),
  })

  // Start the generation in the background
  generateTasksAsync(prdId, prd, sections, jobId)

  // Return immediately with the job ID
  return { jobId, status: 'running' }
})

async function generateTasksAsync(
  prdId: string,
  prd: any,
  sections: any[],
  jobId: string,
) {
  const sectionsText = sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n')

  const prompt = `[USER MESSAGE]

Please analyze this PRD and extract development tasks as a JSON array.

PRD Title: ${prd.title}

${sectionsText}

Return ONLY a JSON array with this structure:
[
  {"title": "...", "description": "...", "priority": "medium", "estimateHours": 8, "labels": ["feature"], "parentIndex": null, "sectionSource": "requirements"}
]

Rules:
- Tasks should be completable in 1-3 days
- Group related tasks with parentIndex
- Priority: urgent, high, medium, low, or none
- sectionSource: overview, goals, user_stories, requirements, technical_spec, acceptance_criteria, milestones, risks
- Return ONLY the JSON array, no other text`

  const workDir = process.cwd()
  const minimalEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: process.env.NODE_ENV,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,
  }

  const spawnArgs = [
    'run',
    '--format', 'json',
    '--dangerously-skip-permissions',
    '--dir', workDir,
    '--', prompt,
  ]

  const proc = spawn(opencodePath, spawnArgs, {
    cwd: workDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: minimalEnv,
  })

  const rawOutput = { value: '' }
  const stderrOutput = { value: '' }
  let lineBuffer = ''
  let lastActivity = Date.now()
  let stdoutEnded = false
  const debugLog = { eventTypes: [] as string[], rawLines: [] as string[] }

  function updateJob(status: 'running' | 'completed' | 'error', data: Partial<any>) {
    const job = jobStore.get(jobId)
    if (job) {
      Object.assign(job, { status, ...data })
    }
  }

  function flushLineBuffer() {
    if (lineBuffer.trim()) {
      processOpencodeLine(lineBuffer, rawOutput, debugLog)
      lineBuffer = ''
    }
  }

  const runtimeTimeout = setTimeout(() => {
    if (proc.exitCode === null) {
      proc.kill('SIGTERM')
      setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
    }
  }, MAX_RUNTIME_MS)

  const heartbeat = setInterval(() => {
    const idle = Math.round((Date.now() - lastActivity) / 1000)
    if (idle > 10) {
      const alive = proc.exitCode === null
      const msg = alive ? `Generating tasks (${idle}s)...` : `Process exited (code ${proc.exitCode})`
      updateJob('running', { step: msg, progress: 50 })
    }
  }, 5000)

  proc.stdout?.on('data', (chunk: Buffer) => {
    lastActivity = Date.now()
    lineBuffer += chunk.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() || ''
    for (const line of lines) {
      processOpencodeLine(line, rawOutput, debugLog)
    }
  })

  proc.stdout?.on('end', () => {
    stdoutEnded = true
    flushLineBuffer()
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    lastActivity = Date.now()
    const text = chunk.toString()
    if (text) {
      stderrOutput.value += text
    }
  })

  proc.on('error', (err) => {
    clearTimeout(runtimeTimeout)
    clearInterval(heartbeat)
    updateJob('error', {
      error: `Failed to start opencode: ${err.message}`,
      progress: 0,
    })
  })

  proc.on('close', async (code, signal) => {
    clearTimeout(runtimeTimeout)
    clearInterval(heartbeat)

    if (signal || code !== 0) {
      const msg = signal ? `Terminated by ${signal}` : `Exited with code ${code}`
      updateJob('error', { error: msg, progress: 0 })
      return
    }

    // Wait for stdout to end
    let waitCount = 0
    while (!stdoutEnded && waitCount < 20) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitCount++
    }

    flushLineBuffer()

    if (rawOutput.value.length === 0) {
      updateJob('error', {
        error: 'AI model produced no output',
        rawOutput: rawOutput.value,
        stderrOutput: stderrOutput.value.slice(0, 1000),
      })
      return
    }

    try {
      const parsed = extractJsonFromAiResponse<Array<{
        title: string
        description: string
        priority: string
        estimateHours: number | null
        labels: string[]
        parentIndex: number | null
        sectionSource: string
      }>>(rawOutput.value)

      if (!Array.isArray(parsed)) {
        throw new Error('Invalid task list: expected array')
      }

      updateJob('completed', {
        tasks: parsed,
        step: 'Tasks generated successfully',
        progress: 100,
      })
    }
    catch (err: any) {
      updateJob('error', {
        error: `Failed to parse tasks: ${err.message}`,
        rawOutput: rawOutput.value.slice(0, 2000),
        stderrOutput: stderrOutput.value.slice(0, 1000),
      })
    }
  })
}

// Export job store for the status endpoint
export { jobStore }
