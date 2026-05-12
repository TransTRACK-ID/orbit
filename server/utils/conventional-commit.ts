/**
 * Shared utility for generating Conventional Commits messages from git diffs.
 * Format: type(scope): description
 */

/** Infer Conventional Commits scope from file paths */
export function inferScope(files: string[]): string {
  const scopes = new Map<string, number>()
  for (const f of files) {
    const parts = f.split('/')
    if (parts[0] === 'components' && parts[1]) {
      scopes.set(parts[1], (scopes.get(parts[1]) || 0) + 1)
    } else if (parts[0] === 'pages' && parts[1]) {
      const page = parts[1].replace(/\.(vue|ts|js)$/i, '')
      scopes.set(page, (scopes.get(page) || 0) + 1)
    } else if (parts[0] === 'server' && parts[1]) {
      scopes.set(parts[1], (scopes.get(parts[1]) || 0) + 1)
    } else if (
      ['composables', 'layouts', 'middleware', 'plugins', 'stores', 'types', 'utils'].includes(parts[0])
    ) {
      scopes.set(parts[0], (scopes.get(parts[0]) || 0) + 1)
    } else if (parts[0] === 'assets' && parts[1]) {
      scopes.set(parts[1], (scopes.get(parts[1]) || 0) + 1)
    }
  }
  let best = ''
  let bestCount = 0
  for (const [scope, count] of scopes) {
    if (count > bestCount) {
      best = scope
      bestCount = count
    }
  }
  return best
}

