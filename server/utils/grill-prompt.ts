interface GrillHistoryMessage {
  role: string
  content: string
}

interface BuildGrillChatMessageOptions {
  message: string
  historyMessages: GrillHistoryMessage[]
  attachmentPrompt: string
}

export const GRILLING_RULES = `[GRILL-ME MODE]
You are running a grill-me session. Interview relentlessly about the plan until shared understanding.

RULES:
- Ask ONE question at a time. Never ask multiple questions in one message.
- For each question, provide your recommended answer.
- If a question can be answered by reading the codebase, read the codebase first instead of asking the user.
- Do NOT implement anything. Read-only exploration only.
- Do NOT move to the next question until the user responds.
- Walk down each branch of the design tree until decisions are clear.
- When all branches are resolved, summarize the agreed decisions.

OUTPUT FORMAT (required for every question):
\`\`\`grill
{ "type": "grill_question", "topic": "...", "question": "...", "recommendedAnswer": "...", "rationale": "..." }
\`\`\`
Then write a human-readable version below the block.

When the session is complete:
\`\`\`grill
{ "type": "grill_complete", "summary": "...", "decisions": [{ "topic": "...", "question": "...", "answer": "..." }] }
\`\`\`
Then write a brief human-readable summary below the block.`

export function buildGrillChatMessage({
  message,
  historyMessages,
  attachmentPrompt,
}: BuildGrillChatMessageOptions): string {
  const prefix = attachmentPrompt ? `${attachmentPrompt}\n\n` : ''

  if (message) {
    const isFirstUserTurn = historyMessages.filter((msg) => msg.role === 'user').length <= 1
    if (isFirstUserTurn) {
      return `${prefix}[USER PLAN TO GRILL]\n${message}\n\nThe user wants to grill this plan. Explore the codebase if helpful, then ask your first question (one at a time) with a recommended answer. Remember: read-only mode — do NOT edit any files.`
    }
    return `${prefix}[USER ANSWER]\n${message}\n\nThe user answered the current question. Acknowledge their answer, then ask the next single question with your recommended answer — or output grill_complete if all branches are resolved. Remember: read-only mode — do NOT edit any files.`
  }

  if (historyMessages.length > 0) {
    return `${prefix}Continue the grill-me session based on the conversation history above. Ask the next unanswered question (one at a time) with your recommended answer — or output grill_complete if all branches are resolved. Remember: read-only mode — do NOT edit any files.`
  }

  return `${prefix}Start a grill-me session. Ask the user to describe their plan, then begin interviewing (one question at a time) with recommended answers. Remember: read-only mode — do NOT edit any files.`
}
