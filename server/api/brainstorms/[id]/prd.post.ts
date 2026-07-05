import { createEventStream } from 'h3'
import { existsSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'
import { extractJsonFromAiResponse } from '~/server/utils/parse-ai-json'
import { resolveBrainstormMode } from '~/server/utils/grill-mode'
import { resolveCloneDir, projectsDir } from '~/server/utils/worktree-resolver'
import { extractGrillDecisionsFromMessages, formatResolvedDecisionsForPrompt } from '~/utils/grill-decisions'
import {
  checkAgentRuntimeAvailability,
  resolveAppAgentRuntime,
  spawnAgentPromptProcess,
} from '~/server/utils/agent-runner'

const MAX_RUNTIME_MS = 5 * 60 * 1000 // 5 minutes

const generatePrdSchema = z.object({
  projectId: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  const { id: brainstormId } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, generatePrdSchema.parse)
  const db = getDb()

  // Fetch brainstorm
  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, brainstormId),
    with: { repository: true },
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  // Fetch all messages
  const messages = await db.query.brainstormMessages.findMany({
    where: eq(schema.brainstormMessages.brainstormId, brainstormId),
    orderBy: [asc(schema.brainstormMessages.createdAt)],
  })

  const brainstormMode = resolveBrainstormMode(brainstorm)
  if (brainstormMode === 'grill' && brainstorm.grillStatus !== 'complete') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Complete the grill session before generating a PRD',
    })
  }

  if (messages.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Brainstorm must have at least 2 messages to generate a PRD' })
  }

  // Fetch attachments
  const attachments = await db.query.brainstormAttachments.findMany({
    where: eq(schema.brainstormAttachments.brainstormId, brainstormId),
    orderBy: [asc(schema.brainstormAttachments.createdAt)],
  })

  const agentRuntime = await resolveAppAgentRuntime()
  const runtimeCheck = await checkAgentRuntimeAvailability(agentRuntime)

  const stream = createEventStream(event)

  setTimeout(async () => {
    if (!runtimeCheck.ok) {
      await stream.push(JSON.stringify({ error: runtimeCheck.error, step: 'error' }))
      stream.close()
      return
    }

    if (runtimeCheck.version) {
      await stream.push(JSON.stringify({
        step: `${agentRuntime === 'cursor' ? 'cursor-agent' : 'opencode'} version: ${runtimeCheck.version}`,
        progress: 5,
      }))
    }

    await stream.push(JSON.stringify({ step: 'Analyzing brainstorm conversation...', progress: 10 }))

    const repoName = brainstorm.repository?.name || 'None'

    const attachmentPrompt = attachments.length > 0
      ? `[ATTACHED FILES]\n${attachments.map((a, i) => `${i + 1}. ${a.originalName} (${a.mimeType})`).join('\n')}\n\n`
      : ''

    const conversationText = messages.map(m => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`).join('\n\n')

    const decisionsLedger = brainstormMode === 'grill'
      ? extractGrillDecisionsFromMessages(messages, {
          grillStatus: brainstorm.grillStatus as 'complete' | null,
          currentQuestionId: brainstorm.currentQuestionId,
        })
      : null
    const decisionsBlock = decisionsLedger
      ? formatResolvedDecisionsForPrompt(decisionsLedger)
      : ''

    const prompt = `You are a senior product manager. Analyze the following brainstorm conversation and produce a structured Product Requirements Document (PRD).

${attachmentPrompt}[BRAINSTORM CONTEXT]
Title: ${brainstorm.title}
Repository: ${repoName}
${brainstormMode === 'grill' ? 'Session type: Grill-me (structured Q&A — resolved decisions are authoritative)\n' : ''}
${decisionsBlock ? `${decisionsBlock}\n\n` : ''}[CONVERSATION — supporting context]
${conversationText}

[OUTPUT FORMAT]
Return a JSON object with this exact structure:
{
  "title": "PRD title",
  "sections": [
    {
      "sectionType": "overview",
      "title": "Product Overview",
      "content": "markdown content..."
    },
    {
      "sectionType": "goals",
      "title": "Goals & Objectives",
      "content": "markdown content..."
    },
    {
      "sectionType": "user_stories",
      "title": "User Stories",
      "content": "As a [role], I want [feature] so that [benefit]..."
    },
    {
      "sectionType": "requirements",
      "title": "Functional Requirements",
      "content": "markdown content with numbered requirements..."
    },
    {
      "sectionType": "technical_spec",
      "title": "Technical Specification",
      "content": "markdown content..."
    },
    {
      "sectionType": "acceptance_criteria",
      "title": "Acceptance Criteria",
      "content": "markdown content..."
    },
    {
      "sectionType": "milestones",
      "title": "Milestones & Timeline",
      "content": "markdown content..."
    },
    {
      "sectionType": "risks",
      "title": "Risks & Mitigations",
      "content": "markdown content..."
    }
  ]
}

IMPORTANT:
- Extract requirements from the actual brainstorm conversation, do not hallucinate features
${brainstormMode === 'grill' ? '- For grill-me sessions, treat [RESOLVED DECISIONS] as authoritative — the PRD MUST reflect every agreed decision\n' : ''}- Include quantifiable goals and metrics where possible
- Map urgency keywords from the conversation to requirement priorities
- Keep content concise but comprehensive
- Return ONLY the JSON object, no other text.`

    // Resolve workDir from the brainstorm's repository (same as chat endpoint).
    // In production (Docker), process.cwd() is /app (Orbit itself), which causes
    // opencode to use the wrong project config and may fail to produce output.
    let workDir = process.cwd()
    const repo = brainstorm.repository as (typeof schema.repositories.$inferSelect) | null
    if (repo?.url) {
      const cloneDir = resolveCloneDir(repo.url, repo.name, projectsDir)
      if (existsSync(cloneDir)) {
        workDir = cloneDir
      }
    }

    await stream.push(JSON.stringify({
      step: `Generating PRD with ${agentRuntime === 'cursor' ? 'cursor-agent' : 'opencode'}...`,
      progress: 30,
    }))

    const {
      proc,
      runtimeLabel,
      accumulator,
      stdoutEnded,
      lastActivity,
      flushLineBuffer,
    } = await spawnAgentPromptProcess({
      runtime: agentRuntime,
      prompt,
      workDir,
      env: { ...process.env },
    })

    const { rawOutput, stderrOutput, debugLog } = accumulator

    const runtimeTimeout = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGTERM')
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
      }
    }, MAX_RUNTIME_MS)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity.value) / 1000)
      if (idle > 10) {
        const alive = proc.exitCode === null
        const msg = alive ? `Generating PRD (${idle}s)...` : `Process exited (code ${proc.exitCode})`
        await stream.push(JSON.stringify({ step: msg, progress: 50 }))
      }
    }, 5000)

    proc.on('error', async (err) => {
      clearTimeout(runtimeTimeout)
      clearInterval(heartbeat)
      await stream.push(JSON.stringify({ error: `Failed to start ${runtimeLabel}: ${err.message}`, step: 'error' }))
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

      // Wait for stdout to end (with timeout)
      let waitCount = 0
      while (!stdoutEnded.value && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        waitCount++
      }

      // Flush any remaining line buffer content
      flushLineBuffer()

      await stream.push(JSON.stringify({ step: 'Parsing PRD structure...', progress: 80 }))

      // Log debug info for troubleshooting
      const outputLength = rawOutput.value.length
      const eventTypes = debugLog.eventTypes
      await stream.push(JSON.stringify({
        step: `Debug: output length=${outputLength}, event types=[${eventTypes.join(', ')}], workDir=${workDir}`,
        progress: 85,
      }))

      // Check if we got any actual content
      if (rawOutput.value.trim().length === 0) {
        const debugInfo = {
          error: `AI model produced no text output. ${runtimeLabel} emitted only control events (e.g. step_start) but no text. This usually means the model provider failed silently — check API keys and ${runtimeLabel} config.`,
          step: 'error',
          stderrOutput: stderrOutput.value.slice(0, 1000),
          eventTypes: debugLog.eventTypes,
          rawLines: debugLog.rawLines.slice(0, 20),
          workDir,
        }
        await stream.push(JSON.stringify(debugInfo))
        stream.close()
        return
      }

      try {
        // Extract JSON from the accumulated output
        const parsed = extractJsonFromAiResponse<{
          title: string
          sections: Array<{
            sectionType: string
            title: string
            content: string
          }>
        }>(rawOutput.value)

        if (!parsed.title || !Array.isArray(parsed.sections)) {
          throw new Error('Invalid PRD structure: missing title or sections')
        }

        await stream.push(JSON.stringify({ step: 'Saving PRD to database...', progress: 90 }))

        // Build full content markdown
        const fullContent = parsed.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n')

        // Insert PRD
        const [prd] = await db.insert(schema.prds)
          .values({
            brainstormId: brainstormId,
            workspaceId: brainstorm.workspaceId,
            projectId: body.projectId || null,
            title: parsed.title,
            content: fullContent,
            status: 'draft',
            version: 1,
            tasksGenerated: false,
          })
          .returning()

        // Insert sections
        const sectionValues = parsed.sections.map((s, idx) => ({
          prdId: prd.id,
          sectionType: s.sectionType,
          title: s.title,
          content: s.content,
          position: idx,
        }))

        await db.insert(schema.prdSections).values(sectionValues)

        // Fetch complete PRD with sections
        const completePrd = await db.query.prds.findFirst({
          where: eq(schema.prds.id, prd.id),
          with: { sections: true },
        })

        await stream.push(JSON.stringify({
          step: 'PRD generated successfully',
          progress: 100,
          done: true,
          prd: completePrd,
        }))
        stream.close()
      }
      catch (err: any) {
        const debugInfo = {
          error: `Failed to parse PRD: ${err.message}`,
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
