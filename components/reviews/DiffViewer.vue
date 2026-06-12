<template>
  <div>
    <UiLoadingState v-if="loading" text="Loading diff..." />

    <div v-else-if="diff && diff.files.length > 0">
      <!-- Summary bar -->
      <div class="flex items-center gap-3 mb-4 text-xs text-surface-600">
        <span class="font-semibold text-surface-900">{{ diff.files.length }} file{{ diff.files.length !== 1 ? 's' : '' }} changed</span>
        <span class="text-green-600 font-semibold tabular-nums">+{{ diff.totalAdditions }}</span>
        <span class="text-red-500 font-semibold tabular-nums">-{{ diff.totalDeletions }}</span>
      </div>

      <!-- File blocks -->
      <div class="space-y-3">
        <div
          v-for="(file, idx) in parsedFiles"
          :key="file.path"
          class="border border-surface-200 rounded-xl overflow-hidden"
        >
          <!-- Sticky file header -->
          <button
            class="w-full flex items-center justify-between px-4 py-2.5 bg-surface-50 border-b border-surface-200 text-left group hover:bg-surface-100 transition-colors sticky top-0 z-10"
            @click="toggleFile(idx)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <!-- File status badge -->
              <span
                class="text-xs font-bold w-4 h-4 rounded flex items-center justify-center flex-shrink-0 font-mono"
                :class="fileStatusClass(file.status)"
                :title="fileStatusLabel(file.status)"
              >{{ file.status.charAt(0).toUpperCase() }}</span>

              <Icon name="lucide:file-code" class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              <span class="text-xs font-mono font-medium text-surface-800 truncate">
                <!-- Show old → new path for renames -->
                <span v-if="file.oldPath && file.oldPath !== file.path" class="text-surface-400">{{ file.oldPath }} → </span>{{ file.path }}
              </span>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 ml-3">
              <!-- Diff bar -->
              <div class="flex items-center gap-0.5 h-2.5">
                <div
                  v-if="file.additions > 0"
                  class="h-full rounded-sm bg-green-400"
                  :style="{ width: `${barWidth(file.additions, file.additions + file.deletions)}px` }"
                />
                <div
                  v-if="file.deletions > 0"
                  class="h-full rounded-sm bg-red-400"
                  :style="{ width: `${barWidth(file.deletions, file.additions + file.deletions)}px` }"
                />
              </div>
              <span class="text-xs text-green-600 font-semibold tabular-nums">+{{ file.additions }}</span>
              <span class="text-xs text-red-500 font-semibold tabular-nums">-{{ file.deletions }}</span>
              <Icon
                name="lucide:chevron-right"
                class="w-3.5 h-3.5 text-surface-400 transition-transform duration-150"
                :class="{ 'rotate-90': expandedFiles.includes(idx) }"
              />
            </div>
          </button>

          <!-- Diff content -->
          <div v-if="expandedFiles.includes(idx)" class="overflow-x-auto">
            <div v-if="file.hunks.length > 0">
              <table class="w-full border-collapse text-xs font-mono" style="min-width: 0">
                <tbody>
                  <template v-for="(hunk, hIdx) in file.hunks" :key="hIdx">
                    <!-- Hunk header -->
                    <tr class="bg-sky-50 border-y border-sky-100 select-none">
                      <td class="w-10 text-right pr-3 py-1 text-sky-400 select-none" />
                      <td class="w-10 text-right pr-3 py-1 text-sky-400 select-none" />
                      <td class="py-1 px-3 text-sky-600 font-semibold whitespace-pre">{{ hunk.header }}</td>
                    </tr>
                    <!-- Lines -->
                    <tr
                      v-for="(line, lIdx) in hunk.lines"
                      :key="lIdx"
                      class="group"
                      :class="lineRowClass(line.type)"
                    >
                      <!-- Old line number -->
                      <td
                        class="w-10 text-right pr-3 py-0.5 select-none border-r border-surface-100 text-surface-400 leading-5"
                        :class="lineNumClass(line.type)"
                        style="min-width: 40px"
                      >{{ line.oldNum ?? '' }}</td>
                      <!-- New line number -->
                      <td
                        class="w-10 text-right pr-3 py-0.5 select-none border-r border-surface-100 text-surface-400 leading-5"
                        :class="lineNumClass(line.type)"
                        style="min-width: 40px"
                      >{{ line.newNum ?? '' }}</td>
                      <!-- Sign + content -->
                      <td class="py-0.5 pl-2 pr-4 whitespace-pre leading-5" :class="lineContentClass(line.type)">
                        <span class="select-none mr-2 font-bold" :class="lineSignClass(line.type)">{{ lineSign(line.type) }}</span>{{ line.content }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <div v-else class="py-5 text-center text-xs text-surface-400 bg-surface-50">
              <Icon name="lucide:binary" class="w-4 h-4 mx-auto mb-1 opacity-40" />
              Binary file or no preview available
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <div class="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
        <Icon name="lucide:file-diff" class="w-6 h-6 text-surface-400" />
      </div>
      <p class="text-sm font-semibold text-surface-600">No diff available</p>
      <p v-if="diff?.error" class="text-xs text-red-500 mt-1.5 max-w-xs mx-auto leading-relaxed">{{ diff.error }}</p>
      <p v-else class="text-xs text-surface-400 mt-1">Sync this PR to load the latest changes</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'no-newline'
  content: string
  oldNum?: number
  newNum?: number
}

