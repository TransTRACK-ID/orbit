import { z } from 'zod'
import type { GrillCompleteMetadata, GrillMessageMetadata, GrillQuestionMetadata } from '~/types'

const grillQuestionBlockSchema = z.object({
  type: z.literal('grill_question'),
  topic: z.string().optional(),
  question: z.string().min(1),
  recommendedAnswer: z.string().min(1),
  rationale: z.string().optional(),
})

const grillCompleteBlockSchema = z.object({
  type: z.literal('grill_complete'),
  summary: z.string().min(1),
  decisions: z.array(z.object({
    topic: z.string(),
    question: z.string(),
    answer: z.string(),
  })).default([]),
})

const grillBlockSchema = z.discriminatedUnion('type', [
  grillQuestionBlockSchema,
  grillCompleteBlockSchema,
])

export interface ParseGrillBlocksResult {
  blocks: GrillMessageMetadata[]
  warning?: string
}

const GRILL_FENCE_REGEX = /```(?:grill|json)\s*\n?([\s\S]+?)\n?```/gi

function isGrillJson(jsonText: string): boolean {
  try {
    const parsed = JSON.parse(jsonText.trim()) as { type?: string }
    return parsed.type === 'grill_question' || parsed.type === 'grill_complete'
  } catch {
    return false
  }
}

function extractGrillFences(rawText: string): string[] {
  const fences: string[] = []
  const fenceRegex = new RegExp(GRILL_FENCE_REGEX.source, GRILL_FENCE_REGEX.flags)
  let match
  while ((match = fenceRegex.exec(rawText)) !== null) {
    const inner = match[1].trim()
    if (isGrillJson(inner)) {
      fences.push(inner)
    }
  }
  return fences
}

/** Remove machine-readable grill blocks from assistant prose shown in chat. */
export function stripGrillBlocksFromContent(content: string): string {
  const fenceRegex = new RegExp(GRILL_FENCE_REGEX.source, GRILL_FENCE_REGEX.flags)
  return content
    .replace(fenceRegex, (match, inner: string) => (isGrillJson(inner) ? '' : match))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseGrillFence(jsonText: string): GrillMessageMetadata | null {
  try {
    const parsed = grillBlockSchema.parse(JSON.parse(jsonText))
    if (parsed.type === 'grill_question') {
      const metadata: GrillQuestionMetadata = {
        type: 'grill_question',
        topic: parsed.topic,
        question: parsed.question,
        recommendedAnswer: parsed.recommendedAnswer,
        rationale: parsed.rationale,
        status: 'pending',
      }
      return metadata
    }
    const metadata: GrillCompleteMetadata = {
      type: 'grill_complete',
      summary: parsed.summary,
      decisions: parsed.decisions,
    }
    return metadata
  } catch {
    return null
  }
}

export function parseGrillBlocks(content: string): ParseGrillBlocksResult {
  const fences = extractGrillFences(content)
  const blocks: GrillMessageMetadata[] = []

  for (const fence of fences) {
    const parsed = parseGrillFence(fence)
    if (parsed) blocks.push(parsed)
  }

  if (blocks.length === 0) {
    return { blocks }
  }

  const questionBlocks = blocks.filter((block) => block.type === 'grill_question')
  if (questionBlocks.length > 1) {
    const firstQuestionIndex = blocks.findIndex((block) => block.type === 'grill_question')
    const filtered = blocks.filter((block, index) => {
      if (block.type !== 'grill_question') return true
      return index === firstQuestionIndex
    })
    return {
      blocks: filtered,
      warning: 'Multiple grill_question blocks found — kept the first one',
    }
  }

  return { blocks }
}

export function getPrimaryGrillMetadata(blocks: GrillMessageMetadata[]): GrillMessageMetadata | null {
  if (blocks.length === 0) return null
  const complete = blocks.find((block) => block.type === 'grill_complete')
  if (complete) return complete
  const question = blocks.find((block) => block.type === 'grill_question')
  return question || blocks[0]
}
