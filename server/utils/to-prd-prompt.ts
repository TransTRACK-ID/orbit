/**
 * Adapted from Matt Pocock's to-prd skill (https://github.com/mattpocock/skills/tree/main/skills/engineering/to-prd)
 * for Orbit's brainstorm → PRD pipeline. Issue-tracker publishing is omitted; output is JSON for Orbit DB.
 */

export const TO_PRD_SECTION_TYPES = [
  'problem_statement',
  'solution',
  'user_stories',
  'implementation_decisions',
  'testing_decisions',
  'out_of_scope',
  'further_notes',
] as const

export type ToPrdSectionType = typeof TO_PRD_SECTION_TYPES[number]

/** @deprecated Legacy section slugs from pre to-prd PRDs — kept for read compatibility */
export const LEGACY_PRD_SECTION_TYPES = [
  'overview',
  'goals',
  'requirements',
  'technical_spec',
  'acceptance_criteria',
  'milestones',
  'risks',
] as const

export interface BuildToPrdPromptOptions {
  brainstormTitle: string
  repoName: string
  mode: 'grill' | 'chat'
  attachmentPrompt: string
  conversationText: string
  decisionsBlock: string
  hasRepo: boolean
}

const SECTION_DEFINITIONS = `## Problem Statement
The problem the user is facing, from the user's perspective.

## Solution
The solution to the problem, from the user's perspective.

## User Stories
A LONG, numbered list of user stories. Each in the format:
1. As a [role], I want a [feature], so that [benefit]
Cover all aspects of the feature extensively.

## Implementation Decisions
Decisions made during planning. Include modules to build/modify, interfaces, architectural choices, schema changes, API contracts, and specific interactions.
Do NOT include specific file paths or code snippets unless a prototype encodes a decision more precisely than prose (state machine, reducer, schema, type shape) — trim to decision-rich parts only.

## Testing Decisions
What makes a good test (external behavior, not implementation details), which modules will be tested, testing seams at the highest level possible (prefer existing seams), and prior art from the codebase.

## Out of Scope
What is explicitly out of scope.

## Further Notes
Any additional notes about the feature.`

function buildJsonSchema(): string {
  const sections = TO_PRD_SECTION_TYPES.map((sectionType) => {
    const titles: Record<ToPrdSectionType, string> = {
      problem_statement: 'Problem Statement',
      solution: 'Solution',
      user_stories: 'User Stories',
      implementation_decisions: 'Implementation Decisions',
      testing_decisions: 'Testing Decisions',
      out_of_scope: 'Out of Scope',
      further_notes: 'Further Notes',
    }
    return `    {
      "sectionType": "${sectionType}",
      "title": "${titles[sectionType]}",
      "content": "markdown content..."
    }`
  })

  return `{
  "title": "PRD title",
  "sections": [
${sections.join(',\n')}
  ]
}`
}

export function buildToPrdPrompt(options: BuildToPrdPromptOptions): string {
  const {
    brainstormTitle,
    repoName,
    mode,
    attachmentPrompt,
    conversationText,
    decisionsBlock,
    hasRepo,
  } = options

  const isGrill = mode === 'grill'

  const synthesisRules = isGrill
    ? `[SYNTHESIS RULES — GRILL SESSION]
- Do NOT interview the user. Synthesize from the inputs below only.
- [RESOLVED DECISIONS] and [SESSION SUMMARY] are authoritative — the PRD MUST reflect every agreed decision.
- Map decisions into implementation_decisions and testing_decisions. Do not contradict resolved decisions.
- Codebase exploration was already done during the grill session — do NOT re-explore the repository.`
    : `[SYNTHESIS RULES — CHAT SESSION]
- Do NOT interview the user. Synthesize from the brainstorm conversation below.
${hasRepo
    ? `- BEFORE writing the PRD, explore the repository in the current working directory (read/grep files) to ground implementation_decisions and testing_decisions in the actual codebase.
- Prefer existing testing seams over proposing new ones. Use the highest seam possible.`
    : `- No repository is attached — synthesize from conversation and attachments only. Note limitations in implementation_decisions.`}`

  const contextBlock = isGrill
    ? `${decisionsBlock ? `${decisionsBlock}\n\n` : ''}[CONVERSATION — supporting context]
${conversationText}`
    : `[CONVERSATION]
${conversationText}`

  return `You are a senior product manager. Turn the brainstorm context into a structured Product Requirements Document (PRD).

${attachmentPrompt}${synthesisRules}

[BRAINSTORM CONTEXT]
Title: ${brainstormTitle}
Repository: ${repoName}
Session type: ${isGrill ? 'Grill-me (structured Q&A — resolved decisions are authoritative)' : 'Chat (free-form brainstorm)'}

${contextBlock}

[PRD TEMPLATE]
Use these sections exactly:
${SECTION_DEFINITIONS}

[OUTPUT FORMAT]
Return a JSON object with this exact structure:
${buildJsonSchema()}

IMPORTANT:
- Extract requirements from the actual brainstorm context — do not hallucinate features
${isGrill ? '- Every resolved grill decision MUST appear in implementation_decisions or testing_decisions\n' : ''}- User stories should be extensive and numbered
- Testing decisions should describe seams and prior art, not implementation details
- Return ONLY the JSON object, no other text.`
}

export function toPrdSectionSourceList(): string {
  return TO_PRD_SECTION_TYPES.join(', ')
}