interface DiffHunk {
  header: string
  lines: DiffLine[]
}

interface ParsedFile {
  path: string
  oldPath?: string
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'unknown'
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

const props = defineProps<{
  diff: {
    files: { path: string; additions: number; deletions: number }[]
    totalAdditions: number
    totalDeletions: number
    rawDiff: string
    error?: string
  } | null
  loading?: boolean
}>()

// Auto-expand first file
const expandedFiles = ref<number[]>([0])

const parsedFiles = computed<ParsedFile[]>(() => {
  if (!props.diff) return []
  return parseRawDiff(props.diff.rawDiff, props.diff.files)
})

watch(() => props.diff?.files?.length, (count) => {
  if (count && count > 0) {
    expandedFiles.value = [0]
  }
}, { immediate: true })

function toggleFile(idx: number) {
  const i = expandedFiles.value.indexOf(idx)
  if (i === -1) {
    expandedFiles.value.push(idx)
  } else {
    expandedFiles.value.splice(i, 1)
  }
}

function barWidth(value: number, total: number): number {
  if (total === 0) return 0
  return Math.max(2, Math.round((value / total) * 40))
}

// ─── Raw diff parser ─────────────────────────────────────────────────────────

function parseRawDiff(
  rawDiff: string,
  filesMeta: { path: string; additions: number; deletions: number }[]
): ParsedFile[] {
  if (!rawDiff) {
    // Return files from metadata with empty hunks
    return filesMeta.map(f => ({
      path: f.path,
      status: 'modified' as const,
      additions: f.additions,
      deletions: f.deletions,
      hunks: [],
    }))
  }

  const results: ParsedFile[] = []
  // Split on diff --git boundaries
  const sections = rawDiff.split(/^(?=diff --git )/m)

  for (const section of sections) {
    if (!section.trim()) continue
    const lines = section.split('\n')

    // Extract file paths from diff --git a/... b/...
    const diffHeaderLine = lines[0]
    const diffHeaderMatch = diffHeaderLine.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (!diffHeaderMatch) continue

    const oldPathRaw = diffHeaderMatch[1]
    const newPathRaw = diffHeaderMatch[2]
    const filePath = newPathRaw

    // Detect file status
    let status: ParsedFile['status'] = 'modified'
    let oldPath: string | undefined

    for (const line of lines) {
      if (line.startsWith('new file mode')) { status = 'added'; break }
      if (line.startsWith('deleted file mode')) { status = 'deleted'; break }
      if (line.startsWith('similarity index') || line.startsWith('rename from')) {
        status = 'renamed'
        oldPath = oldPathRaw !== newPathRaw ? oldPathRaw : undefined
        break
      }
    }

    // Parse hunks
    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null
    let oldLineNum = 0
    let newLineNum = 0

    // Find where hunks start (after the header block)
    let inHeader = true
    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHeader = false
        // Parse hunk header: @@ -a,b +c,d @@ optional context
        const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
        if (hunkMatch) {
          oldLineNum = parseInt(hunkMatch[1], 10)
          newLineNum = parseInt(hunkMatch[2], 10)
          currentHunk = { header: line, lines: [] }
          hunks.push(currentHunk)
        }
        continue
      }

      if (inHeader) continue
      if (!currentHunk) continue

      // No-newline indicator
      if (line === '\\ No newline at end of file') {
        currentHunk.lines.push({ type: 'no-newline', content: line })
        continue
      }

      // Addition
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', content: line.slice(1), newNum: newLineNum++ })
        continue
      }

