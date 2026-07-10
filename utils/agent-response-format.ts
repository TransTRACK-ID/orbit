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

Formatting rules:
- Use \`##\` / \`###\` headings — not ALL CAPS lines.
- Use \`- \` bullet lists (blank line before the list).
- Use \`inline code\` for URLs, selectors, field names, and short values.
- Use tables only when comparing multiple columns.
- Do NOT wrap the whole reply in a single code fence.
- Do NOT use HTML tags — markdown only.
- Separate sections with blank lines.`