/** Detect the conventional commit type from diff content and files */
export function detectCommitType(
  addedLines: string[],
  removedLines: string[],
  files: string[]
): string {
  let newComponentCount = 0
  let newImportCount = 0
  let newFunctionCount = 0
  let styleChangeCount = 0
  let logicChangeCount = 0
  let errorHandlingCount = 0
  let testChangeCount = 0
  let docChangeCount = 0
  let configChangeCount = 0

  for (const f of files) {
    if (/\.(test|spec)\.(ts|js)$/i.test(f)) testChangeCount++
    if (/README|CHANGELOG|\.md$/i.test(f)) docChangeCount++
    if (/package\.json|tsconfig|tailwind|nuxt\.config|vite\.config|eslint|prettier/i.test(f)) {
      configChangeCount++
    }
    if (/\.(css|scss|sass|less)$/i.test(f)) styleChangeCount++
  }

  for (const line of addedLines) {
    if (/<[A-Z][a-zA-Z0-9_-]+/.test(line)) newComponentCount++
    if (/import\s+.*?\s+from\s+['"]/.test(line)) newImportCount++
    if (/\b(function|const|let|var)\s+([a-zA-Z0-9_]+)\s*[=\(]/.test(line)) newFunctionCount++
    if (/\b(bg|text|border|color|fill|stroke|ring|shadow|outline|decoration)-([a-z]+-[0-9]+|#[0-9a-fA-F]{3,8})\b/.test(line)) {
      styleChangeCount++
    }
    if (/\b(if|else|while|for|switch|try|catch|throw|error)\b/.test(line)) logicChangeCount++
    if (/\b(try|catch|throw|Error|error|handleError|onError)\b/.test(line)) errorHandlingCount++
    if (/\b(describe|it\(|test\(|expect\(|beforeEach|afterEach)\b/.test(line)) testChangeCount++
    if (/\b(//|/\*|\*|#)\s*(TODO|FIXME|NOTE|docs?|readme)/i.test(line)) docChangeCount++
  }

  for (const line of removedLines) {
    if (/\b(bg|text|border|color|fill|stroke|ring|shadow|outline|decoration)-([a-z]+-[0-9]+|#[0-9a-fA-F]{3,8})\b/.test(line)) {
      styleChangeCount++
    }
    if (/\b(if|else|while|for|switch|try|catch|throw|error)\b/.test(line)) logicChangeCount++
  }

  if (testChangeCount > 0 && testChangeCount >= files.length * 0.5) return 'test'
  if (docChangeCount > 0 && docChangeCount >= files.length * 0.5) return 'docs'
  if (configChangeCount > 0) return 'chore'
  if (newComponentCount > 0 || newImportCount > 0 || newFunctionCount > 0) return 'feat'
  if (
    errorHandlingCount > 0 ||
    (removedLines.length > 0 && logicChangeCount > 0 && addedLines.length < removedLines.length * 0.3)
  ) {
    return 'fix'
  }
  if (styleChangeCount > 0 && logicChangeCount === 0 && newFunctionCount === 0) return 'style'
  if (logicChangeCount > 0 && newFunctionCount === 0 && newComponentCount === 0) return 'refactor'
  if (addedLines.length === 0 && removedLines.length > 0) return 'chore'
  return 'chore'
}

/** Parse diff lines into added/removed arrays */
export function parseDiffLines(diffContent: string): {
  addedLines: string[]
  removedLines: string[]
} {
  const addedLines: string[] = []
  const removedLines: string[] = []
  for (const line of diffContent.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1).trim()
      if (content && !content.startsWith('//') && !content.startsWith('*')) {
        addedLines.push(content)
      }
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const content = line.slice(1).trim()
      if (content && !content.startsWith('//') && !content.startsWith('*')) {
        removedLines.push(content)
      }
    }
  }
  return { addedLines, removedLines }
}

/** Generate a Conventional Commits message from diff content and changed files */
export function generateConventionalCommit(
  diffContent: string,
  changedFiles: string[]
): string {
  const files = changedFiles.filter(f => f.trim())
  if (files.length === 0) return 'chore: update files'

  const scope = inferScope(files)
  const scopePart = scope ? `(${scope})` : ''
  const { addedLines, removedLines } = parseDiffLines(diffContent)
  const type = detectCommitType(addedLines, removedLines, files)

  // --- Generate description based on patterns ---

  // 1. Component additions
  const addedComponents = addedLines
    .map(l => l.match(/<([A-Z][a-zA-Z0-9_-]+)/)?.[1])
    .filter(Boolean)
  const uniqueComponents = [...new Set(addedComponents)].slice(0, 2)
  if (uniqueComponents.length > 0) {
    const compList = uniqueComponents.join(', ')
    return `${type}${scopePart}: add ${compList} ${uniqueComponents.length > 1 ? 'components' : 'component'}`
  }

  // 2. Color / style changes
  const colorChanges = new Set<string>()
  for (const line of [...addedLines, ...removedLines]) {
    const tailwindMatch = line.match(
      /\b(bg|text|border|color|fill|stroke|ring|shadow|outline|decoration)-([a-z]+-[0-9]+|current|transparent|white|black|inherit|primary|secondary)\b/
    )
    if (tailwindMatch) colorChanges.add(`${tailwindMatch[1]}-${tailwindMatch[2]}`)
    const hexMatch = line.match(/#([0-9a-fA-F]{3,8})\b/)
    if (hexMatch) colorChanges.add(`#${hexMatch[1]}`)
  }
  if (colorChanges.size > 0 && type === 'style') {
    const colors = [...colorChanges].slice(0, 2).join(', ')
    return `style${scopePart}: update colors to ${colors}`
  }
  if (colorChanges.size > 0) {
    const colors = [...colorChanges].slice(0, 2).join(', ')
    const action = type === 'feat' ? 'add' : 'update'
    return `${type}${scopePart}: ${action} ${colors} styling`
  }

  // 3. New function / method
  const addedFuncs = addedLines
    .map(l =>
      l.match(/\b(?:function|const|let|var)\s+([a-zA-Z0-9_]+)\s*(?:[=\(]|:\s*function\b)/)?.[1]
    )
    .filter(Boolean)
  const uniqueFuncs = [...new Set(addedFuncs)].slice(0, 2)
  if (uniqueFuncs.length > 0 && type === 'feat') {
    return `feat${scopePart}: add ${uniqueFuncs.join(', ')} ${uniqueFuncs.length > 1 ? 'functions' : 'function'}`
  }

  // 4. Import changes with new feature
  const addedImports = addedLines
    .map(l => l.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/)?.[1])
    .filter(Boolean)
  if (addedImports.length > 0 && type === 'feat') {
    const libs = [...new Set(addedImports.map(i => i.split('/').pop() || i))].slice(0, 2).join(', ')
    return `feat${scopePart}: integrate ${libs}`
  }

  // 5. Event / interaction
  const eventMatches = addedLines
    .map(l => l.match(/\b(on[A-Z][a-zA-Z0-9]+|@click|@submit|@change|@input|v-on:|@update:)/)?.[0])
    .filter(Boolean)
  if (eventMatches.length > 0) {
    return `feat${scopePart}: add ${eventMatches[0].replace('@', '').replace('v-on:', '')} interaction`
  }

  // 6. Logic / conditional
  const logicKeywords = ['if', 'else', 'while', 'for', 'switch', 'try', 'catch']
  const hasLogic = logicKeywords.some(k => addedLines.some(l => new RegExp(`\\b${k}\\b`).test(l)))
  if (hasLogic && (type === 'fix' || type === 'refactor')) {
    const action = type === 'fix' ? 'fix' : 'refactor'
    return `${type}${scopePart}: ${action} conditional logic`
  }

  // 7. Error handling
  if (type === 'fix') {
    return `fix${scopePart}: handle error cases`
  }

  // 8. Text / content changes
  const addedStrings = addedLines
    .map(l => l.match(/["']([^"']{4,})["']/)?.[1])
    .filter((s): s is string => !!s && !s.includes('class=') && !s.includes('style='))
  const removedStrings = removedLines
    .map(l => l.match(/["']([^"']{4,})["']/)?.[1])
    .filter((s): s is string => !!s && !s.includes('class=') && !s.includes('style='))
  if (addedStrings.length > 0 || removedStrings.length > 0) {
    const text = addedStrings[0] || removedStrings[0]
    const shortText = text.slice(0, 25)
    return `${type}${scopePart}: update ${shortText}... content`
  }

  // 9. Test changes
  if (type === 'test') {
    return `test${scopePart}: add/update test coverage`
  }

  // 10. Documentation
  if (type === 'docs') {
    return `docs${scopePart}: update documentation`
  }

  // 11. Config / tooling
  if (type === 'chore') {
    const isConfig = files.some(f =>
      /package\.json|tsconfig|tailwind|nuxt\.config|vite\.config|eslint|prettier|\.env/i.test(f)
    )
    if (isConfig) return `chore${scopePart}: update configuration`
  }

  // 12. Fallback by file scope
  if (files.length === 1) {
    const name = files[0].split('/').pop()?.replace(/\.(vue|ts|js|css|scss|json|md)$/i, '') || 'file'
    const action = type === 'feat' ? 'add' : type === 'fix' ? 'fix' : 'update'
    return `${type}${scopePart}: ${action} ${name}`
  } else if (files.length <= 3) {
    const names = files
      .map(f => f.split('/').pop()?.replace(/\.(vue|ts|js|css|scss|json|md)$/i, '') || '')
      .join(', ')
    return `${type}${scopePart}: update ${names}`
  } else {
    return `${type}${scopePart}: update ${files.length} files`
  }
}
