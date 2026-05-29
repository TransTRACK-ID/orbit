export function extractJsonFromAiResponse<T>(rawText: string): T {
  // Try direct parse first
  try {
    return JSON.parse(rawText)
  }
  catch {}

  // Try extracting from markdown code fence
  const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    }
    catch {}
  }

  // Try finding JSON array or object boundaries
  const jsonMatch = rawText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    }
    catch {}
  }

  throw new Error('Could not extract JSON from AI response')
}
