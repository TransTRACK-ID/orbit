<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-xl font-bold text-surface-900">Admin Dashboard</h1>
      <span class="text-[10px] text-surface-400 bg-surface-200 px-2 py-0.5 rounded-full font-semibold">Super Admin</span>
    </div>
    <p class="text-xs text-surface-400 mb-7">Analyze user behavior and projects across the platform.</p>

    <UiLoadingState v-if="status === 'loading' || (loadingStats && !stats)" text="Loading..." />

    <UiEmptyState
      v-else-if="!isSuperAdmin"
      title="Access Denied"
      description="You need super admin privileges to view this page."
      icon="lucide:shield-alert"
    />

    <template v-else-if="stats">
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        <div class="bg-white border border-surface-200 rounded-xl p-[18px]">
          <p class="text-[10px] text-surface-400 font-semibold uppercase tracking-wide">Users</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ stats.users }}</p>
          <p class="text-[10px] text-surface-400 mt-1">+{{ stats.recentUsers }} this week</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-[18px]">
          <p class="text-[10px] text-surface-400 font-semibold uppercase tracking-wide">Workspaces</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ stats.workspaces }}</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-[18px]">
          <p class="text-[10px] text-surface-400 font-semibold uppercase tracking-wide">Projects</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ stats.projects }}</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-[18px]">
          <p class="text-[10px] text-surface-400 font-semibold uppercase tracking-wide">Tasks</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ stats.tasks }}</p>
          <p class="text-[10px] text-surface-400 mt-1">+{{ stats.recentTasks }} this week</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-[18px]">
          <p class="text-[10px] text-surface-400 font-semibold uppercase tracking-wide">Comments</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ stats.comments }}</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-[18px]">
          <p class="text-[10px] text-surface-400 font-semibold uppercase tracking-wide">Activities</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ stats.activities }}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-2 mb-4 border-b border-surface-200">
        <button
          class="px-3 py-2 text-xs font-semibold transition-colors relative"
          :class="activeTab === 'users' ? 'text-accent' : 'text-surface-500 hover:text-surface-700'"
          @click="activeTab = 'users'"
        >
          Users
          <span v-if="activeTab === 'users'" class="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-full" />
        </button>
        <button
          class="px-3 py-2 text-xs font-semibold transition-colors relative"
          :class="activeTab === 'projects' ? 'text-accent' : 'text-surface-500 hover:text-surface-700'"
          @click="activeTab = 'projects'"
        >
          Projects
          <span v-if="activeTab === 'projects'" class="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-full" />
        </button>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'">
        <UiLoadingState v-if="loadingUsers && users.length === 0" text="Loading users..." />
        <div v-else-if="users.length === 0" class="text-xs text-surface-400">No users found.</div>
        <div v-else class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide">User</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Role</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Workspaces</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Tasks Created</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Assigned</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Comments</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Activities</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="u in users" :key="u.id" class="hover:bg-surface-50/50 transition-colors">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
                      {{ userInitials(u.name) }}
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-surface-900">{{ u.name }}</p>
                      <p class="text-[10px] text-surface-400">{{ u.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <span
                    class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    :class="u.role === 'super_admin' ? 'bg-accent/10 text-accent' : 'bg-surface-100 text-surface-500'"
                  >
                    {{ u.role }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ u.workspaceCount }}</td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ u.tasksCreated }}</td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ u.tasksAssigned }}</td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ u.commentsCount }}</td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ u.activitiesCount }}</td>
                <td class="px-4 py-2.5 text-[10px] text-surface-400 whitespace-nowrap">{{ formatDate(u.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Projects Tab -->
      <div v-if="activeTab === 'projects'">
        <UiLoadingState v-if="loadingProjects && projects.length === 0" text="Loading projects..." />
        <div v-else-if="projects.length === 0" class="text-xs text-surface-400">No projects found.</div>
        <div v-else class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Project</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Workspace</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Members</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Tasks</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Done</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide text-right">Comments</th>
                <th class="px-4 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="p in projects" :key="p.id" class="hover:bg-surface-50/50 transition-colors">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" :style="{ backgroundColor: p.color }">
                      <span class="text-[7px] font-bold text-white">{{ p.name.charAt(0) }}</span>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-surface-900">{{ p.name }}</p>
                      <p v-if="p.description" class="text-[10px] text-surface-400 truncate max-w-[200px]">{{ p.description }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <NuxtLink :to="`/workspaces/${p.workspace.slug}`" class="text-xs text-accent hover:underline">
                    {{ p.workspace.name }}
                  </NuxtLink>
                </td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ p.memberCount }}</td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ p.taskCount }}</td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">
                  <span :class="p.doneTaskCount > 0 ? 'text-emerald-600 font-semibold' : ''">{{ p.doneTaskCount }}</span>
                </td>
                <td class="px-4 py-2.5 text-xs text-surface-700 text-right">{{ p.commentCount }}</td>
                <td class="px-4 py-2.5 text-[10px] text-surface-400 whitespace-nowrap">{{ formatDate(p.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-if="error" class="mt-4 p-3 bg-error-50 border border-error-200 rounded-lg text-xs text-error-700">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdminStats, AdminUser, AdminProject } from '~/types'

definePageMeta({
  layout: 'default',
})

const { stats, users, projects, loadingStats, loadingUsers, loadingProjects, error, fetchStats, fetchUsers, fetchProjects } = useAdmin()
const activeTab = ref<'users' | 'projects'>('users')
const { data: session, status } = useAuth()
const isSuperAdmin = computed(() => (session.value?.user as any)?.role === 'super_admin')

// Guard: redirect non-super-admins
watchEffect(() => {
  if (status.value === 'authenticated' && !isSuperAdmin.value) {
    navigateTo('/workspaces')
  }
})

onMounted(async () => {
  if (!isSuperAdmin.value) return
  await fetchStats()
  await fetchUsers()
  await fetchProjects()
})

function userInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
