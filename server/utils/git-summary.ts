import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function getDiffSummary(
  repoDir: string,
  repoDefaultBranch: string,
  taskTitle: string,
  taskDescription?: string | null
): Promise<string> {
  try {
    const ref = `origin/${repoDefaultBranch}`
    const { stdout: diffOutput } = await execAsync(`git diff ${ref} HEAD`, { cwd: repoDir })
    const { stdout: diffStat } = await execAsync(`git diff --stat ${ref} HEAD`, { cwd: repoDir })

    if (!diffStat.trim()) return ''

    const files: { path: string; additions: string[]; deletions: number }[] = []
    let currentFile: typeof files[0] | null = null

    for (const line of diffOutput.split('\n')) {
      const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/)
      if (fileMatch) {
        if (currentFile) files.push(currentFile)
        currentFile = { path: fileMatch[2], additions: [], deletions: 0 }
        continue
      }
      if (currentFile) {
        if (line.startsWith('+') && !line.startsWith('+++') && !/^\+\s*$/.test(line) && !/^\+import\s/.test(line) && !/^\/\/\s/.test(line)) {
          const clean = line.slice(1).trim()
          if (clean && !clean.startsWith('}') && !clean.startsWith('{')) {
            currentFile.additions.push(clean)
          }
        }
        if (line.startsWith('-') && !line.startsWith('---') && !/^\-\s*$/.test(line)) {
          currentFile.deletions++
        }
      }
    }
    if (currentFile) files.push(currentFile)

    let summary = '## Summary\n\n'
    summary += `This PR implements **${taskTitle}**.`

    if (taskDescription) {
      summary += `\n\n${taskDescription}`
    }

    summary += '\n\n## Changes\n'
    for (const file of files) {
      summary += `\n### \`${file.path}\`\n`
      if (file.additions.length > 0) {
        summary += '\n**Added:**\n'
        for (const add of file.additions.slice(0, 10)) {
          summary += `- ${add}\n`
        }
        if (file.additions.length > 10) {
          summary += `- _... and ${file.additions.length - 10} more changes_\n`
        }
      }
      if (file.deletions > 0) {
        summary += `\n**Removed:** ${file.deletions} line${file.deletions > 1 ? 's' : ''}\n`
      }
    }

    summary += `\n## Files Changed\n\`\`\`\n${diffStat.trim()}\n\`\`\``

    return summary
  } catch {
    return ''
  }
}
