<template>
  <div class="page-container max-w-3xl">
    <div v-if="workspace">
      <h1 class="text-2xl font-bold text-surface-900 mb-8">Workspace Settings</h1>

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
            <TextArea v-model="form.description" placeholder="What's this workspace about?" rows="3" />
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" :loading="saving">Save</Button>
            <TextButton
              v-if="saved"
              class="text-success-500"
            >
              <Check class="w-4 h-4" />
              Saved
            </TextButton>
          </div>
        </form>
      </div>

      <!-- Repository -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Repository</h2>
        <p class="text-xs text-surface-400 mb-4">
          Connect a repository so agents can clone, create branches, and start working from tasks.
        </p>
        <form @submit.prevent="handleRepoUpdate" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Repository URL</label>
            <TextInput
              v-model="form.repositoryUrl"
              placeholder="https://github.com/org/repo or git@github.com:org/repo.git"
            />
            <p class="text-[10px] text-surface-400 mt-1">Supports GitHub and self-hosted GitLab</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Default Branch</label>
            <TextInput v-model="form.defaultBranch" placeholder="main" />
          </div>
          <div class="flex items-start gap-3 pt-1">
            <input
              id="create-branch"
              v-model="form.createBranch"
              type="checkbox"
              class="mt-0.5 w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent"
            />
            <div>
              <label for="create-branch" class="text-sm font-medium text-surface-700 cursor-pointer">
                Always create a new branch
              </label>
              <p class="text-[10px] text-surface-400">
                Agents will create a new branch from the default branch before starting work.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" :loading="repoSaving">Save Repository</Button>
            <TextButton v-if="repoSaved" class="text-success-500">
              <Check class="w-4 h-4" />
              Saved
            </TextButton>
          </div>
        </form>
      </div>

      <!-- Members -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-surface-900">Members</h2>
          <Button @click="showInvite = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" class="w-4 h-4"><path fill="currentColor" d="M256 136a8 8 0 0 1-8 8h-16v16a8 8 0 0 1-16 0v-16h-16a8 8 0 0 1 0-16h16v-16a8 8 0 0 1 16 0v16h16a8 8 0 0 1 8 8Zm-57.86 43.69a8 8 0 0 1-11.15-1.86A71.58 71.58 0 0 0 128 160a40 40 0 1 0-40-40a40 40 0 0 0 40 40a71.58 71.58 0 0 0 58.99-17.83a8 8 0 1 0-11.31-11.32A55.47 55.47 0 0 1 128 152a24 24 0 1 1 24-24a24 24 0 0 1-24 24a55.47 55.47 0 0 1-47.68-26.15a8 8 0 1 0-13.87 8A71.46 71.46 0 0 0 88 163.27a72.08 72.08 0 0 0-40.53 26.83A8 8 0 0 0 54.6 198.6a56 56 0 0 1 100.79-11.88a56 56 0 0 1 37.53 15.36a8 8 0 0 0 11.23-.39a8 8 0 0 0 .77-10.39Zm-99.37-75.19a24 24 0 1 1-24-24a24 24 0 0 1 24 24Z"/></svg>
            Invite
          </Button>
        </div>
        <WorkspaceMemberList :workspace-id="workspace.id" />
      </div>

      <!-- Danger zone -->
      <div class="bg-white rounded-2xl border border-error-200 p-6">
        <h2 class="text-lg font-semibold text-error-600 mb-4">Danger Zone</h2>
        <p class="text-sm text-surface-500 mb-4">
          Once you delete a workspace, there is no going back. Please be certain.
        </p>
        <Button
          variant="error"
          @click="confirmDelete = true"
        >
          <Trash class="w-4 h-4" />
          Delete Workspace
        </Button>
      </div>
    </div>

    <UiLoadingState v-else text="Loading settings..." />

    <!-- Invite modal -->
    <ModalConfirmation
      v-if="showInvite"
      title="Invite Member"
      confirm-text="Invite"
      @confirm="handleInvite"
      @cancel="showInvite = false"
    >
      <TextInput
        v-model="inviteEmail"
        type="email"
        placeholder="Enter email address"
        class="mb-3"
      />
    </ModalConfirmation>

    <!-- Delete confirmation -->
    <ModalConfirmation
      v-if="confirmDelete"
      title="Delete Workspace"
      message="Are you sure you want to delete this workspace? All projects and data will be permanently removed."
      confirm-text="Delete"
      variant="danger"
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
const { getWorkspaceBySlug, updateWorkspace, deleteWorkspace } = useWorkspace()

const slug = computed(() => route.params.slug as string)
const workspace = ref<any>(null)
const form = reactive({ name: '', description: '', repositoryUrl: '', defaultBranch: 'main', createBranch: true })
const saving = ref(false)
const saved = ref(false)
const repoSaving = ref(false)
const repoSaved = ref(false)
const showInvite = ref(false)
const inviteEmail = ref('')
const confirmDelete = ref(false)

onMounted(async () => {
  workspace.value = await getWorkspaceBySlug(slug.value)
  if (workspace.value) {
    form.name = workspace.value.name
    form.description = workspace.value.description || ''
    form.repositoryUrl = workspace.value.repositoryUrl || ''
    form.defaultBranch = workspace.value.defaultBranch || 'main'
    form.createBranch = workspace.value.createBranch
  }
})

async function handleUpdate() {
  if (!workspace.value) return
  saving.value = true
  try {
    workspace.value = await updateWorkspace(workspace.value.id, {
      name: form.name,
      description: form.description || undefined,
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } finally {
    saving.value = false
  }
}

async function handleRepoUpdate() {
  if (!workspace.value) return
  repoSaving.value = true
  try {
    workspace.value = await updateWorkspace(workspace.value.id, {
      repositoryUrl: form.repositoryUrl || null,
      defaultBranch: form.defaultBranch || 'main',
      createBranch: form.createBranch,
    })
    repoSaved.value = true
    setTimeout(() => { repoSaved.value = false }, 2000)
  } finally {
    repoSaving.value = false
  }
}

async function handleInvite() {
  if (!workspace.value || !inviteEmail.value) return
  try {
    await useWorkspace().inviteMember(workspace.value.id, inviteEmail.value)
    showInvite.value = false
    inviteEmail.value = ''
  } catch (err: any) {
    console.error('Invite failed:', err)
  }
}

async function handleDelete() {
  if (!workspace.value) return
  await deleteWorkspace(workspace.value.id)
  router.push('/workspaces')
}
</script>
