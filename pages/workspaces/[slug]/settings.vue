<template>
  <div class="flex-1 overflow-y-auto py-7 px-8">
    <div class="max-w-3xl mx-auto">
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

      <!-- Repositories -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-lg font-semibold text-surface-900">Repositories</h2>
          <Button @click="showAddRepo = true" v-if="!showAddRepo">
            <Icon name="lucide:plus" class="w-3.5 h-3.5" />
            Add Repository
          </Button>
        </div>
        <p class="text-xs text-surface-400 mb-4">
          Connect repositories so agents can clone, create branches, and start working from tasks.
        </p>

        <!-- Add repo form -->
        <div v-if="showAddRepo" class="mb-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
          <h3 class="text-sm font-semibold text-surface-900 mb-3">New Repository</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Name</label>
              <TextInput v-model="newRepo.name" placeholder="e.g. frontend, backend-api" />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">URL</label>
              <TextInput v-model="newRepo.url" placeholder="https://github.com/org/repo.git" />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Default Branch</label>
              <TextInput v-model="newRepo.defaultBranch" placeholder="main" />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Platform</label>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  :class="newRepo.platform === 'github' ? 'bg-surface-900 text-white border-surface-900' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
                  @click="newRepo.platform = 'github'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  GitHub
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  :class="newRepo.platform === 'gitlab' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
                  @click="newRepo.platform = 'gitlab'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
                  GitLab
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  :class="newRepo.platform === 'gitlab-self-hosted' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
                  @click="newRepo.platform = 'gitlab-self-hosted'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
                  Self-Hosted
                </button>
              </div>
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">
                Access Token
                <span v-if="newRepo.platform !== 'github'" class="text-red-400">*</span>
                <span v-else class="text-surface-300 font-normal normal-case">(optional)</span>
              </label>
              <TextInput v-model="newRepo.token" :placeholder="newRepo.platform === 'github' ? 'ghp_xxxxxxxxxxxxxxxxxxxx' : 'glpat-xxxxxxxx or personal access token'" type="password" />
              <p class="text-[10px] text-surface-400 mt-1">
                <template v-if="newRepo.platform === 'github'">
                  Used for all GitHub operations including fetching comments in detail tasks. Required for private repos, pushing, and creating PRs. Create one in GitHub Settings → Developer settings → Personal access tokens.
                </template>
                <template v-else>
                  Required for GitLab API access. Create one in your GitLab profile → Access Tokens.
                </template>
              </p>
            </div>
            <div class="flex items-start gap-3">
              <input
                v-model="newRepo.createBranch"
                type="checkbox"
                class="mt-0.5 w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent"
              />
              <div>
                <label class="text-sm font-medium text-surface-700 cursor-pointer">Always create a new branch</label>
                <p class="text-[10px] text-surface-400">Agents will create a new branch from default before starting work.</p>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-4">
            <Button @click="handleAddRepo" :loading="addRepoLoading">Add</Button>
            <OutlinedButton @click="cancelAddRepo">Cancel</OutlinedButton>
          </div>
        </div>

        <!-- Repo list -->
        <div v-if="repos.length === 0 && !showAddRepo" class="text-center py-8 text-surface-400">
          <Icon name="lucide:git-branch" class="w-6 h-6 mx-auto mb-2" />
          <p class="text-xs">No repositories connected yet.</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="repo in repos"
            :key="repo.id"
            class="rounded-xl border border-surface-200 p-4"
          >
            <!-- Display mode -->
            <template v-if="editingRepoId !== repo.id">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1.5">
                    <Icon name="lucide:folder" class="w-4 h-4 text-accent flex-shrink-0" />
                    <span class="text-sm font-semibold text-surface-900">{{ repo.name }}</span>
                  </div>
                  <div class="text-[11px] text-surface-500 font-mono truncate mb-2">{{ repo.url }}</div>
                  <div class="flex items-center gap-4 text-[10px] text-surface-400">
                    <span class="flex items-center gap-1">
                      <Icon name="lucide:git-branch" class="w-3 h-3" />
                      {{ repo.defaultBranch }}
                    </span>
                    <span v-if="repo.createBranch" class="flex items-center gap-1 text-accent">
                      <span class="w-1.5 h-1.5 rounded-full bg-accent" />
                      Auto-create branch
                    </span>
                    <span
                      class="flex items-center gap-1"
                      :class="repo.platform?.startsWith('gitlab') ? 'text-orange-500' : 'text-surface-400'"
                    >
                      <template v-if="repo.platform?.startsWith('gitlab')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
                        {{ repo.platform === 'gitlab-self-hosted' ? 'Self-Hosted' : 'GitLab' }}
                      </template>
                      <template v-else>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        GitHub
                      </template>
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-100 transition-colors text-surface-400 hover:text-surface-700"
                    @click="startEditRepo(repo)"
                  >
                    <Icon name="lucide:pencil" class="w-3.5 h-3.5" />
                  </button>
                  <button
                    class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors text-surface-400 hover:text-red-500"
                    @click="handleDeleteRepo(repo.id)"
                  >
                    <Icon name="lucide:trash-2" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </template>

            <!-- Edit mode -->
            <template v-else>
              <h3 class="text-sm font-semibold text-surface-900 mb-3">Edit Repository</h3>
              <div class="space-y-3">
                <div>
                  <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Name</label>
                  <TextInput v-model="editRepo.name" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">URL</label>
                  <TextInput v-model="editRepo.url" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Default Branch</label>
                  <TextInput v-model="editRepo.defaultBranch" />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Platform</label>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                      :class="editRepo.platform === 'github' ? 'bg-surface-900 text-white border-surface-900' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
                      @click="editRepo.platform = 'github'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      GitHub
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                      :class="editRepo.platform === 'gitlab' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
                      @click="editRepo.platform = 'gitlab'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
                      GitLab
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                      :class="editRepo.platform === 'gitlab-self-hosted' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'"
                      @click="editRepo.platform = 'gitlab-self-hosted'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="inline -mt-0.5 mr-1"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z"/></svg>
                      Self-Hosted
                    </button>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1">
                    Access Token
                    <span v-if="editRepo.platform !== 'github'" class="text-red-400">*</span>
                    <span v-else class="text-surface-300 font-normal normal-case">(optional)</span>
                  </label>
                  <TextInput v-model="editRepo.token" :placeholder="editRepo.platform === 'github' ? 'ghp_xxxxxxxxxxxxxxxxxxxx' : 'glpat-xxxxxxxx or personal access token'" type="password" />
                  <p class="text-[10px] text-surface-400 mt-1">
                    <template v-if="editRepo.platform === 'github'">
                      Used for all GitHub operations including fetching comments in detail tasks. Required for private repos, pushing, and creating PRs. Create one in GitHub Settings → Developer settings → Personal access tokens.
                    </template>
                    <template v-else>
                      Required for GitLab API access. Create one in your GitLab profile → Access Tokens.
                    </template>
                  </p>
                </div>
                <div class="flex items-start gap-3">
                  <input
                    v-model="editRepo.createBranch"
                    type="checkbox"
                    class="mt-0.5 w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent"
                  />
                  <div>
                    <label class="text-sm font-medium text-surface-700 cursor-pointer">Always create a new branch</label>
                  </div>
                </div>

                <!-- Environment Variables for this repository -->
                <div class="border-t border-surface-200 pt-4 mt-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-semibold text-surface-900">Environment Variables</h4>
                    <button
                      class="text-xs text-accent hover:text-accent-600 font-medium"
                      @click="startAddRepoEnvVar(repo.id)"
                    >
                      + Add
                    </button>
                  </div>
                  <p class="text-[10px] text-surface-400 mb-2">
                    Injected into dev server during Browser QA for this repository.
                  </p>

                  <!-- Add env var form for repo -->
                  <div v-if="addingEnvVarRepoId === repo.id" class="mb-2 p-3 rounded-lg bg-surface-50 border border-surface-200">
                    <div class="space-y-2">
                      <div>
                        <label class="block text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Key</label>
                        <TextInput v-model="newRepoEnvVar.key" placeholder="e.g. AUTH_ORIGIN" size="sm" />
                      </div>
                      <div>
                        <label class="block text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Value</label>
                        <TextInput v-model="newRepoEnvVar.value" placeholder="http://localhost:3000" size="sm" />
                      </div>
                    </div>
                    <div class="flex items-center gap-2 mt-2">
                      <Button size="sm" @click="handleAddRepoEnvVar(repo.id)" :loading="addRepoEnvVarLoading">Add</Button>
                      <OutlinedButton size="sm" @click="cancelAddRepoEnvVar">Cancel</OutlinedButton>
                    </div>
                  </div>

                  <!-- Repo env var list -->
                  <div v-if="(repoEnvVars[repo.id] || []).length === 0" class="text-center py-4 text-surface-400">
                    <p class="text-[10px]">No env vars configured.</p>
                  </div>
                  <div v-else class="space-y-1">
                    <div
                      v-for="envVar in repoEnvVars[repo.id] || []"
                      :key="envVar.id"
                      class="flex items-center justify-between gap-2 rounded-lg border border-surface-200 p-2"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="text-[10px] font-semibold text-surface-900 font-mono">{{ envVar.key }}</div>
                        <div class="text-[10px] text-surface-500 font-mono truncate">{{ envVar.value }}</div>
                      </div>
                      <button
                        class="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 transition-colors text-surface-400 hover:text-red-500 flex-shrink-0"
                        @click="handleDeleteRepoEnvVar(repo.id, envVar.id)"
                      >
                        <Icon name="lucide:trash-2" class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 mt-4">
                <Button @click="handleEditRepo(repo.id)" :loading="editRepoLoading">Save</Button>
                <OutlinedButton @click="editingRepoId = null">Cancel</OutlinedButton>
              </div>
            </template>
          </div>
        </div>
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const { getWorkspaceBySlug, updateWorkspace, deleteWorkspace } = useWorkspace()
const { repositories: repos, fetchRepositories, createRepository, updateRepository, deleteRepository } = useRepository()

