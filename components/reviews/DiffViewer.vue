<template>
  <div class="flex flex-col h-full min-h-0">
    <UiLoadingState v-if="loading" text="Loading diff..." class="p-8" />

    <div v-else-if="diff && parsedFiles.length > 0" class="flex flex-col flex-1 min-h-0">
      <!-- Summary -->
      <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-100 flex-shrink-0 bg-white">
        <div class="flex items-center gap-3 text-xs text-surface-600 min-w-0">
          <span class="font-semibold text-surface-900">
            {{ parsedFiles.length }} file{{ parsedFiles.length !== 1 ? 's' : '' }} changed
          </span>
          <span class="text-green-600 font-semibold tabular-nums">+{{ diff.totalAdditions }}</span>
          <span class="text-red-500 font-semibold tabular-nums">-{{ diff.totalDeletions }}</span>
        </div>

        <div v-if="parsedFiles.length > 6" class="relative flex-shrink-0">
          <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none" />
          <input
            v-model="fileSearch"
            type="search"
            placeholder="Filter files..."
            class="w-44 text-xs rounded-md border border-surface-200 bg-surface-50 pl-7 pr-2 py-1.5 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-surface-400 text-surface-700"
          />
        </div>
      </div>

      <div class="flex flex-1 min-h-0">
        <!-- File list -->
        <nav
          class="w-60 flex-shrink-0 border-r border-surface-200 overflow-y-auto bg-surface-50"
          aria-label="Changed files"
        >
          <div v-if="filteredFiles.length === 0" class="px-4 py-8 text-center">
            <p class="text-xs text-surface-500">No files match your search</p>
          </div>

          <ul v-else class="py-1">
            <li v-for="entry in filteredFiles" :key="entry.file.path">
              <button
                type="button"
                class="w-full flex items-start gap-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                :class="selectedFileIndex === entry.index
                  ? 'bg-accent/8 text-surface-900'
                  : 'text-surface-700 hover:bg-surface-100'"
                :aria-current="selectedFileIndex === entry.index ? 'true' : undefined"
                @click="selectFile(entry.index)"
              >
                <span
                  class="text-xs font-bold w-4 h-4 rounded flex items-center justify-center flex-shrink-0 font-mono mt-0.5"
                  :class="fileStatusClass(entry.file.status)"
                  :title="fileStatusLabel(entry.file.status)"
                >{{ entry.file.status.charAt(0).toUpperCase() }}</span>

                <span class="flex-1 min-w-0">
                  <span class="block text-xs font-medium truncate font-mono leading-snug">
                    {{ fileName(entry.file.path) }}
                  </span>
                  <span
                    v-if="fileDir(entry.file.path)"
                    class="block text-xs text-surface-400 truncate font-mono mt-0.5 leading-snug"
                  >
                    {{ fileDir(entry.file.path) }}
                  </span>
                  <span
                    v-if="entry.file.oldPath && entry.file.oldPath !== entry.file.path"
                    class="block text-xs text-amber-600 truncate font-mono mt-0.5 leading-snug"
                  >
                    {{ entry.file.oldPath }}
                  </span>
                </span>

                <span class="flex flex-col items-end gap-0.5 flex-shrink-0 tabular-nums">
                  <span v-if="entry.file.additions > 0" class="text-xs text-green-600 font-semibold leading-none">
                    +{{ entry.file.additions }}
                  </span>
                  <span v-if="entry.file.deletions > 0" class="text-xs text-red-500 font-semibold leading-none">
                    -{{ entry.file.deletions }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </nav>

        <!-- Diff panel -->
        <div class="flex-1 min-w-0 flex flex-col min-h-0 bg-white">
          <template v-if="selectedFile">
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-surface-100 flex-shrink-0 bg-surface-50">
              <Icon name="lucide:file-code" class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              <span class="text-xs font-mono font-medium text-surface-800 truncate">
                <span
                  v-if="selectedFile.oldPath && selectedFile.oldPath !== selectedFile.path"
                  class="text-surface-400"
                >{{ selectedFile.oldPath }} → </span>{{ selectedFile.path }}
              </span>
              <div class="ml-auto flex items-center gap-2 flex-shrink-0 tabular-nums">
                <div class="flex items-center gap-0.5 h-2.5">
                  <div
                    v-if="selectedFile.additions > 0"
                    class="h-full rounded-sm bg-green-400"
                    :style="{ width: `${barWidth(selectedFile.additions, selectedFile.additions + selectedFile.deletions)}px` }"
                  />
                  <div
                    v-if="selectedFile.deletions > 0"
                    class="h-full rounded-sm bg-red-400"
                    :style="{ width: `${barWidth(selectedFile.deletions, selectedFile.additions + selectedFile.deletions)}px` }"
                  />
                </div>
                <span class="text-xs text-green-600 font-semibold">+{{ selectedFile.additions }}</span>
                <span class="text-xs text-red-500 font-semibold">-{{ selectedFile.deletions }}</span>
              </div>
            </div>

            <div class="flex-1 min-h-0 overflow-auto">
              <div v-if="selectedFile.hunks.length > 0">
                <table class="w-full border-collapse text-xs font-mono" style="min-width: 0">
                  <tbody>
                    <template v-for="(hunk, hIdx) in selectedFile.hunks" :key="hIdx">
                      <tr class="bg-sky-50 border-y border-sky-100 select-none">
                        <td class="w-10 text-right pr-3 py-1 text-sky-400 select-none" />
                        <td class="w-10 text-right pr-3 py-1 text-sky-400 select-none" />
                        <td class="py-1 px-3 text-sky-600 font-semibold whitespace-pre">{{ hunk.header }}</td>
                      </tr>
                      <tr
                        v-for="(line, lIdx) in hunk.lines"
                        :key="lIdx"
                        class="group"
                        :class="lineRowClass(line.type)"
                      >
                        <td
                          class="w-10 text-right pr-3 py-0.5 select-none border-r border-surface-100 text-surface-400 leading-5"
                          :class="lineNumClass(line.type)"
                          style="min-width: 40px"
                        >{{ line.oldNum ?? '' }}</td>
                        <td
                          class="w-10 text-right pr-3 py-0.5 select-none border-r border-surface-100 text-surface-400 leading-5"
                          :class="lineNumClass(line.type)"
                          style="min-width: 40px"
                        >{{ line.newNum ?? '' }}</td>
                        <td class="py-0.5 pl-2 pr-4 whitespace-pre leading-5" :class="lineContentClass(line.type)">
                          <span class="select-none mr-2 font-bold" :class="lineSignClass(line.type)">{{ lineSign(line.type) }}</span>{{ line.content }}
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
              <div v-else class="flex flex-col items-center justify-center py-16 text-center px-4">
                <Icon name="lucide:binary" class="w-5 h-5 mb-2 text-surface-300" />
                <p class="text-xs text-surface-500">Binary file or no preview available</p>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center flex-1 py-12 px-4">
      <div class="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
        <Icon name="lucide:file-diff" class="w-6 h-6 text-surface-400" />
      </div>
      <p class="text-sm font-semibold text-surface-600">No diff available</p>
      <p v-if="diff?.error" class="text-xs text-red-500 mt-1.5 max-w-xs text-center leading-relaxed">{{ diff.error }}</p>
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

const fileSearch = ref('')
const selectedFileIndex = ref(0)

const parsedFiles = computed<ParsedFile[]>(() => {
  if (!props.diff) return []
  return parseRawDiff(props.diff.rawDiff, props.diff.files)
})

const filteredFiles = computed(() => {
  const query = fileSearch.value.trim().toLowerCase()
  return parsedFiles.value
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => {
      if (!query) return true
      return file.path.toLowerCase().includes(query)
        || file.oldPath?.toLowerCase().includes(query)
    })
})

