<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="$emit('close')">
      <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-md p-6 animate-scale-in">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-surface-900">Create Task</h3>
          <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="$emit('close')">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Title *</label>
            <TextInput
              ref="titleInput"
              v-model="form.title"
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Status</label>
            <select
              v-model="form.statusId"
              class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option v-for="s in statuses" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Priority</label>
            <select
              v-model="form.priority"
              class="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              <option value="none">None</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
            <TextArea
              v-model="form.description"
              placeholder="Add a description..."
              rows="3"
            />
          </div>

          <div v-if="labels.length > 0">
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Labels</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="label in labels"
                :key="label.id"
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                :class="selectedLabels.includes(label.id)
                  ? 'border-transparent text-white'
                  : 'border-surface-200 text-surface-600 hover:border-surface-300'"
                :style="selectedLabels.includes(label.id) ? { backgroundColor: label.color } : {}"
                @click="toggleLabel(label.id)"
              >
                {{ label.name }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button class="py-2.5 px-3.5 text-sm font-semibold rounded-lg text-surface-600 hover:text-surface-900 transition-colors" @click="$emit('close')" type="button">Cancel</button>
            <Button type="submit" :loading="creating">
              <Plus class="w-4 h-4" />
              Create Task
            </Button>
          </div>

          <p v-if="error" class="text-error-500 text-sm">{{ error }}</p>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Status, Label, Task } from '~/types'

const props = defineProps<{
  statuses: Status[]
  labels: Label[]
  projectId: string
}>()

const emit = defineEmits<{
  close: []
  created: [task: Task]
}>()

const { createTask } = useTask()

const titleInput = ref<InstanceType<typeof TextInput> | null>(null)

const form = reactive({
  title: '',
  statusId: props.statuses[0]?.id || '',
  priority: 'none' as string,
  description: '',
})

const selectedLabels = ref<string[]>([])
const creating = ref(false)
const error = ref('')

function toggleLabel(labelId: string) {
  const idx = selectedLabels.value.indexOf(labelId)
  if (idx === -1) {
    selectedLabels.value.push(labelId)
  } else {
    selectedLabels.value.splice(idx, 1)
  }
}

async function handleCreate() {
  if (!form.title.trim()) {
    error.value = 'Title is required'
    return
  }
  if (!form.statusId) {
    error.value = 'Status is required'
    return
  }

  creating.value = true
  error.value = ''

  try {
    const task = await createTask(props.projectId, {
      title: form.title,
      statusId: form.statusId,
      priority: form.priority,
      description: form.description || undefined,
      labelIds: selectedLabels.value.length > 0 ? selectedLabels.value : undefined,
    })
    emit('created', task)
  } catch (err: any) {
    error.value = err?.data?.message || 'Failed to create task'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  setTimeout(() => titleInput.value?.$el?.querySelector('input')?.focus(), 100)
})
</script>
