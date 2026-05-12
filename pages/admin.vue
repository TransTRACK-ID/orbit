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
      <div class="flex items-center gap-1 mb-4 border-b border-surface-200 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-3 py-2 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap"
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
                  <select
                    v-if="u.id !== currentUserId"
                    :value="u.role"
                    :disabled="updatingUserId === u.id"
                    class="text-[9px] font-semibold border rounded px-1.5 py-0.5 outline-none cursor-pointer bg-white"
                    :class="u.role === 'super_admin' ? 'text-accent border-accent/30' : 'text-surface-500 border-surface-200'"
                    @change="updateRole(u.id, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="user">user</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <span
                    v-else
                    class="px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-accent/10 text-accent border-accent/20"
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

      <!-- User Behavior Tab -->
      <div v-if="activeTab === 'user-behavior'">
        <!-- Daily Activity Timeline -->
        <div class="bg-white border border-surface-200 rounded-xl p-5 mb-4">
          <h3 class="text-xs font-bold text-surface-900 mb-1">Platform Activity Timeline</h3>
          <p class="text-[10px] text-surface-400 mb-4">Daily activity feed entries over the last 30 days</p>
          <div v-if="userBehavior.dailyActivity.length > 0" class="flex items-end gap-1 h-32">
            <div
              v-for="day in userBehavior.dailyActivity"
              :key="day.date"
              class="flex-1 flex flex-col items-center gap-1"
            >
              <div
                class="w-full rounded-t-sm bg-accent/70 hover:bg-accent transition-colors relative group"
                :style="{ height: `${(day.count / maxDailyActivity) * 100}%` }"
              >
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-900 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                  {{ day.count }} entries on {{ formatShortDate(day.date) }}
                </div>
              </div>
              <span class="text-[8px] text-surface-400 rotate-0">{{ formatShortDate(day.date) }}</span>
            </div>
          </div>
          <div v-else class="text-center py-8 text-surface-400 text-xs">
            No activity data for the last 30 days
          </div>
        </div>

        <!-- Top Contributors -->
        <div class="bg-white border border-surface-200 rounded-xl p-5 mb-4">
          <h3 class="text-xs font-bold text-surface-900 mb-1">Top Contributors</h3>
          <p class="text-[10px] text-surface-400 mb-4">Most active users by total platform activity</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div
              v-for="(user, idx) in userBehavior.topUsers"
              :key="user.id"
              class="border border-surface-200 rounded-lg p-3"
            >
              <div class="flex items-center gap-2 mb-2">
                <div class="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold">
                  {{ initials(user.name) }}
                </div>
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold text-surface-900 truncate">{{ user.name }}</p>
                  <p class="text-[9px] text-surface-400 truncate">{{ user.email }}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="bg-surface-50 rounded px-2 py-1 text-center">
                  <div class="text-[10px] font-bold text-surface-900">{{ user.totalActivity }}</div>
                  <div class="text-[8px] text-surface-400">Activity</div>
                </div>
                <div class="bg-surface-50 rounded px-2 py-1 text-center">
                  <div class="text-[10px] font-bold text-surface-900">{{ user.tasksCreated }}</div>
                  <div class="text-[8px] text-surface-400">Created</div>
                </div>
              </div>
              <div class="mt-2">
                <div class="flex items-center justify-between text-[8px] text-surface-400 mb-0.5">
                  <span>Engagement</span>
                  <span>{{ user.engagementScore }}</span>
                </div>
                <div class="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-accent rounded-full"
                    :style="{ width: `${Math.min(100, (user.engagementScore / maxEngagementScore) * 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-if="userBehavior.topUsers.length === 0" class="text-center py-8 text-surface-400 text-xs">
            No contributor data yet
          </div>
        </div>

        <!-- User Engagement Table -->
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div class="px-4 py-3 border-b border-surface-200">
            <h3 class="text-xs font-bold text-surface-900">User Engagement Metrics</h3>
            <p class="text-[10px] text-surface-400 mt-0.5">Comprehensive behavior analysis per user (last 30 days)</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th class="px-4 py-2.5 font-semibold text-surface-500">User</th>
                  <th class="px-4 py-2.5 font-semibold text-surface-500">Role</th>
                  <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Tasks Created</th>
                  <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Tasks Assigned</th>
                  <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Comments</th>
                  <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Activity (30d)</th>
                  <th class="px-4 py-2.5 font-semibold text-surface-500 text-right">Score</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100">
                <tr v-for="u in userBehavior.userEngagement" :key="u.id" class="hover:bg-surface-50/50">
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-bold">
                        {{ initials(u.name) }}
                      </div>
                      <div>
                        <span class="font-medium text-surface-900 block">{{ u.name }}</span>
                        <span class="text-[9px] text-surface-400">{{ u.email }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-2.5">
                    <span
                      class="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                      :class="u.role === 'super_admin' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface-100 text-surface-500 border-surface-200'"
                    >
                      {{ u.role }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right font-medium">{{ u.tasksCreated }}</td>
                  <td class="px-4 py-2.5 text-right font-medium">{{ u.tasksAssigned }}</td>
                  <td class="px-4 py-2.5 text-right font-medium">{{ u.commentsMade }}</td>
                  <td class="px-4 py-2.5 text-right font-medium">{{ u.activity30d }}</td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold" :class="engagementScoreClass(u.engagementScore)">
                      {{ u.engagementScore }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="userBehavior.userEngagement.length === 0" class="text-center py-8 text-surface-400 text-xs">
            No engagement data yet
          </div>
        </div>
      </div>

      <!-- Project Analytics Tab -->
      <div v-if="activeTab === 'project-analytics'">
        <!-- Task Velocity -->
        <div class="bg-white border border-surface-200 rounded-xl p-5 mb-4">
          <h3 class="text-xs font-bold text-surface-900 mb-1">Task Velocity</h3>
          <p class="text-[10px] text-surface-400 mb-4">Tasks created per day over the last 30 days</p>
          <div v-if="projectAnalytics.dailyVelocity.length > 0" class="flex items-end gap-1 h-32">
            <div
              v-for="day in projectAnalytics.dailyVelocity"
              :key="day.date"
              class="flex-1 flex flex-col items-center gap-1"
            >
              <div
                class="w-full rounded-t-sm bg-emerald-500/70 hover:bg-emerald-500 transition-colors relative group"
                :style="{ height: `${(day.count / maxDailyVelocity) * 100}%` }"
              >
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-900 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                  {{ day.count }} tasks on {{ formatShortDate(day.date) }}
                </div>
              </div>
              <span class="text-[8px] text-surface-400">{{ formatShortDate(day.date) }}</span>
            </div>
          </div>
          <div v-else class="text-center py-8 text-surface-400 text-xs">
            No task velocity data for the last 30 days
          </div>
        </div>

        <!-- Project Health Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            v-for="p in projectAnalytics.projectAnalytics"
            :key="p.id"
            class="bg-white border border-surface-200 rounded-xl p-4"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" :style="{ backgroundColor: p.color }">
                  <span class="text-[7px] font-bold text-white">{{ p.name.charAt(0) }}</span>
                </div>
                <div>
                  <p class="text-[11px] font-bold text-surface-900">{{ p.name }}</p>
                  <p class="text-[9px] text-surface-400">{{ p.workspaceName }}</p>
                </div>
              </div>
              <span
                class="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                :class="healthScoreClass(p.healthScore)"
              >
                Health {{ p.healthScore }}%
              </span>
            </div>

            <!-- Mini stats -->
            <div class="grid grid-cols-3 gap-2 mb-3">
              <div class="bg-surface-50 rounded-lg p-2 text-center">
                <div class="text-xs font-bold text-surface-900">{{ p.totalTasks }}</div>
                <div class="text-[8px] text-surface-400">Tasks</div>
              </div>
              <div class="bg-surface-50 rounded-lg p-2 text-center">
                <div class="text-xs font-bold text-surface-900">{{ p.members }}</div>
                <div class="text-[8px] text-surface-400">Members</div>
              </div>
              <div class="bg-surface-50 rounded-lg p-2 text-center">
                <div class="text-xs font-bold text-surface-900">{{ p.recentTasks }}</div>
                <div class="text-[8px] text-surface-400">Recent (30d)</div>
              </div>
            </div>

            <!-- Task distribution -->
            <div v-if="p.distribution.length > 0">
              <div class="flex items-center justify-between text-[8px] text-surface-400 mb-1">
                <span>Task Distribution by Status</span>
              </div>
              <div class="flex w-full h-2 rounded-full overflow-hidden mb-1.5">
                <div
                  v-for="(dist, idx) in p.distribution"
                  :key="idx"
                  :style="{ width: `${(dist.count / p.totalTasks) * 100}%`, backgroundColor: dist.color }"
                  class="h-full relative group"
                >
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-900 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                    {{ dist.statusName }}: {{ dist.count }}
                  </div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <div v-for="(dist, idx) in p.distribution" :key="idx" class="flex items-center gap-1">
                  <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: dist.color }" />
                  <span class="text-[8px] text-surface-500">{{ dist.statusName }} ({{ dist.count }})</span>
                </div>
              </div>
            </div>
            <div v-else class="text-[9px] text-surface-400 py-2">
              No tasks yet
            </div>
          </div>
        </div>
        <div v-if="projectAnalytics.projectAnalytics.length === 0" class="text-center py-8 text-surface-400 text-xs bg-white border border-surface-200 rounded-xl">
          No projects found
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
  { key: 'user-behavior', label: 'User Behavior' },
  { key: 'project-analytics', label: 'Project Analytics' },
]

const { data: session } = useAuth()
const currentUserId = computed(() => (session.value?.user as any)?.id)

const activeTab = ref('users')
const loading = ref(true)
const updatingUserId = ref<string | null>(null)

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

const userBehavior = ref({
  dailyActivity: [] as { date: string; count: number }[],
  dailyTasks: [] as { date: string; count: number }[],
  userEngagement: [] as any[],
  topUsers: [] as any[],
})

const projectAnalytics = ref({
  projectAnalytics: [] as any[],
  dailyVelocity: [] as { date: string; count: number }[],
})

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

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const maxDailyActivity = computed(() => {
  const max = Math.max(...userBehavior.value.dailyActivity.map(d => d.count), 1)
  return max
})

const maxEngagementScore = computed(() => {
  const max = Math.max(...userBehavior.value.userEngagement.map(u => u.engagementScore), 1)
  return max
})

const maxDailyVelocity = computed(() => {
  const max = Math.max(...projectAnalytics.value.dailyVelocity.map(d => d.count), 1)
  return max
})

function engagementScoreClass(score: number) {
  if (score >= 50) return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (score >= 20) return 'bg-amber-100 text-amber-700 border border-amber-200'
  return 'bg-surface-100 text-surface-500 border border-surface-200'
}

function healthScoreClass(score: number) {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (score >= 40) return 'bg-amber-100 text-amber-700 border border-amber-200'
  if (score > 0) return 'bg-rose-100 text-rose-700 border border-rose-200'
  return 'bg-surface-100 text-surface-500 border border-surface-200'
}

async function updateRole(userId: string, newRole: string) {
  if (!userId || !newRole) return
  updatingUserId.value = userId
  try {
    await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role: newRole },
    })
    // Refresh users list
    const usersData = await $fetch('/api/admin/users')
    users.value = usersData as any[]
  } catch (err: any) {
    console.error('Failed to update role:', err)
    alert(err?.statusMessage || 'Failed to update role')
    // Refresh to restore correct state
    const usersData = await $fetch('/api/admin/users')
    users.value = usersData as any[]
  } finally {
    updatingUserId.value = null
  }
}

onMounted(async () => {
  try {
    const [statsData, usersData, projectsData, activityData, behaviorData, analyticsData] = await Promise.all([
      $fetch('/api/admin/stats'),
      $fetch('/api/admin/users'),
      $fetch('/api/admin/projects'),
      $fetch('/api/admin/activity'),
      $fetch('/api/admin/user-behavior'),
      $fetch('/api/admin/project-analytics'),
    ])
    stats.value = statsData as any
    users.value = usersData as any[]
    projects.value = projectsData as any[]
    activity.value = activityData as any[]
    userBehavior.value = behaviorData as any
    projectAnalytics.value = analyticsData as any
  } catch (err: any) {
    console.error('Failed to load admin data:', err)
  } finally {
    loading.value = false
  }
})
</script>
