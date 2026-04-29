<template>
  <div ref="el" v-if="workspaces.length > 0" class="relative">
    <button
      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-200 transition-colors text-left"
      @click.stop="open = !open"
    >
      <div
        class="w-5 h-5 rounded-md bg-primary-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0"
      >
        {{ currentWorkspace?.name?.charAt(0) || 'W' }}
      </div>
      <span class="flex-1 text-sm font-medium text-surface-900 truncate">
        {{ currentWorkspace?.name || 'Select workspace' }}
      </span>
      <ChevronDown class="w-3.5 h-3.5 text-surface-400" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg border border-surface-200 shadow-lg py-1"
    >
      <button
        v-for="ws in workspaces"
        :key="ws.id"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors text-left"
        :class="{ 'bg-primary-50 text-primary-700': ws.id === currentWorkspace?.id }"
        @click="selectWorkspace(ws)"
      >
        <div
          class="w-5 h-5 rounded bg-surface-200 text-surface-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        >
          {{ ws.name.charAt(0) }}
        </div>
        <span class="truncate">{{ ws.name }}</span>
      </button>
    </div>
  </div>

  <div v-else class="text-xs text-surface-400 text-center py-2">
    No workspaces
  </div>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

const route = useRoute()
const router = useRouter()
const { workspaces, fetchWorkspaces } = useWorkspace()

const open = ref(false)
const el = ref<HTMLElement | null>(null)

const currentWorkspaceSlug = computed(() => route.params.slug as string)

const currentWorkspace = computed<Workspace | undefined>(() =>
  workspaces.value?.find((w: Workspace) => w.slug === currentWorkspaceSlug.value)
)

function selectWorkspace(ws: Workspace) {
  open.value = false
  router.push(`/workspaces/${ws.slug}`)
}

onMounted(async () => {
  if (!workspaces.value || workspaces.value.length === 0) {
    await fetchWorkspaces()
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (el.value && !el.value.contains(e.target as Node)) {
    open.value = false
  }
}
</script>
