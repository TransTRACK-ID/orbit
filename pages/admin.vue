<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-xl font-bold text-surface-900">Admin Dashboard</h1>
      <span class="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-semibold border border-accent/20">
        Super Admin
      </span>
    </div>
    <p class="text-xs text-surface-400 mb-7">
      Platform analytics and user behavior insights
    </p>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <Icon name="lucide:loader-circle" class="w-5 h-5 text-surface-400 animate-spin" />
    </div>

    <div v-else>
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <div class="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Users</div>
          <div class="text-2xl font-bold text-surface-900 mt-1">{{ stats.users }}</div>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <div class="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Workspaces</div>
          <div class="text-2xl font-bold text-surface-900 mt-1">{{ stats.workspaces }}</div>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <div class="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Projects</div>
          <div class="text-2xl font-bold text-surface-900 mt-1">{{ stats.projects }}</div>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <div class="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Tasks</div>
          <div class="text-2xl font-bold text-surface-900 mt-1">{{ stats.tasks }}</div>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <div class="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Recent Tasks</div>
          <div class="text-2xl font-bold text-surface-900 mt-1">{{ stats.recentTasks }}</div>
          <div class="text-[9px] text-surface-400 mt-0.5">Last 7 days</div>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <div class="text-[10px] text-surface-400 font-semibold uppercase tracking-wider">Recent Activity</div>
          <div class="text-2xl font-bold text-surface-900 mt-1">{{ stats.recentActivity }}</div>
          <div class="text-[9px] text-surface-400 mt-0.5">Last 7 days</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 mb-4 border-b border-surface-200">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors"
          :class="activeTab === tab.key ? 'border-accent text-accent' : 'border-transparent text-surface-400 hover:text-surface-600'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="bg-white border border-surface-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Name</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Email</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Role</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Workspaces</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Tasks Assigned</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Activity (30d)</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Joined</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="u in users" :key="u.id" class="hover:bg-surface-50/50">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
                      {{ initials(u.name) }}
                    </div>
                    <span class="font-medium text-surface-900">{{ u.name }}</span>
                  </div>
                </td>
                <td class="px-4 py-2.5 text-surface-500">{{ u.email }}</td>
                <td class="px-4 py-2.5">
                  <span
                    class="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                    :class="u.role === 'super_admin' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface-100 text-surface-500 border-surface-200'"
                  >
                    {{ u.role }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right font-medium">{{ u.workspaceCount }}</td>
                <td class="px-4 py-2.5 text-right font-medium">{{ u.taskCount }}</td>
                <td class="px-4 py-2.5 text-right font-medium">{{ u.activityCount }}</td>
                <td class="px-4 py-2.5 text-surface-400">{{ formatDate(u.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="users.length === 0" class="text-center py-8 text-surface-400 text-xs">
          No users found
        </div>
      </div>

      <!-- Projects Tab -->
      <div v-if="activeTab === 'projects'" class="bg-white border border-surface-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Project</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Workspace</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Total Tasks</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Recent Tasks</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="p in projects" :key="p.id" class="hover:bg-surface-50/50">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" :style="{ backgroundColor: p.color }">
                      <span class="text-[7px] font-bold text-white">{{ p.name.charAt(0) }}</span>
                    </div>
                    <span class="font-medium text-surface-900">{{ p.name }}</span>
                  </div>
                </td>
                <td class="px-4 py-2.5 text-surface-500">{{ p.workspaceName }}</td>
                <td class="px-4 py-2.5 text-right font-medium">{{ p.taskCount }}</td>
                <td class="px-4 py-2.5 text-right font-medium">{{ p.recentTaskCount }}</td>
                <td class="px-4 py-2.5 text-surface-400">{{ formatDate(p.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="projects.length === 0" class="text-center py-8 text-surface-400 text-xs">
          No projects found
        </div>
      </div>

      <!-- Activity Tab -->
      <div v-if="activeTab === 'activity'" class="bg-white border border-surface-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Time</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">User</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Action</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Entity</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Workspace</th>
                <th class="px-4 py-2.5 font-semibold text-surface-500">Message</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-100">
              <tr v-for="a in activity" :key="a.id" class="hover:bg-surface-50/50">
                <td class="px-4 py-2.5 text-surface-400 whitespace-nowrap">{{ formatDate(a.createdAt) }}</td>
                <td class="px-4 py-2.5">
                  <span v-if="a.user" class="font-medium text-surface-900">{{ a.user.name }}</span>
                  <span v-else class="text-surface-400">System</span>
                </td>
                <td class="px-4 py-2.5">
                  <span class="px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 text-[9px] font-semibold border border-surface-200">
                    {{ a.action }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-surface-500">{{ a.entityType }}{{ a.entityName ? ` — ${a.entityName}` : '' }}</td>
                <td class="px-4 py-2.5 text-surface-500">{{ a.workspace?.name || '-' }}</td>
                <td class="px-4 py-2.5 text-surface-500 max-w-xs truncate">{{ a.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="activity.length === 0" class="text-center py-8 text-surface-400 text-xs">
          No activity yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'admin',
})

const tabs = [
  { key: 'users', label: 'Users' },
  { key: 'projects', label: 'Projects' },
  { key: 'activity', label: 'Activity' },
]

const activeTab = ref('users')
const loading = ref(true)

const stats = ref({
  users: 0,
  workspaces: 0,
  projects: 0,
  tasks: 0,
  activity: 0,
  recentTasks: 0,
  recentActivity: 0,
})

const users = ref<any[]>([])
const projects = ref<any[]>([])
const activity = ref<any[]>([])

function initials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(date: string | Date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  try {
    const [statsData, usersData, projectsData, activityData] = await Promise.all([
      $fetch('/api/admin/stats'),
      $fetch('/api/admin/users'),
      $fetch('/api/admin/projects'),
      $fetch('/api/admin/activity'),
    ])
    stats.value = statsData as any
    users.value = usersData as any[]
    projects.value = projectsData as any[]
    activity.value = activityData as any[]
  } catch (err: any) {
    console.error('Failed to load admin data:', err)
  } finally {
    loading.value = false
  }
})
</script>
