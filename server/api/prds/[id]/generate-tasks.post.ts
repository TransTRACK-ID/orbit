import { createEventStream } from 'h3'
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

  const stream = createEventStream(event)

  setTimeout(async () => {
    if (!opencodeOk) {
      await stream.push(JSON.stringify({ error: `opencode not found at ${opencodePath}`, step: 'error' }))
      stream.close()
      return
    }

    await stream.push(JSON.stringify({ step: 'Analyzing PRD sections...', progress: 10 }))

    // Build concise sections text - only include task-relevant sections
    const taskRelevantSections = ['user_stories', 'requirements', 'technical_spec', 'acceptance_criteria']
    const relevantSections = sections.filter(s => taskRelevantSections.includes(s.sectionType))
    
    // If no relevant sections, use all sections
    const sectionsToUse = relevantSections.length > 0 ? relevantSections : sections
    
    // Truncate each section to prevent context overflow
    const MAX_SECTION_LENGTH = 300
    const sectionsText = sectionsToUse.map(s => {
      let content = s.content
      if (content.length > MAX_SECTION_LENGTH) {
        content = content.slice(0, MAX_SECTION_LENGTH) + '...'
      }
      return `## ${s.title}\n${content}`
    }).join('\n\n')

    // Use chat-style message format (same as brainstorm chat endpoint)
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

    await stream.push(JSON.stringify({ step: 'Generating tasks with AI...', progress: 30 }))

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
    const debugLog = { eventTypes: [] as string[], rawLines: [] as string[] }

    const runtimeTimeout = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGTERM')
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
      }
    }, MAX_RUNTIME_MS)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      if (idle > 10) {
        const alive = proc.exitCode === null
        const msg = alive ? `Generating tasks (${idle}s)...` : `Process exited (code ${proc.exitCode})`
        await stream.push(JSON.stringify({ step: msg, progress: 50 }))
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

    proc.stderr?.on('data', (chunk: Buffer) => {
      lastActivity = Date.now()
      const text = chunk.toString()
      if (text) {
        stderrOutput.value += text
      }
    })

    proc.on('error', async (err) => {
      clearTimeout(runtimeTimeout)
      clearInterval(heartbeat)
      await stream.push(JSON.stringify({ error: `Failed to start opencode: ${err.message}`, step: 'error' }))
      stream.close()
    })

    proc.on('close', async (code, signal) => {
      clearTimeout(runtimeTimeout)
      clearInterval(heartbeat)

      if (signal || code !== 0) {
        const msg = signal ? `Terminated by ${signal}` : `Exited with code ${code}`
        await stream.push(JSON.stringify({ error: msg, step: 'error' }))
        stream.close()
        return
      }

      // Process any remaining line buffer content
      if (lineBuffer.trim()) {
        processOpencodeLine(lineBuffer, rawOutput, debugLog)
        lineBuffer = ''
      }

      await stream.push(JSON.stringify({ step: 'Parsing task list...', progress: 80 }))

      // Check if we got any actual content
      if (rawOutput.value.length === 0) {
        const debugInfo = {
          error: 'AI model produced no output. The prompt may be too long or the model may have failed.',
          step: 'error',
          rawOutput: rawOutput.value,
          stderrOutput: stderrOutput.value.slice(0, 1000),
          eventTypes: debugLog.eventTypes,
          rawLines: debugLog.rawLines.slice(0, 20),
        }
        await stream.push(JSON.stringify(debugInfo))
        stream.close()
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

        await stream.push(JSON.stringify({
          step: 'Tasks generated successfully',
          progress: 100,
          done: true,
          tasks: parsed,
        }))
        stream.close()
      }
      catch (err: any) {
        const debugInfo = {
          error: `Failed to parse tasks: ${err.message}`,
          step: 'error',
          rawOutput: rawOutput.value.slice(0, 2000),
          stderrOutput: stderrOutput.value.slice(0, 1000),
          eventTypes: debugLog.eventTypes,
          rawLines: debugLog.rawLines.slice(0, 20),
        }
        await stream.push(JSON.stringify(debugInfo))
        stream.close()
      }
    })
  }, 0)

  return stream.send()
})