const slug = computed(() => route.params.slug as string)
const workspace = ref<any>(null)
const form = reactive({ name: '', description: '' })
const saving = ref(false)
const saved = ref(false)
const showInvite = ref(false)
const inviteEmail = ref('')
const confirmDelete = ref(false)

// Repository state
const showAddRepo = ref(false)
const newRepo = reactive({ name: '', url: '', defaultBranch: 'main', createBranch: true, platform: 'github' as 'github' | 'gitlab' | 'gitlab-self-hosted', token: '' })
const editingRepoId = ref<string | null>(null)
const editRepo = reactive({ name: '', url: '', defaultBranch: 'main', createBranch: true, platform: 'github' as 'github' | 'gitlab' | 'gitlab-self-hosted', token: '' })
const addRepoLoading = ref(false)
const editRepoLoading = ref(false)

// Repository environment variables state
const addingEnvVarRepoId = ref<string | null>(null)
const newRepoEnvVar = reactive({ key: '', value: '' })
const addRepoEnvVarLoading = ref(false)
const repoEnvVars = ref<Record<string, any[]>>({})

async function fetchRepoEnvVars(repositoryId: string) {
  try {
    const result = await $fetch(`/api/repositories/${repositoryId}/env-vars`)
    repoEnvVars.value[repositoryId] = result
  } catch (err) {
    console.error('Failed to load repo env vars:', err)
  }
}

