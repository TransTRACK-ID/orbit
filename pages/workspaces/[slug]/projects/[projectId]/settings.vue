<template>
  <div class="page-container max-w-3xl">
    <UiLoadingState v-if="loading" text="Loading settings..." />

    <template v-else-if="project">
      <h1 class="text-2xl font-bold text-surface-900 mb-8">Project Settings</h1>

      <!-- General -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">General</h2>
        <form @submit.prevent="handleUpdate" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Name</label>
            <TextInput v-model="form.name" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
            <TextArea v-model="form.description" placeholder="Project description" rows="3" />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Color</label>
            <div class="flex items-center gap-2">
              <input
                v-model="form.color"
                type="color"
                class="w-8 h-8 rounded-lg cursor-pointer border border-surface-200"
              />
              <span class="text-sm text-surface-500 font-mono">{{ form.color }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" :loading="saving">Save</Button>
            <TextButton v-if="saved" class="text-success-500">
              <Check class="w-4 h-4" />
              Saved
            </TextButton>
          </div>
        </form>
      </div>

      <!-- Statuses -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Statuses</h2>
        <div class="space-y-2">
          <div
            v-for="status in statuses"
            :key="status.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-surface-50"
          >
            <span
              class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: status.color }"
            />
            <span class="flex-1 text-sm font-medium text-surface-900">{{ status.name }}</span>
            <span class="text-xs text-surface-400">{{ status._count?.tasks || 0 }} tasks</span>
          </div>
        </div>
        <div class="mt-4">
          <OutlinedButton @click="showCreateStatus = true">
            <Plus class="w-3.5 h-3.5" />
            Add Status
          </OutlinedButton>
        </div>
      </div>

      <!-- Labels -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Labels</h2>
        <div class="flex flex-wrap gap-2 mb-4">
          <Chip
            v-for="label in labels"
            :key="label.id"
            :label="label.name"
            :color="label.color"
          />
        </div>
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <TextInput v-model="newLabel.name" placeholder="Label name" />
          </div>
          <div>
            <input
              v-model="newLabel.color"
              type="color"
              class="w-9 h-9 rounded-lg cursor-pointer border border-surface-200"
            />
          </div>
          <Button @click="handleCreateLabel" :loading="creatingLabel">
            <Plus class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="bg-white rounded-2xl border border-error-200 p-6">
        <h2 class="text-lg font-semibold text-error-600 mb-4">Danger Zone</h2>
        <p class="text-sm text-surface-500 mb-4">
          Delete this project and all its tasks permanently.
        </p>
        <Button variant="error" @click="confirmDelete = true">
          <Trash class="w-4 h-4" />
          Delete Project
        </Button>
      </div>
    </template>

    <!-- Create status modal -->
    <ModalConfirmation
      v-if="showCreateStatus"
      title="Add Status"
      confirm-text="Add"
      :is-loading="creatingStatus"
      @confirm="handleCreateStatus"
      @cancel="showCreateStatus = false"
    >
      <div class="space-y-3">
        <TextInput v-model="newStatus.name" placeholder="Status name" />
        <div class="flex items-center gap-2">
          <input
            v-model="newStatus.color"
            type="color"
            class="w-8 h-8 rounded-lg cursor-pointer border border-surface-200"
          />
          <span class="text-sm text-surface-500">Color</span>
        </div>
      </div>
    </ModalConfirmation>

    <!-- Delete confirmation -->
    <ModalConfirmation
      v-if="confirmDelete"
      title="Delete Project"
      message="Are you sure? All tasks and data will be permanently removed."
      confirm-text="Delete"
      variant="danger"
      :is-loading="deleting"
      @confirm="handleDelete"
      @cancel="confirmDelete = false"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.projectId as string)

const {
  currentProject: project,
  fetchProjectDetail,
  projectStatuses: statuses,
  projectLabels: labels,
  updateProject,
  deleteProject,
  createStatus,
  createLabel,
} = useProject()

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const confirmDelete = ref(false)
const showCreateStatus = ref(false)
const creatingStatus = ref(false)
const creatingLabel = ref(false)
const deleting = ref(false)

const form = reactive({ name: '', description: '', color: '#F14848' })
const newStatus = reactive({ name: '', color: '#94a3b8' })
const newLabel = reactive({ name: '', color: '#3b82f6' })

onMounted(async () => {
  await fetchProjectDetail(projectId.value)
  if (project.value) {
    form.name = project.value.name
    form.description = project.value.description || ''
    form.color = project.value.color
  }
  loading.value = false
})

async function handleUpdate() {
  saving.value = true
  try {
    await updateProject(projectId.value, {
      name: form.name,
      description: form.description || undefined,
      color: form.color,
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } finally {
    saving.value = false
  }
}

async function handleCreateStatus() {
  if (!newStatus.name || creatingStatus.value) return
  creatingStatus.value = true
  try {
    await createStatus(projectId.value, { name: newStatus.name, color: newStatus.color })
    showCreateStatus.value = false
    newStatus.name = ''
    newStatus.color = '#94a3b8'
  } finally {
    creatingStatus.value = false
  }
}

async function handleCreateLabel() {
  if (!newLabel.name || creatingLabel.value) return
  creatingLabel.value = true
  try {
    await createLabel(projectId.value, { name: newLabel.name, color: newLabel.color })
    newLabel.name = ''
    newLabel.color = '#3b82f6'
  } finally {
    creatingLabel.value = false
  }
}

async function handleDelete() {
  if (deleting.value) return
  deleting.value = true
  try {
    await deleteProject(projectId.value)
    const slug = route.params.slug
    router.push(`/workspaces/${slug}`)
  } finally {
    deleting.value = false
  }
}
</script>
