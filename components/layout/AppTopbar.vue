<template>
  <header class="h-12 border-b border-surface-200 bg-white flex items-center px-4 gap-3 flex-shrink-0">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-1.5 text-sm text-surface-500">
      <NuxtLink
        v-if="workspace"
        :to="`/workspaces/${workspace.slug}`"
        class="hover:text-surface-900 transition-colors"
      >
        {{ workspace.name }}
      </NuxtLink>
      <template v-if="project">
        <ChevronRight class="w-3.5 h-3.5 text-surface-300" />
        <NuxtLink
          :to="`/workspaces/${workspace?.slug}/projects/${project.id}/board`"
          class="hover:text-surface-900 transition-colors font-medium"
        >
          {{ project.name }}
        </NuxtLink>
      </template>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <ButtonBack v-if="canGoBack" @click="router.back()" />
    </div>
  </header>
</template>

<script setup lang="ts">
import type { Workspace, Project } from '~/types'

const route = useRoute()
const router = useRouter()
const { getWorkspaceBySlug } = useWorkspace()
const { getProjectById } = useProject()

const canGoBack = computed(() => typeof window !== 'undefined' && window.history.length > 1)

const workspaceSlug = computed(() => route.params.slug as string | undefined)
const projectId = computed(() => route.params.projectId as string | undefined)

const workspace = ref<Workspace | undefined>()
const project = ref<Project | undefined>()

watch(workspaceSlug, async (slug) => {
  if (slug) {
    workspace.value = await getWorkspaceBySlug(slug)
  } else {
    workspace.value = undefined
  }
}, { immediate: true })

watch(projectId, async (id) => {
  if (id) {
    project.value = await getProjectById(id)
  } else {
    project.value = undefined
  }
}, { immediate: true })
</script>
