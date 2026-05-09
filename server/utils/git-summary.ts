import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function parseDiffStat(stat: string): { insertions: number; deletions: number; files: number } {
  const match = stat.trim().match(/(\d+) files? changed/)
  const files = match ? parseInt(match[1]) : 0
  const insMatch = stat.match(/(\d+) insertion/)
  const delMatch = stat.match(/(\d+) deletion/)
  return {
    files,
    insertions: insMatch ? parseInt(insMatch[1]) : 0,
    deletions: delMatch ? parseInt(delMatch[1]) : 0,
  }
}

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

    const stats = parseDiffStat(diffStat)

    const files: { path: string; hunks: { header: string }[] }[] = []
    let currentFile: typeof files[0] | null = null

    for (const line of diffOutput.split('\n')) {
      const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/)
      if (fileMatch) {
        if (currentFile) files.push(currentFile)
        currentFile = { path: fileMatch[2], hunks: [] }
        continue
      }
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
      if (hunkMatch && currentFile) {
        const start = parseInt(hunkMatch[1])
        const count = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1
        const label = start === 0 && count === 0 ? 'deleted'
          : count === 1 ? `L${start}`
          : `L${start}-${start + count - 1}`
        currentFile.hunks.push({ header: label })
      }
    }

    if (currentFile) files.push(currentFile)

    let body = ''
    body += `## Summary\n\n`
    body += `**${taskTitle}**\n\n`

    if (taskDescription) {
      body += `${taskDescription}\n\n`
    }

    body += `**${stats.files} file${stats.files > 1 ? 's' : ''} changed** — +${stats.insertions}/-${stats.deletions}\n\n`

    body += `| File | Changes |\n|------|---------|\n`
    for (const file of files) {
      const hunks = file.hunks.map(h => h.header || '(structural change)').join('; ')
      body += `| \`${file.path}\` | ${hunks || 'structural'} |\n`
    }

    body += `\n\`\`\`\n${diffStat.trim()}\n\`\`\``

    return body
  } catch {
    return ''
  }
}
