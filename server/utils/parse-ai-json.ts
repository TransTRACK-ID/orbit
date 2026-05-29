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

  // Try extracting from markdown code fence (global regex to find all fences)
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]+?)\n?```/g
  let match
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    try {
      return JSON.parse(match[1].trim())
    }
    catch {}
  }

  // Try to find the JSON array by looking for balanced brackets from the end
  // This is more robust than regex for large JSON with nested content
  const lastBracket = trimmed.lastIndexOf(']')
  if (lastBracket !== -1 && lastBracket > 0) {
    // Try to find the matching opening bracket by counting brackets
    let bracketCount = 1
    for (let i = lastBracket - 1; i >= 0; i--) {
      if (trimmed[i] === ']') bracketCount++
      else if (trimmed[i] === '[') bracketCount--
      if (bracketCount === 0) {
        const candidate = trimmed.slice(i, lastBracket + 1)
        try {
          return JSON.parse(candidate)
        }
        catch {}
        break
      }
    }
  }

  // Try to find the JSON object by looking for balanced braces from the end
  const lastBrace = trimmed.lastIndexOf('}')
  if (lastBrace !== -1 && lastBrace > 0) {
    let braceCount = 1
    for (let i = lastBrace - 1; i >= 0; i--) {
      if (trimmed[i] === '}') braceCount++
      else if (trimmed[i] === '{') braceCount--
      if (braceCount === 0) {
        const candidate = trimmed.slice(i, lastBrace + 1)
        try {
          return JSON.parse(candidate)
        }
        catch {}
        break
      }
    }
  }

  // Fallback: try greedy regex for JSON array or object anywhere in text
  const jsonMatch = trimmed.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    }
    catch {}
  }

  throw new Error('Could not extract JSON from AI response')
}
