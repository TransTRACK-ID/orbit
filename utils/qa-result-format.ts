/** Injected into QA run agent prompts for structured write-back. */
export const QA_RESULT_JSON_CONTRACT = `[QA RESULT CONTRACT]
After finishing all cases, include a fenced JSON block labeled \`qa-result\` in your final reply (in addition to the human markdown report):

\`\`\`json qa-result
{
  "verdict": "passed|failed|blocked",
  "targetUrl": "https://staging…",
  "cases": [
    {
      "caseId": "<uuid>",
      "status": "passed|failed|blocked|skipped",
      "actual": "what you observed",
      "screenshots": ["login-ok.png"]
    }
  ]
}
\`\`\`

Rules:
- Include every case from the run (use the caseId values provided).
- Screenshot filenames must match files saved under \`.orbit/screenshots/\`.
- Do not invent caseIds. Prefer this JSON block as the source of truth for pass/fail.`
