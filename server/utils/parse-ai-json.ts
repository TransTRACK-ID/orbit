export function extractJsonFromAiResponse<T>(rawText: string): T {
  // Trim the text first
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error('AI response is empty')
  }

  // Try direct parse first
  try {
    return JSON.parse(trimmed)
  }
  catch {}

  // Try extracting from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    }
    catch {}
  }

  // Try finding the largest JSON array or object in the text
  // This handles cases where the JSON is embedded in other text
  const arrayMatch = trimmed.match(/\[[\s\S]*\]\s*$/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    }
    catch {}
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}\s*$/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    }
    catch {}
  }

  // Try finding any JSON array or object boundaries (more aggressive)
  const jsonMatch = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    }
    catch {}
  }

  throw new Error('Could not extract JSON from AI response')
}
