import { createEventStream } from 'h3'
import { spawn } from 'child_process'
import { accessSync, constants } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { extractJsonFromAiResponse } from '~/server/utils/parse-ai-json'

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
const MAX_RUNTIME_MS = 5 * 60 * 1000 // 5 minutes

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

    const sectionsText = sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n')

    const prompt = `You are a project management expert. Analyze the following PRD and extract actionable development tasks.

[PRD TITLE]: ${prd.title}

[PRD CONTENT]:
${sectionsText}

[RULES]
- Each task must be small enough for one developer to complete in 1-3 days
- Group related tasks under parent tasks (epics)
- Assign priority: urgent, high, medium, low, or none
- Estimate hours for each task
- Suggest labels: feature, bugfix, improvement, refactor, documentation, testing
- Include clear acceptance criteria in the description

[OUTPUT FORMAT]
Return a JSON array:
[
  {
    "title": "Task title (imperative mood, max 100 chars)",
    "description": "Detailed description in markdown with acceptance criteria",
    "priority": "medium",
    "estimateHours": 8,
    "labels": ["feature"],
    "parentIndex": null,
    "sectionSource": "requirements"
  },
  {
    "title": "Subtask title",
    "description": "...",
    "priority": "medium",
    "estimateHours": 4,
    "labels": ["feature"],
    "parentIndex": 0,
    "sectionSource": "requirements"
  }
]

IMPORTANT:
- Return ONLY the JSON array, no other text
- parentIndex is the 0-based index of the parent task (null for top-level tasks)
- sectionSource should be one of: overview, goals, user_stories, requirements, technical_spec, acceptance_criteria, milestones, risks
- Every task description must end with "### Acceptance Criteria" section listing 2-4 bullet points`

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

    let rawOutput = ''
    let lineBuffer = ''
    let lastActivity = Date.now()

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
        if (!line.trim()) continue
        try {
          const evt = JSON.parse(line)
          const part = evt.part
          if (evt.type === 'text' && part) {
            const text = typeof part === 'string' ? part : part.text || part.content || ''
            rawOutput += text
          }
        }
        catch {
          rawOutput += line
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      lastActivity = Date.now()
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

      await stream.push(JSON.stringify({ step: 'Parsing task list...', progress: 80 }))

      try {
        const parsed = extractJsonFromAiResponse<Array<{
          title: string
          description: string
          priority: string
          estimateHours: number | null
          labels: string[]
          parentIndex: number | null
          sectionSource: string
        }>>(rawOutput)

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
        await stream.push(JSON.stringify({
          error: `Failed to parse tasks: ${err.message}`,
          step: 'error',
          rawOutput: rawOutput.slice(0, 2000),
        }))
        stream.close()
      }
    })
  }, 0)

  return stream.send()
})