const selectedFile = computed(() => parsedFiles.value[selectedFileIndex.value] ?? null)

watch(() => props.diff?.files?.length, () => {
  selectedFileIndex.value = 0
  fileSearch.value = ''
}, { immediate: true })

watch(filteredFiles, (entries) => {
  if (entries.length === 0) return
  const isSelectedVisible = entries.some(entry => entry.index === selectedFileIndex.value)
  if (!isSelectedVisible) {
    selectedFileIndex.value = entries[0].index
  }
})

function selectFile(index: number) {
  selectedFileIndex.value = index
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function fileDir(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
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
    return filesMeta.map(f => ({
      path: f.path,
      status: 'modified' as const,
      additions: f.additions,
      deletions: f.deletions,
      hunks: [],
    }))
  }

  const results: ParsedFile[] = []
  const sections = rawDiff.split(/^(?=diff --git )/m)

  for (const section of sections) {
    if (!section.trim()) continue
    const lines = section.split('\n')

    const diffHeaderLine = lines[0]
    const diffHeaderMatch = diffHeaderLine.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (!diffHeaderMatch) continue

    const oldPathRaw = diffHeaderMatch[1]
    const newPathRaw = diffHeaderMatch[2]
    const filePath = newPathRaw

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

    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null
    let oldLineNum = 0
    let newLineNum = 0

    let inHeader = true
    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHeader = false
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

      if (line === '\\ No newline at end of file') {
        currentHunk.lines.push({ type: 'no-newline', content: line })
        continue
      }

      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', content: line.slice(1), newNum: newLineNum++ })
        continue
      }

      if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'del', content: line.slice(1), oldNum: oldLineNum++ })
        continue
      }

      if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'ctx',
          content: line.startsWith(' ') ? line.slice(1) : '',
          oldNum: oldLineNum++,
          newNum: newLineNum++,
        })
      }
    }

    const meta = filesMeta.find(f => f.path === filePath || f.path === oldPathRaw)
    const additions = meta?.additions ?? hunks.flatMap(h => h.lines).filter(l => l.type === 'add').length
    const deletions = meta?.deletions ?? hunks.flatMap(h => h.lines).filter(l => l.type === 'del').length

    results.push({ path: filePath, oldPath, status, additions, deletions, hunks })
  }

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
