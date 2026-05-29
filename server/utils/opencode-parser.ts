/**
 * Extract text content from an opencode JSON event.
 * Handles various event formats to ensure we capture the AI response
 * regardless of the event type or field structure.
 */
export function extractTextFromOpencodeEvent(evt: any): string | null {
  if (!evt || typeof evt !== 'object') {
    return null
  }

  // If the event is a JSON array, stringify it
  if (Array.isArray(evt)) {
    return JSON.stringify(evt)
  }

  // Try direct text fields
  if (typeof evt.text === 'string') return evt.text
  if (typeof evt.content === 'string') return evt.content
  if (typeof evt.result === 'string') return evt.result
  if (typeof evt.output === 'string') return evt.output
  if (typeof evt.message === 'string') return evt.message
  if (typeof evt.response === 'string') return evt.response

  // Try nested part fields
  if (evt.part) {
    if (typeof evt.part === 'string') return evt.part
    if (typeof evt.part.text === 'string') return evt.part.text
    if (typeof evt.part.content === 'string') return evt.part.content
    if (typeof evt.part.result === 'string') return evt.part.result
    if (typeof evt.part.output === 'string') return evt.part.output
    if (typeof evt.part.message === 'string') return evt.part.message
  }

  // Try nested data fields
  if (evt.data) {
    if (typeof evt.data === 'string') return evt.data
    if (typeof evt.data.text === 'string') return evt.data.text
    if (typeof evt.data.content === 'string') return evt.data.content
    if (typeof evt.data.result === 'string') return evt.data.result
  }

  // Try nested result fields
  if (evt.result) {
    if (typeof evt.result === 'object') {
      if (typeof evt.result.text === 'string') return evt.result.text
      if (typeof evt.result.content === 'string') return evt.result.content
    }
  }

  // Try nested output fields
  if (evt.output) {
    if (typeof evt.output === 'object') {
      if (typeof evt.output.text === 'string') return evt.output.text
      if (typeof evt.output.content === 'string') return evt.output.content
    }
  }

  return null
}

/**
 * Process a single line of opencode output.
 * Accumulates text content from JSON events, or raw text if not JSON.
 */
// Known opencode event types that never contain AI text content.
// These should be skipped rather than accumulated as raw output.
const NON_TEXT_EVENT_TYPES = new Set([
  'step_start',
  'step_finish',
  'step_error',
  'tool_use',
  'tool_result',
  'session_start',
  'session_finish',
  'message_start',
  'message_finish',
  'content_block_start',
  'content_block_stop',
])

export function processOpencodeLine(
  line: string,
  accumulator: { value: string },
  debugLog?: { eventTypes: string[]; rawLines: string[] },
): void {
  if (!line.trim()) return

  try {
    const evt = JSON.parse(line)

    // Log event type for debugging
    const eventType = evt.type || 'unknown'
    if (debugLog) {
      if (!debugLog.eventTypes.includes(eventType)) {
        debugLog.eventTypes.push(eventType)
      }
      debugLog.rawLines.push(line.slice(0, 200))
    }

    // Extract text from the event
    const text = extractTextFromOpencodeEvent(evt)
    if (text) {
      accumulator.value += text
    }
    else if (!NON_TEXT_EVENT_TYPES.has(eventType)) {
      // Only accumulate raw JSON for truly unknown event types.
      // Known non-text events (step_start, step_finish, etc.) are
      // silently skipped — they have no AI content and would poison
      // the accumulated output, causing JSON extraction to fail.
      accumulator.value += line
    }
  }
  catch {
    // Not valid JSON, accumulate raw text
    accumulator.value += line
  }
}
