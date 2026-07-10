/** Injected into agent prompts so task comments render as GitHub-flavored markdown. */
export const AGENT_RESPONSE_MARKDOWN_RULE = `[FINAL COMMENT — RESULTS ONLY]
Your reply is saved once as a task comment when you finish. Include ONLY the final report — never planning, narration, or live progress.

Forbidden in the saved comment:
- "I'll...", "Let me...", "First I will...", "I'm going to...", "Now I'll..."
- Step-by-step narration of what you are about to do or are doing
- Tool-call commentary ("Opening browser...", "Taking a snapshot...")

Write the report directly using this structure:

## Summary
One short paragraph of what you did or found.

## Results (or ## Steps / ## Findings)
Use a bullet list with \`- \` for outcomes, issues, or checks.

## Evidence (when testing)
Use fenced code blocks for snapshots, logs, or snippets:
\`\`\`text
paste relevant output here
\`\`\`

Formatting rules (strict — comments are rendered as HTML from markdown):
- Every section title MUST use \`##\` on its own line: \`## Summary\`, \`## Results\`, \`## Evidence\`
- Put a blank line after each heading before body text or lists
- Use \`- \` bullet lists for Results and Evidence (one fact per bullet)
- Put URLs, emails, versions, and field names in \`inline code\`
- Put JSON, logs, and console output in fenced \`\`\`json or \`\`\`text blocks — never inline partial JSON
- Keep Summary to 1–2 sentences; put details in Results and Evidence
- Do NOT use bold-only section titles like **Summary** — always \`## Summary\``
