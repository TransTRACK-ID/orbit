/** Injected into agent prompts so task comments render as GitHub-flavored markdown. */
export const AGENT_RESPONSE_MARKDOWN_RULE = `[RESPONSE FORMATTING — GITHUB MARKDOWN]
Your final reply is shown in the task comment thread as rendered markdown (like GitHub). Structure it for humans:

## Summary
One short paragraph of what you did or found.

## Results (or ## Steps / ## Findings)
Use a bullet list with \`- \` for outcomes, issues, or checks.

## Evidence (when testing)
Use fenced code blocks for snapshots, logs, or snippets:
\`\`\`text
paste relevant output here
\`\`\`

Rules:
- Use \`##\` / \`###\` headings — not ALL CAPS lines.
- Use \`- \` bullet lists (blank line before the list).
- Use \`inline code\` for URLs, selectors, field names, and short values.
- Use tables only when comparing multiple columns.
- Do NOT wrap the whole reply in a single code fence.
- Do NOT use HTML tags — markdown only.
- Separate sections with blank lines.`
