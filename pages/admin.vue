<template>
  <div class="flex-1 overflow-y-auto py-5 px-4 sm:py-7 sm:px-8">
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-xl font-bold text-surface-900">Admin Dashboard</h1>
    </div>
    <p class="text-xs text-surface-400 mb-7">
      Analyze user behavior and projects across the platform.
    </p>

    <UiLoadingState v-if="loading" text="Loading admin data..." />

    <div v-else>
      <!-- Stats cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Users</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ activityData?.stats.users || 0 }}</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Workspaces</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ activityData?.stats.workspaces || 0 }}</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Projects</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ activityData?.stats.projects || 0 }}</p>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl p-4">
          <p class="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Tasks</p>
          <p class="text-xl font-bold text-surface-900 mt-1">{{ activityData?.stats.tasks || 0 }}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-2 mb-4 border-b border-surface-200">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 -mb-px"
          :class="activeTab === tab.id ? 'text-accent border-accent' : 'text-surface-400 border-transparent hover:text-surface-600'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'">
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Name</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Email</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Role</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Workspaces</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Projects</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Tasks</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Comments</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Joined</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in usersData?.users"
                :key="user.id"
                class="border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors"
              >
                <td class="px-4 py-2.5 font-medium text-surface-900">{{ user.name }}</td>
                <td class="px-4 py-2.5 text-surface-500">{{ user.email }}</td>
                <td class="px-4 py-2.5">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="user.role === 'super_admin' ? 'bg-accent/10 text-accent' : 'bg-surface-100 text-surface-500'"
                  >
                    {{ user.role }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right text-surface-500">{{ user.workspaceCount }}</td>
                <td class="px-4 py-2.5 text-right text-surface-500">{{ user.projectCount }}</td>
                <td class="px-4 py-2.5 text-right text-surface-500">{{ user.taskCount }}</td>
                <td class="px-4 py-2.5 text-right text-surface-500">{{ user.commentCount }}</td>
                <td class="px-4 py-2.5 text-surface-400">{{ formatDate(user.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!usersData?.users?.length" class="px-4 py-8 text-center text-[11px] text-surface-400">
            No users found.
          </div>
        </div>
      </div>

      <!-- Projects Tab -->
      <div v-if="activeTab === 'projects'">
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Project</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Workspace</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Tasks</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Members</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Created</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="project in projectsData?.projects"
                :key="project.id"
                class="border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors"
              >
                <td class="px-4 py-2.5 font-medium text-surface-900 flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-sm flex-shrink-0"
                    :style="{ backgroundColor: project.color }"
                  />
                  {{ project.name }}
                </td>
                <td class="px-4 py-2.5 text-surface-500">{{ project.workspace?.name || '-' }}</td>
                <td class="px-4 py-2.5 text-right text-surface-500">{{ project.taskCount }}</td>
                <td class="px-4 py-2.5 text-right text-surface-500">{{ project.memberCount }}</td>
                <td class="px-4 py-2.5 text-surface-400">{{ formatDate(project.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!projectsData?.projects?.length" class="px-4 py-8 text-center text-[11px] text-surface-400">
            No projects found.
          </div>
        </div>
      </div>

      <!-- Activity Tab -->
      <div v-if="activeTab === 'activity'">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <!-- Daily signups chart (simple bar) -->
          <div class="bg-white border border-surface-200 rounded-xl p-4">
            <p class="text-xs font-semibold text-surface-700 mb-3">Daily Signups (30d)</p>
            <div v-if="activityData?.dailySignups?.length" class="flex gap-1 h-32">
              <div
                v-for="day in activityData.dailySignups"
                :key="day.date"
                class="flex-1 flex flex-col items-center justify-end gap-1 h-full"
              >
                <span class="text-[9px] text-accent font-bold">{{ day.count }}</span>
                <div
                  class="w-full bg-accent/80 rounded-sm min-h-[4px]"
                  :style="{ height: signupBarHeight(day.count) }"
                />
                <span class="text-[9px] text-surface-400 rotate-45 origin-left translate-y-1">{{ formatShortDate(day.date) }}</span>
              </div>
            </div>
            <div v-else class="text-[11px] text-surface-400">No signups in the last 30 days.</div>
          </div>

          <!-- Daily tasks chart (simple bar) -->
          <div class="bg-white border border-surface-200 rounded-xl p-4">
            <p class="text-xs font-semibold text-surface-700 mb-3">Daily Tasks Created (30d)</p>
            <div v-if="activityData?.dailyTasks?.length" class="flex gap-1 h-32">
              <div
                v-for="day in activityData.dailyTasks"
                :key="day.date"
                class="flex-1 flex flex-col items-center justify-end gap-1 h-full"
              >
                <span class="text-[9px] text-accent font-bold">{{ day.count }}</span>
                <div
                  class="w-full bg-accent/60 rounded-sm min-h-[4px]"
                  :style="{ height: taskBarHeight(day.count) }"
                />
                <span class="text-[9px] text-surface-400 rotate-45 origin-left translate-y-1">{{ formatShortDate(day.date) }}</span>
              </div>
            </div>
            <div v-else class="text-[11px] text-surface-400">No tasks created in the last 30 days.</div>
          </div>
        </div>

        <!-- Recent activity feed -->
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <p class="text-xs font-semibold text-surface-700 px-4 py-3 border-b border-surface-200">Recent Activity</p>
          <div
            v-for="item in activityData?.recentActivity"
            :key="item.id"
            class="flex items-start gap-3 px-4 py-2.5 border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors"
          >
            <div class="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
              {{ userInitials(item.user?.name || '?') }}
            </div>
            <div class="min-w-0">
              <p class="text-[11px] text-surface-700">
                <span class="font-semibold">{{ item.user?.name || 'Unknown' }}</span>
                {{ item.message }}
              </p>
              <p class="text-[10px] text-surface-400 mt-0.5">
                {{ item.workspace?.name || 'Unknown workspace' }} · {{ formatDate(item.createdAt) }}
              </p>
            </div>
          </div>
          <div v-if="!activityData?.recentActivity?.length" class="px-4 py-8 text-center text-[11px] text-surface-400">
            No recent activity.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  workspaceCount: number
  projectCount: number
  taskCount: number
  commentCount: number
}

interface AdminProject {
  id: string
  name: string
  color: string
  createdAt: string
  workspace?: { name: string }
  taskCount: number
  memberCount: number
}

interface ActivityItem {
  id: string
  message: string
  createdAt: string
  user?: { name: string }
  workspace?: { name: string }
}

interface ActivityData {
  recentActivity: ActivityItem[]
  dailySignups: { date: string; count: number }[]
  dailyTasks: { date: string; count: number }[]
  stats: {
    users: number
    workspaces: number
    projects: number
    tasks: number
  }
}

definePageMeta({
  layout: 'default',
  middleware: ['admin'],
})

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'projects', label: 'Projects' },
  { id: 'activity', label: 'Activity' },
]
const activeTab = ref('users')

const { data: usersData, pending: usersPending } = await useFetch<{ users: AdminUser[]; total: number }>('/api/admin/users', { key: 'admin-users' })
const { data: projectsData, pending: projectsPending } = await useFetch<{ projects: AdminProject[]; total: number }>('/api/admin/projects', { key: 'admin-projects' })
const { data: activityData, pending: activityPending } = await useFetch<ActivityData>('/api/admin/activity', { key: 'admin-activity' })

const loading = computed(() => usersPending.value || projectsPending.value || activityPending.value)

function formatDate(date: string | Date | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatShortDate(date: string | Date | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function userInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function signupBarHeight(count: number | string) {
  const numCount = Number(count)
  const dailySignups = activityData.value?.dailySignups || []
  const max = Math.max(...dailySignups.map((d: any) => Number(d.count)), 1)
  const pct = max > 0 ? (numCount / max) * 100 : 4
  return `${Math.max(Math.round(pct), 4)}%`
}

function taskBarHeight(count: number | string) {
  const numCount = Number(count)
  const dailyTasks = activityData.value?.dailyTasks || []
  const max = Math.max(...dailyTasks.map((d: any) => Number(d.count)), 1)
  const pct = max > 0 ? (numCount / max) * 100 : 4
  return `${Math.max(Math.round(pct), 4)}%`
}
</script>
