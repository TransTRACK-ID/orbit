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

    <!-- Dynamic template variables -->
    <div v-for="variable in template.variables" :key="variable.key">
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

    <!-- Git config -->
    <div>
      <label class="block text-sm font-medium text-surface-700 mb-1.5">GitHub Token</label>
      <TextInput v-model="form.token" type="password" placeholder="ghp_..." />
    </div>
    <div class="flex items-center gap-2">
      <input v-model="form.isPrivate" type="checkbox" id="private" class="rounded border-surface-300" />
      <label for="private" class="text-sm text-surface-700">Private repository</label>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <TextButton @click="$emit('back')">Back</TextButton>
      <Button type="submit" :loading="submitting">Create & Push</Button>
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
  variables: {} as Record<string, string>,
})

const error = ref('')

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
  emit('submit', {
    name: form.name,
    repositoryName: form.repositoryName,
    token: form.token,
    isPrivate: form.isPrivate,
    variables: { ...form.variables },
  })
}
</script>
