<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="$emit('close')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-lg p-6 animate-scale-in">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-surface-900">
            {{ step === 'template' ? 'Create Project' : step === 'config' ? 'Configure Template' : 'Create Project' }}
          </h3>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="$emit('close')">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <!-- Step 1: Template Gallery -->
        <div v-if="step === 'template'" class="space-y-4">
          <div v-if="!isFirstProject" class="flex items-center gap-2 mb-4">
            <button
              class="px-3 py-1.5 text-sm rounded-md transition-colors"
              :class="mode === 'blank' ? 'bg-surface-900 text-white dark:bg-black' : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-200'"
              @click="mode = 'blank'; error = ''"
            >
              Blank Project
            </button>
            <button
              class="px-3 py-1.5 text-sm rounded-md transition-colors"
              :class="mode === 'template' ? 'bg-surface-900 text-white dark:bg-black' : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-200'"
              @click="mode = 'template'; error = ''"
            >
              From Template
            </button>
          </div>

          <form v-if="mode === 'blank'" @submit.prevent="handleCreateBlank" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Name *</label>
              <TextInput v-model="blankForm.name" placeholder="Project name" required />
            </div>
            <div v-if="!isFirstProject">
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
              <TextArea v-model="blankForm.description" placeholder="What's this project about?" rows="3" />
            </div>
            <div v-if="!isFirstProject">
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Color</label>
              <div class="flex items-center gap-2">
                <input v-model="blankForm.color" type="color" class="w-9 h-9 rounded-lg cursor-pointer border border-surface-200" />
                <span class="text-sm text-surface-500 font-mono">{{ blankForm.color }}</span>
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-2">
              <TextButton @click="$emit('close')">Cancel</TextButton>
              <Button type="submit" :loading="creating">
                {{ isFirstProject ? 'Create Your First Project' : 'Create Project' }}
              </Button>
            </div>
            <p v-if="error" class="text-error-500 text-sm">{{ error }}</p>
          </form>

          <div v-else>
            <div v-if="loadingTemplates" class="py-8 text-center">
              <Loading class="w-6 h-6 mx-auto animate-spin text-surface-400" />
              <p class="text-sm text-surface-500 mt-2">Loading templates...</p>
            </div>
            <ProjectTemplateGallery
              v-else
              :templates="templates"
              @select="selectTemplate"
            />
          </div>
        </div>

        <!-- Step 2: Template Configuration -->
        <div v-else-if="step === 'config' && selectedTemplate">
          <ProjectTemplateConfigForm
            :template="selectedTemplate"
            :submitting="creating"
            @submit="handleCreateFromTemplate"
            @back="step = 'template'; mode = 'template'; error = ''"
          />
          <p v-if="error" class="text-error-500 text-sm mt-3">{{ error }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Project, TemplateConfig } from '~/types'

const props = defineProps<{
  workspaceId: string
  isFirstProject?: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [project: Project]
}>()

const { createProject } = useProject()

const step = ref<'template' | 'config'>('template')
const mode = ref<'blank' | 'template'>('blank')
const selectedTemplate = ref<TemplateConfig | null>(null)
const templates = ref<TemplateConfig[]>([])
const loadingTemplates = ref(false)

const blankForm = reactive({
  name: '',
  description: '',
  color: '#F14848',
})

const FIRST_PROJECT_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#3B82F6', // Blue
]

function getRandomColor() {
  return FIRST_PROJECT_COLORS[
    Math.floor(Math.random() * FIRST_PROJECT_COLORS.length)
  ]
}

watch(
  () => props.isFirstProject,
  (first) => {
    if (first) {
      mode.value = 'blank'
      step.value = 'template'
      selectedTemplate.value = null
    }
  },
  { immediate: true }
)

const creating = ref(false)
const error = ref('')

async function loadTemplates() {
  loadingTemplates.value = true
  try {
    const data = await $fetch<TemplateConfig[]>('/api/templates')
    templates.value = data
  } catch (err) {
    console.error('Failed to load templates:', err)
  } finally {
    loadingTemplates.value = false
  }
}

function selectTemplate(template: TemplateConfig) {
  selectedTemplate.value = template
  step.value = 'config'
  error.value = ''
}

watch(mode, (newMode) => {
  if (newMode === 'template' && templates.value.length === 0) {
    loadTemplates()
  }
})

async function handleCreateBlank() {
  if (!blankForm.name.trim()) {
    error.value = 'Name is required'
    return
  }

  creating.value = true
  error.value = ''

  try {
    const colorToUse = props.isFirstProject ? getRandomColor() : blankForm.color
    const project = await createProject(props.workspaceId, {
      name: blankForm.name,
      description: props.isFirstProject ? undefined : (blankForm.description || undefined),
      color: colorToUse,
    })
    emit('created', project)
  } catch (err: any) {
    error.value = err?.data?.message || 'Failed to create project'
  } finally {
    creating.value = false
  }
}

async function handleCreateFromTemplate(formData: any) {
  if (!selectedTemplate.value) return

  creating.value = true
  error.value = ''

  try {
    const result = await $fetch<{ project: Project }>(`/api/workspaces/${props.workspaceId}/projects.from-template`, {
      method: 'POST',
      body: {
        name: formData.name,
        templateId: selectedTemplate.value.id,
        repositoryName: formData.repositoryName,
        token: formData.token,
        isPrivate: formData.isPrivate,
        variables: formData.variables,
        platform: formData.platform,
        gitlabHost: formData.gitlabHost,
        createRemoteRepo: true,
      },
    })
    emit('created', result.project)
  } catch (err: any) {
    error.value = err?.data?.message || 'Failed to create project from template'
  } finally {
    creating.value = false
  }
}
</script>
