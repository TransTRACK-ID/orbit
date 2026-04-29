<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="$emit('close')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-md p-6 animate-scale-in">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-surface-900">Create Project</h3>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="$emit('close')">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Name *</label>
            <TextInput
              v-model="form.name"
              placeholder="Project name"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
            <TextArea
              v-model="form.description"
              placeholder="What's this project about?"
              rows="3"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Color</label>
            <div class="flex items-center gap-2">
              <input
                v-model="form.color"
                type="color"
                class="w-9 h-9 rounded-lg cursor-pointer border border-surface-200"
              />
              <span class="text-sm text-surface-500 font-mono">{{ form.color }}</span>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <TextButton @click="$emit('close')">Cancel</TextButton>
            <Button type="submit" :loading="creating">Create Project</Button>
          </div>

          <p v-if="error" class="text-error-500 text-sm">{{ error }}</p>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Project } from '~/types'

const props = defineProps<{
  workspaceId: string
}>()

const emit = defineEmits<{
  close: []
  created: [project: Project]
}>()

const { createProject } = useProject()

const form = reactive({
  name: '',
  description: '',
  color: '#F14848',
})

const creating = ref(false)
const error = ref('')

async function handleCreate() {
  if (!form.name.trim()) {
    error.value = 'Name is required'
    return
  }

  creating.value = true
  error.value = ''

  try {
    const project = await createProject(props.workspaceId, {
      name: form.name,
      description: form.description || undefined,
      color: form.color,
    })
    emit('created', project)
  } catch (err: any) {
    error.value = err?.data?.message || 'Failed to create project'
  } finally {
    creating.value = false
  }
}
</script>
