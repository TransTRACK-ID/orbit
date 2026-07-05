import type {
  BrainstormMessage,
  GrillCompleteMetadata,
  GrillDecision,
  GrillDecisionsLedger,
  GrillPendingDecision,
  GrillQuestionMetadata,
  GrillStatus,
} from '~/types'

type MessageWithMetadata = Pick<BrainstormMessage, 'id' | 'metadata'>

export function extractGrillDecisionsFromMessages(
  messages: MessageWithMetadata[],
  options?: { grillStatus?: GrillStatus | null; currentQuestionId?: string | null },
): GrillDecisionsLedger {
  const resolved: GrillDecision[] = []
  let pending: GrillPendingDecision | null = null
  let summary: string | null = null
  let completeDecisions: GrillCompleteMetadata['decisions'] = []

  for (const message of messages) {
    const metadata = message.metadata
    if (!metadata) continue

    if (metadata.type === 'grill_question') {
      const question = metadata as GrillQuestionMetadata
      if (question.status === 'accepted' || question.status === 'revised') {
        resolved.push({
          messageId: message.id,
          topic: question.topic || 'General',
          question: question.question,
          answer: question.userAnswer || question.recommendedAnswer,
          status: question.status,
        })
      } else if (question.status === 'pending') {
        pending = {
          messageId: message.id,
          topic: question.topic,
          question: question.question,
          recommendedAnswer: question.recommendedAnswer,
        }
      }
    } else if (metadata.type === 'grill_complete') {
      summary = metadata.summary
      completeDecisions = metadata.decisions
    }
  }

  if (options?.currentQuestionId && options.grillStatus === 'awaiting_answer') {
    const current = messages.find((message) => message.id === options.currentQuestionId)
    if (current?.metadata?.type === 'grill_question') {
      const question = current.metadata as GrillQuestionMetadata
      pending = {
        messageId: current.id,
        topic: question.topic,
        question: question.question,
        recommendedAnswer: question.recommendedAnswer,
      }
    }
  }

  if (resolved.length === 0 && completeDecisions.length > 0) {
    for (const decision of completeDecisions) {
      resolved.push({
        messageId: '',
        topic: decision.topic || 'General',
        question: decision.question,
        answer: decision.answer,
        status: 'accepted',
      })
    }
  }

  return {
    resolved,
    pending,
    summary,
    isComplete: options?.grillStatus === 'complete',
  }
}

export function formatResolvedDecisionsForPrompt(ledger: GrillDecisionsLedger): string {
  if (ledger.resolved.length === 0 && !ledger.summary) {
    return ''
  }

  const lines: string[] = []

  if (ledger.resolved.length > 0) {
    for (const [index, decision] of ledger.resolved.entries()) {
      const statusLabel = decision.status === 'accepted'
        ? 'user accepted recommended'
        : 'user revised'
      lines.push(`${index + 1}. ${decision.topic}: ${decision.question} → ${decision.answer} (${statusLabel})`)
    }
  }

  let block = `[RESOLVED DECISIONS — authoritative]
These were explicitly agreed during the grill-me session. The PRD MUST reflect them. Do not contradict these decisions.
`

  if (lines.length > 0) {
    block += `\n${lines.join('\n')}`
  }

  if (ledger.summary) {
    block += `\n\n[SESSION SUMMARY]\n${ledger.summary}`
  }

  return block
}

export function formatResolvedDecisionsForChat(ledger: GrillDecisionsLedger): string {
  if (ledger.resolved.length === 0) {
    return ''
  }

  const lines = ledger.resolved.map((decision, index) => {
    const statusLabel = decision.status === 'accepted' ? 'accepted recommended' : 'revised'
    return `${index + 1}. ${decision.topic}: ${decision.answer} (${statusLabel})`
  })

  return `[RESOLVED DECISIONS SO FAR — do not re-ask these]
${lines.join('\n')}`
}
