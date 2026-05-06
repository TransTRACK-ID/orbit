<template>
  <header class="h-[52px] flex items-center gap-2.5 px-4 bg-white border-b border-surface-200 flex-shrink-0 z-30">
    <!-- Mobile toggle -->
    <button class="hidden max-lg:flex w-7 h-7 items-center justify-center rounded border border-surface-200 text-surface-500" @click="toggleSidebar">
      <Icon name="lucide:menu" class="w-3.5 h-3.5" />
    </button>

    <!-- Brand + Breadcrumb -->
    <div class="flex items-center gap-2.5">
      <div class="brand flex items-center gap-1.5 font-bold text-sm tracking-tight text-surface-900">
        <Icon name="lucide:bolt" class="w-4 h-4 text-accent" />
        Kanvas
      </div>
      <div class="flex items-center gap-1.5 text-xs text-surface-400">
        <span
          class="cursor-pointer px-1.5 py-0.5 rounded hover:text-surface-900 hover:bg-surface-100 transition-colors"
          @click="navigateTo('/workspaces')"
        >Workspaces</span>
        <Icon v-if="breadcrumbWs" name="lucide:chevron-right" class="w-2.5 h-2.5 text-surface-200" />
        <span
          v-if="breadcrumbWs"
          class="cursor-pointer px-1.5 py-0.5 rounded hover:text-surface-900 hover:bg-surface-100 transition-colors"
          @click="navigateTo(`/workspaces/${breadcrumbWsSlug}`)"
        >{{ breadcrumbWs }}</span>
        <Icon v-if="breadcrumbProject" name="lucide:chevron-right" class="w-2.5 h-2.5 text-surface-200" />
        <span
          v-if="breadcrumbProject"
          class="font-semibold text-surface-900 cursor-default px-1.5 py-0.5 rounded"
        >{{ breadcrumbProject }}</span>
      </div>
    </div>

    <!-- Search -->
    <div class="flex-1 flex justify-center max-w-xs ml-auto">
      <div class="relative w-full max-w-[280px]">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400" />
        <input
          type="text"
          :value="searchQuery"
          placeholder="Search tasks..."
          class="w-full py-1.5 pl-8 pr-3 rounded-lg bg-surface-50 border border-transparent text-xs focus:border-accent focus:bg-white transition-colors outline-none"
          @input="emit('search', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 ml-auto">
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 text-[11px] font-semibold hover:bg-surface-50 transition-colors"
        @click="navigateTo('/agents')"
      >
        <Icon name="lucide:bot" class="w-3 h-3" />
        <span class="max-sm:hidden">Agents</span>
        <span class="bg-accent text-white px-1 rounded-full text-[9px] font-bold leading-4">{{ agentCount }}</span>
      </button>
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 text-[11px] font-semibold hover:bg-surface-50 transition-colors max-sm:hidden"
        @click="toggleLog"
      >
        <Icon name="lucide:terminal" class="w-3 h-3" />
        Logs
      </button>
      <button
        class="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full border border-surface-200 hover:bg-surface-50 transition-colors"
      >
        <div class="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold">
          {{ userInitials }}
        </div>
        <span class="text-[11px] font-semibold whitespace-nowrap max-sm:hidden">{{ userName }}</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { agents, fetchAgents } = useAgent()
const { toggle: toggleLog } = useLog()

const emit = defineEmits<{
  search: [query: string]
}>()

const searchQuery = ref('')

const breadcrumbWs = computed(() => route.params.slug as string | undefined)
const breadcrumbWsSlug = computed(() => route.params.slug as string)

const { getProjectById } = useProject()
const projectName = ref<string>()
watch(() => route.params.projectId, async (projectId) => {
  if (projectId) {
    const project = await getProjectById(projectId as string)
    projectName.value = project?.name || (projectId as string)
  } else {
    projectName.value = undefined
  }
}, { immediate: true })

const breadcrumbProject = computed(() => projectName.value)

const agentCount = computed(() => agents.value.length)

onMounted(() => {
  if (agents.value.length === 0) fetchAgents()
})

const { data: session } = useAuth()
const user = computed(() => (session.value?.user as any) || { name: 'Alex Chen' })
const userName = computed(() => user.value?.name || 'Alex Chen')
const userInitials = computed(() => {
  const name = userName.value
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
})

const { toggle: toggleSidebar } = useSidebar()
</script>
