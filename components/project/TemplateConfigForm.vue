<template>
  <form @submit.prevent="submit" class="space-y-4">
    <!-- Common fields -->
    <div>
      <label class="block text-sm font-medium text-surface-700 mb-1.5">Project Name *</label>
      <TextInput v-model="form.name" placeholder="My Awesome Project" required />
    </div>
    <div>
      <label class="block text-sm font-medium text-surface-700 mb-1.5">Repository Name *</label>
      <TextInput v-model="form.repositoryName" placeholder="my-awesome-project" required />
    </div>

    <!-- Remote repository toggle -->
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <input v-model="form.createRemoteRepo" type="checkbox" id="createRemoteRepo" class="rounded border-surface-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" />
        <label for="createRemoteRepo" class="text-sm font-medium text-surface-700">Create and push to remote repository</label>
      </div>
      <p v-if="!form.createRemoteRepo" class="text-xs text-surface-400">The project will be created locally only. You can push to remote later.</p>
    </div>

    <!-- Remote settings section -->
    <div v-if="form.createRemoteRepo" class="space-y-4 pt-4 border-t border-surface-200">
      <!-- Platform -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1.5">Platform</label>
        <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :class="form.platform === 'github' ? 'bg-surface-900 text-white border-surface-900 dark:bg-black dark:border-black' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
          @click="form.platform = 'github'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          GitHub
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :class="form.platform === 'gitlab' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
          @click="form.platform = 'gitlab'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
          GitLab
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :class="form.platform === 'gitlab-self-hosted' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
          @click="form.platform = 'gitlab-self-hosted'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
          Self-Hosted
        </button>
      </div>
    </div>

      <!-- GitLab Self-Hosted URL -->
      <div v-if="form.platform === 'gitlab-self-hosted'">
        <label class="block text-sm font-medium text-surface-700 mb-1.5">GitLab Host URL *</label>
        <TextInput v-model="form.gitlabHost" placeholder="https://gitlab.mycompany.com" required />
      </div>

      <!-- Git config -->
      <div>
        <label class="block text-sm font-medium text-surface-700 mb-1.5">
          {{ tokenLabel }}
          <span v-if="form.platform !== 'github'" class="text-red-400">*</span>
          <span v-else class="text-surface-300 font-normal normal-case">(optional)</span>
        </label>
        <TextInput v-model="form.token" type="password" :placeholder="tokenPlaceholder" />
        <p class="text-xs text-surface-400 mt-1">{{ tokenHint }}</p>
      </div>
      <div class="flex items-center gap-2">
        <input v-model="form.isPrivate" type="checkbox" id="private" class="rounded border-surface-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" />
        <label for="private" class="text-sm text-surface-700">Private repository</label>
      </div>
    </div>

    <!-- Dynamic template variables (skip projectName since it's handled above) -->
    <div v-for="variable in nonProjectNameVariables" :key="variable.key">
      <label class="block text-sm font-medium text-surface-700 mb-1.5">
        {{ variable.label }}
        <span v-if="variable.required" class="text-red-500">*</span>
      </label>
      <TextInput
        v-if="!variable.autoGenerate"
        v-model="form.variables[variable.key]"
        :required="variable.required"
        :placeholder="variable.default"
      />
      <div v-else class="flex gap-2">
        <TextInput v-model="form.variables[variable.key]" readonly class="flex-1" />
        <Button type="button" @click="regenerate(variable)">Regenerate</Button>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <TextButton @click="$emit('back')">Back</TextButton>
      <Button type="submit" :loading="submitting">{{ form.createRemoteRepo ? 'Create & Push' : 'Create Project' }}</Button>
    </div>

    <p v-if="error" class="text-error-500 text-sm">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import type { TemplateConfig } from '~/types'

const props = defineProps<{
  template: TemplateConfig
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [data: any]
  back: []
}>()

const form = reactive({
  name: '',
  repositoryName: '',
  token: '',
  isPrivate: true,
  platform: 'github' as 'github' | 'gitlab' | 'gitlab-self-hosted',
  gitlabHost: '',
  createRemoteRepo: false,
  variables: {} as Record<string, string>,
})

const error = ref('')

// Link top-level Project Name to template variable
watch(() => form.name, (newName) => {
  if (props.template.variables.find(v => v.key === 'projectName')) {
    form.variables['projectName'] = newName
  }
})

const nonProjectNameVariables = computed(() =>
  props.template.variables.filter(v => v.key !== 'projectName')
)

const tokenLabel = computed(() => {
  if (form.platform === 'github') return 'GitHub Token'
  if (form.platform === 'gitlab') return 'GitLab Token'
  return 'GitLab Token'
})

const tokenPlaceholder = computed(() => {
  if (form.platform === 'github') return 'ghp_...'
  return 'glpat-...'
})

const tokenHint = computed(() => {
  if (form.platform === 'github') {
    return 'Used to create the remote repository and push code. Required for private repos. Create one in GitHub Settings → Developer settings → Personal access tokens.'
  }
  return 'Required to create the remote repository and push code. Create one in your GitLab profile → Access Tokens.'
})

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('')
}

onMounted(() => {
  for (const v of props.template.variables) {
    if (v.autoGenerate && v.length) {
      form.variables[v.key] = generateRandomString(v.length)
    } else if (v.default) {
      form.variables[v.key] = v.default
    }
  }
  // Initialize projectName from form.name if it exists as a variable
  if (props.template.variables.find(v => v.key === 'projectName')) {
    form.variables['projectName'] = form.name
  }
})

function regenerate(variable: TemplateConfig['variables'][number]) {
  if (variable.length) {
    form.variables[variable.key] = generateRandomString(variable.length)
  }
}

async function submit() {
  error.value = ''
  if (!form.name.trim()) {
    error.value = 'Project name is required'
    return
  }
  if (!form.repositoryName.trim()) {
    error.value = 'Repository name is required'
    return
  }
  if (form.createRemoteRepo && form.platform === 'gitlab-self-hosted' && !form.gitlabHost.trim()) {
    error.value = 'GitLab host URL is required for self-hosted'
    return
  }
  emit('submit', {
    name: form.name,
    repositoryName: form.repositoryName,
    token: form.token,
    isPrivate: form.isPrivate,
    platform: form.platform,
    gitlabHost: form.gitlabHost,
    createRemoteRepo: form.createRemoteRepo,
    variables: { ...form.variables },
  })
}
</script>