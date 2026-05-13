<template>
  <div>
    <UiLoadingState v-if="loading" text="Loading diff..." />

    <div v-else-if="diff && diff.files.length > 0" class="border border-surface-200 rounded-lg overflow-hidden">
      <!-- Summary bar -->
      <div class="px-3 py-2 bg-surface-50 border-b border-surface-200 flex items-center gap-3 text-[11px]">
        <span class="text-surface-600">{{ diff.files.length }} file{{ diff.files.length > 1 ? 's' : '' }} changed</span>
        <span class="text-green-600 font-medium">+{{ diff.totalAdditions }}</span>
        <span class="text-red-500 font-medium">-{{ diff.totalDeletions }}</span>
      </div>

      <!-- File list -->
      <div class="divide-y divide-surface-100 max-h-96 overflow-y-auto">
        <div
          v-for="(file, idx) in diff.files"
          :key="file.path"
          class="px-3 py-2"
        >
          <button
            class="w-full flex items-center justify-between text-left"
            @click="toggleFile(idx)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Icon
                name="lucide:file-code"
                class="w-3.5 h-3.5 text-surface-400 flex-shrink-0"
              />
              <span class="text-[11px] font-medium text-surface-700 truncate font-mono">{{ file.path }}</span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <div class="flex items-center gap-1">
                <div class="h-1 rounded-full bg-green-400" :style="{ width: `${barWidth(file.additions, file.additions + file.deletions)}px` }" />
                <div class="h-1 rounded-full bg-red-400" :style="{ width: `${barWidth(file.deletions, file.additions + file.deletions)}px` }" />
              </div>
              <span class="text-[10px] text-green-600 font-medium">+{{ file.additions }}</span>
              <span class="text-[10px] text-red-500 font-medium">-{{ file.deletions }}</span>
              <Icon
                name="lucide:chevron-down"
                class="w-3 h-3 text-surface-400 transition-transform"
                :class="{ 'rotate-180': expandedFiles.includes(idx) }"
              />
            </div>
          </button>

          <!-- File diff preview -->
          <div
            v-if="expandedFiles.includes(idx)"
            class="mt-2 rounded bg-slate-50 border border-slate-200 overflow-auto max-h-80"
          >
            <pre class="text-[10px] leading-relaxed p-2 font-mono"><code>{{ fileDiffPreview(file.path) }}</code></pre>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-6 text-sm">
      <p class="text-surface-400">No diff available</p>
      <p v-if="diff?.error" class="text-error-500 mt-1 text-xs">{{ diff.error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  diff: { files: any[]; totalAdditions: number; totalDeletions: number; rawDiff: string } | null
  loading?: boolean
}>()

const expandedFiles = ref<number[]>([])

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

function fileDiffPreview(filePath: string): string {
  if (!props.diff?.rawDiff) return ''
  const lines = props.diff.rawDiff.split('\n')
  let collecting = false
  const out: string[] = []
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (collecting) break
      collecting = line.includes(filePath)
      if (collecting) out.push(line)
      continue
    }
    if (collecting) {
      out.push(line)
    }
  }
  // Limit preview length
  if (out.length > 60) {
    return out.slice(0, 60).join('\n') + '\n... (truncated)'
  }
  return out.join('\n')
}
</script>
