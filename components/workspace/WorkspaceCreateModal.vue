<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="$emit('close')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-md p-6 animate-scale-in">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-surface-900">Create Workspace</h3>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="$emit('close')">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Name *</label>
            <TextInput
              v-model="form.name"
              placeholder="My Workspace"
              required
              @update:model-value="handleNameChange"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Slug *</label>
            <TextInput
              v-model="form.slug"
              placeholder="my-workspace"
              required
              :error-message="slugError"
              @update:model-value="handleSlugChange"
            />
            <p class="text-xs text-surface-400 mt-1">URL: /workspaces/{{ form.slug || '...' }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
            <TextArea
              v-model="form.description"
              placeholder="What's this workspace about?"
              rows="3"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <TextButton @click="$emit('close')">Cancel</TextButton>
            <Button type="submit" :loading="creating">Create Workspace</Button>
          </div>

          <p v-if="error" class="text-error-500 text-sm">{{ error }}</p>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Workspace } from '~/types'

const emit = defineEmits<{
  close: []
  created: [workspace: Workspace]
}>()

const { createWorkspace } = useWorkspace()

const form = reactive({
  name: '',
  slug: '',
  description: '',
})

const creating = ref(false)
const error = ref('')
const slugError = ref('')
const slugTouched = ref(false)

function handleNameChange(name: string) {
  if (!slugTouched.value) {
    form.slug = slugify(name)
  }
}

function handleSlugChange(slug: string) {
  slugTouched.value = true
  form.slug = slugify(slug)
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function handleCreate() {
  if (!form.name.trim()) {
    error.value = 'Name is required'
    return
  }
  if (!form.slug.trim()) {
    slugError.value = 'Slug is required'
    return
  }
  if (!/^[a-z0-9-]+$/.test(form.slug)) {
    slugError.value = 'Slug must be lowercase alphanumeric with hyphens'
    return
  }

  creating.value = true
  error.value = ''
  slugError.value = ''

  try {
    const workspace = await createWorkspace({
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
    })
    emit('created', workspace)
  } catch (err: any) {
    if (err?.data?.statusCode === 409) {
      slugError.value = 'This slug is already taken'
    } else {
      error.value = err?.data?.message || 'Failed to create workspace'
    }
  } finally {
    creating.value = false
  }
}
</script>
