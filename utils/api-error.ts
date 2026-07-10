export interface ApiValidationIssue {
  path?: (string | number)[]
  message: string
  code?: string
  validation?: string
}

function readIssuesFromData(data: Record<string, unknown> | undefined): ApiValidationIssue[] {
  if (!data) return []

  const nested = data.data as Record<string, unknown> | undefined
  if (Array.isArray(nested?.issues)) return nested.issues as ApiValidationIssue[]
  if (Array.isArray(data.issues)) return data.issues as ApiValidationIssue[]

  if (typeof data.message === 'string') {
    try {
      const parsed = JSON.parse(data.message)
      if (Array.isArray(parsed)) return parsed as ApiValidationIssue[]
    } catch {
      // not JSON — fall through
    }
  }

  return []
}

export function parseApiValidationIssues(err: unknown): ApiValidationIssue[] {
  const data = (err as { data?: Record<string, unknown> })?.data
  return readIssuesFromData(data)
}

export function getApiFieldErrors(
  issues: ApiValidationIssue[],
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path?.[0]
    if (typeof key === 'string' && !errors[key]) {
      errors[key] = issue.message
    }
  }
  return errors
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { statusMessage?: string; message?: string } })?.data
  if (data?.statusMessage && data.statusMessage !== 'Validation Error') {
    return data.statusMessage
  }
  if (typeof data?.message === 'string' && !data.message.trim().startsWith('[')) {
    return data.message
  }
  return (err as { message?: string })?.message || fallback
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