function startAddRepoEnvVar(repositoryId: string) {
  addingEnvVarRepoId.value = repositoryId
  newRepoEnvVar.key = ''
  newRepoEnvVar.value = ''
}

function cancelAddRepoEnvVar() {
  addingEnvVarRepoId.value = null
  newRepoEnvVar.key = ''
  newRepoEnvVar.value = ''
}

async function handleAddRepoEnvVar(repositoryId: string) {
  if (!newRepoEnvVar.key || !newRepoEnvVar.value) return
  addRepoEnvVarLoading.value = true
  try {
    await $fetch(`/api/repositories/${repositoryId}/env-vars`, {
      method: 'POST',
      body: { key: newRepoEnvVar.key, value: newRepoEnvVar.value },
    })
    newRepoEnvVar.key = ''
    newRepoEnvVar.value = ''
    addingEnvVarRepoId.value = null
    await fetchRepoEnvVars(repositoryId)
  } finally {
    addRepoEnvVarLoading.value = false
  }
}

async function handleDeleteRepoEnvVar(repositoryId: string, envVarId: string) {
  if (!confirm('Delete this environment variable?')) return
  try {
    await $fetch(`/api/repositories/${repositoryId}/env-vars/${envVarId}`, {
      method: 'DELETE',
    })
    await fetchRepoEnvVars(repositoryId)
  } catch (err) {
    console.error('Failed to delete repo env var:', err)
  }
}

onMounted(async () => {
  workspace.value = await getWorkspaceBySlug(slug.value)
  if (workspace.value) {
    form.name = workspace.value.name
    form.description = workspace.value.description || ''
    fetchRepositories(workspace.value.id)
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

async function handleAddRepo() {
  if (!workspace.value || !newRepo.name || !newRepo.url) return
  addRepoLoading.value = true
  try {
    await createRepository(workspace.value.id, { ...newRepo })
    newRepo.name = ''
    newRepo.url = ''
    newRepo.defaultBranch = 'main'
    newRepo.createBranch = true
    newRepo.platform = 'github'
    newRepo.token = ''
    showAddRepo.value = false
  } finally {
    addRepoLoading.value = false
  }
}

function cancelAddRepo() {
  showAddRepo.value = false
  newRepo.name = ''
  newRepo.url = ''
  newRepo.defaultBranch = 'main'
  newRepo.createBranch = true
  newRepo.platform = 'github'
  newRepo.token = ''
}

function startEditRepo(repo: any) {
  editingRepoId.value = repo.id
  editRepo.name = repo.name
  editRepo.url = repo.url
  editRepo.defaultBranch = repo.defaultBranch
  editRepo.createBranch = repo.createBranch
  editRepo.platform = repo.platform || 'github'
  editRepo.token = repo.token || ''
  fetchRepoEnvVars(repo.id)
}

async function handleEditRepo(repoId: string) {
  if (!workspace.value || !editRepo.name || !editRepo.url) return
  editRepoLoading.value = true
  try {
    await updateRepository(workspace.value.id, repoId, { ...editRepo })
    editingRepoId.value = null
  } finally {
    editRepoLoading.value = false
  }
}

async function handleDeleteRepo(repoId: string) {
  if (!workspace.value) return
  if (!confirm('Delete this repository? This cannot be undone.')) return
  await deleteRepository(workspace.value.id, repoId)
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
