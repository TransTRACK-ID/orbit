import { eq } from 'drizzle-orm'
import type { getDb } from '~/server/database'
import { schema } from '~/server/database'
import type { Brainstorm, GrillQuestionMetadata, GrillStatus } from '~/types'
import { getPrimaryGrillMetadata, parseGrillBlocks } from '~/server/utils/grill-parser'
import { resolveBrainstormMode } from '~/server/utils/grill-mode'

type Db = ReturnType<typeof getDb>

function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isRecommendedAnswer(userAnswer: string, recommendedAnswer: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(recommendedAnswer)
}

export async function persistAssistantGrillMessage(
  db: Db,
  brainstormId: string,
  content: string,
) {
  const { blocks, warning } = parseGrillBlocks(content)
  const metadata = getPrimaryGrillMetadata(blocks)

  const [message] = await db.insert(schema.brainstormMessages)
    .values({
      brainstormId,
      role: 'assistant',
      content: content.trim(),
      metadata,
    })
    .returning()

  let grillStatus: GrillStatus | null = null
  let currentQuestionId: string | null = null

  if (metadata?.type === 'grill_question') {
    grillStatus = 'awaiting_answer'
    currentQuestionId = message.id
  } else if (metadata?.type === 'grill_complete') {
    grillStatus = 'complete'
    currentQuestionId = null
  } else {
    grillStatus = 'active'
    currentQuestionId = null
  }

  const [updatedBrainstorm] = await db.update(schema.brainstorms)
    .set({
      grillStatus,
      currentQuestionId,
      updatedAt: new Date(),
    })
    .where(eq(schema.brainstorms.id, brainstormId))
    .returning()

  return {
    message,
    brainstorm: updatedBrainstorm,
    warning,
  }
}

export async function processGrillUserAnswer(
  db: Db,
  brainstorm: Pick<Brainstorm, 'id' | 'mode' | 'title' | 'grillStatus' | 'currentQuestionId'>,
  userContent: string,
) {
  if (resolveBrainstormMode(brainstorm) !== 'grill') {
    return
  }

  if (brainstorm.grillStatus !== 'awaiting_answer' || !brainstorm.currentQuestionId) {
    return
  }

  const questionMessage = await db.query.brainstormMessages.findFirst({
    where: eq(schema.brainstormMessages.id, brainstorm.currentQuestionId),
  })

  if (!questionMessage?.metadata || questionMessage.metadata.type !== 'grill_question') {
    return
  }

  const existing = questionMessage.metadata as GrillQuestionMetadata
  const accepted = isRecommendedAnswer(userContent, existing.recommendedAnswer)
  const updatedMetadata: GrillQuestionMetadata = {
    ...existing,
    status: accepted ? 'accepted' : 'revised',
    userAnswer: userContent.trim(),
  }

  await db.update(schema.brainstormMessages)
    .set({ metadata: updatedMetadata })
    .where(eq(schema.brainstormMessages.id, questionMessage.id))

  await db.update(schema.brainstorms)
    .set({
      grillStatus: 'active',
      currentQuestionId: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.brainstorms.id, brainstorm.id))
}

export function canStartGrillAgentTurn(
  brainstorm: Pick<Brainstorm, 'mode' | 'title' | 'grillStatus'>,
  pendingMessage: string,
): { allowed: boolean; reason?: string } {
  if (resolveBrainstormMode(brainstorm) !== 'grill') {
    return { allowed: true }
  }

  if (brainstorm.grillStatus === 'awaiting_answer' && !pendingMessage.trim()) {
    return {
      allowed: false,
      reason: 'Waiting for your answer before the agent can continue',
    }
  }

  return { allowed: true }
}

export function canSendGrillUserMessage(
  brainstorm: Pick<Brainstorm, 'mode' | 'title' | 'grillStatus'>,
): { allowed: boolean; reason?: string } {
  if (resolveBrainstormMode(brainstorm) !== 'grill') {
    return { allowed: true }
  }

  if (!brainstorm.grillStatus) {
    return { allowed: true }
  }

  if (brainstorm.grillStatus === 'complete') {
    return { allowed: true }
  }

  if (brainstorm.grillStatus === 'awaiting_answer') {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: 'Wait for the agent to ask a question before responding',
  }
}
