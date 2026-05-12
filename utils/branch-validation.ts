/**
 * Validates a git branch name against common safe conventions.
 * Returns an error message string if invalid, or empty string if valid.
 */
export function validateBranchName(name: string): string {
  if (!name) return ''
  const regex = /^(?!\.)(?!-)(?!\/)(?!.*\.\.)(?!.*\/$)(?!.*\.lock$)[a-zA-Z0-9._/-]+$/
  if (!regex.test(name)) {
    return 'Invalid branch name. Cannot start with ., -, or /, end with / or .lock, contain .., spaces, or special characters.'
  }
  return ''
}

/**
 * Zod-compatible branch name validator.
 * Use with .refine() in zod schemas.
 */
export function isValidBranchName(name: unknown): boolean {
  if (typeof name !== 'string') return true
  if (!name) return true
  const regex = /^(?!\.)(?!-)(?!\/)(?!.*\.\.)(?!.*\/$)(?!.*\.lock$)[a-zA-Z0-9._/-]+$/
  return regex.test(name)
}