      // Deletion
      if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'del', content: line.slice(1), oldNum: oldLineNum++ })
        continue
      }

      // Context
      if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'ctx',
          content: line.startsWith(' ') ? line.slice(1) : '',
          oldNum: oldLineNum++,
          newNum: newLineNum++,
        })
      }
    }

    // Get actual +/- counts from metadata or calculate from hunks
    const meta = filesMeta.find(f => f.path === filePath || f.path === oldPathRaw)
    const additions = meta?.additions ?? hunks.flatMap(h => h.lines).filter(l => l.type === 'add').length
    const deletions = meta?.deletions ?? hunks.flatMap(h => h.lines).filter(l => l.type === 'del').length

    results.push({ path: filePath, oldPath, status, additions, deletions, hunks })
  }

  // If parsing yielded nothing but metadata has files, fall back
  if (results.length === 0 && filesMeta.length > 0) {
    return filesMeta.map(f => ({
      path: f.path,
      status: 'modified' as const,
      additions: f.additions,
      deletions: f.deletions,
      hunks: [],
    }))
  }

  return results
}

// ─── Styling helpers ──────────────────────────────────────────────────────────

function fileStatusClass(status: ParsedFile['status']): string {
  const map: Record<string, string> = {
    added: 'bg-green-100 text-green-700',
    deleted: 'bg-red-100 text-red-700',
    modified: 'bg-blue-100 text-blue-700',
    renamed: 'bg-amber-100 text-amber-700',
    unknown: 'bg-surface-100 text-surface-500',
  }
  return map[status] ?? map.unknown
}

function fileStatusLabel(status: ParsedFile['status']): string {
  const map: Record<string, string> = {
    added: 'Added',
    deleted: 'Deleted',
    modified: 'Modified',
    renamed: 'Renamed',
    unknown: 'Changed',
  }
  return map[status] ?? 'Changed'
}

function lineRowClass(type: DiffLine['type']): string {
  const map: Record<string, string> = {
    add: 'bg-green-50/70',
    del: 'bg-red-50/70',
    ctx: 'bg-white',
    'no-newline': 'bg-amber-50',
  }
  return map[type] ?? 'bg-white'
}

function lineNumClass(type: DiffLine['type']): string {
  const map: Record<string, string> = {
    add: 'bg-green-100/60 text-green-600',
    del: 'bg-red-100/60 text-red-500',
    ctx: 'bg-surface-50 text-surface-400',
    'no-newline': 'bg-amber-50 text-amber-400',
  }
  return map[type] ?? 'bg-surface-50 text-surface-400'
}

function lineContentClass(type: DiffLine['type']): string {
  const map: Record<string, string> = {
    add: 'text-green-900',
    del: 'text-red-900',
    ctx: 'text-surface-800',
    'no-newline': 'text-amber-600 italic',
  }
  return map[type] ?? 'text-surface-800'
}

function lineSign(type: DiffLine['type']): string {
  const map: Record<string, string> = {
    add: '+',
    del: '-',
    ctx: ' ',
    'no-newline': '\\',
  }
  return map[type] ?? ' '
}

function lineSignClass(type: DiffLine['type']): string {
  const map: Record<string, string> = {
    add: 'text-green-500',
    del: 'text-red-500',
    ctx: 'text-transparent',
    'no-newline': 'text-amber-400',
  }
  return map[type] ?? 'text-transparent'
}
</script>
