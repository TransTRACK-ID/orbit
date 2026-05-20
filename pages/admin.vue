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

      <!-- Templates Tab -->
      <div v-if="activeTab === 'templates'">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs text-surface-500">Manage project templates available to all workspaces.</p>
          <Button @on-click="openTemplateModal()">Add Template</Button>
        </div>
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">ID</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Name</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Category</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Stack</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Source</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="template in templatesData?.templates"
                :key="template.id"
                class="border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors"
              >
                <td class="px-4 py-2.5 font-mono text-surface-500">{{ template.id }}</td>
                <td class="px-4 py-2.5 font-medium text-surface-900">{{ template.name }}</td>
                <td class="px-4 py-2.5 text-surface-500">{{ template.category }}</td>
                <td class="px-4 py-2.5 text-surface-500">{{ template.stack }}</td>
                <td class="px-4 py-2.5 text-surface-500">{{ template.sourceType }}</td>
                <td class="px-4 py-2.5 text-right">
                  <button class="text-accent hover:text-accent/80 font-semibold mr-3" @click="openTemplateModal(template)">Edit</button>
                  <button class="text-error-500 hover:text-error-600 font-semibold" @click="deleteTemplate(template.id)">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!templatesData?.templates?.length" class="px-4 py-8 text-center text-[11px] text-surface-400">
            No templates found.
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
            <div class="min-w-0 flex-1">
              <div class="text-[11px] text-surface-700">
                <span class="font-semibold">{{ item.user?.name || 'Unknown' }}</span>
                <span
                  :class="{ 'line-clamp-3': !isExpanded(item.id) }"
                  class="whitespace-pre-wrap break-words"
                >{{ item.message }}</span>
              </div>
              <button
                v-if="item.message.length > 200"
                class="text-[10px] text-accent hover:text-accent/80 mt-1 font-medium"
                @click="toggleExpand(item.id)"
              >
                {{ isExpanded(item.id) ? 'Show less' : 'Show more' }}
              </button>
              <p class="text-[10px] text-surface-400 mt-0.5">
                {{ item.workspace?.name || 'Unknown workspace' }} · {{ formatDateTime(item.createdAt) }}
              </p>
            </div>
          </div>
          <div v-if="!activityData?.recentActivity?.length" class="px-4 py-8 text-center text-[11px] text-surface-400">
            No recent activity.
          </div>
        </div>
      </div>
    </div>

    <!-- Template Modal -->
    <Teleport to="body">
      <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="showTemplateModal = false">
        <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-surface-900">{{ editingTemplate ? 'Edit Template' : 'Add Template' }}</h3>
            <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="showTemplateModal = false">
              <Close class="w-5 h-5" />
            </button>
          </div>

          <form @submit.prevent="saveTemplate" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">ID *</label>
              <TextInput v-model="templateForm.id" placeholder="nuxt3-spa-starter" :disabled="!!editingTemplate" required />
              <p class="text-[10px] text-surface-400 mt-1">Unique kebab-case identifier. Cannot be changed later.</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Name *</label>
              <TextInput v-model="templateForm.name" placeholder="Nuxt 3 SPA Starter" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
              <TextArea v-model="templateForm.description" placeholder="Brief description..." rows="2" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1.5">Category</label>
                <TextInput v-model="templateForm.category" placeholder="frontend" />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1.5">Stack</label>
                <TextInput v-model="templateForm.stack" placeholder="node" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1.5">Source Type</label>
                <select v-model="templateForm.sourceType" class="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
                  <option value="local_path">local_path</option>
                  <option value="git">git</option>
                  <option value="npx">npx</option>
                  <option value="command">command</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 mb-1.5">Source Path</label>
                <TextInput v-model="templateForm.sourcePath" placeholder="server/templates/nuxt3-spa-starter" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Branch</label>
              <TextInput v-model="templateForm.branch" placeholder="main" />
            </div>
            <div class="flex items-center gap-2">
              <input v-model="templateForm.gitInit" type="checkbox" id="gitInit" class="rounded border-surface-300" />
              <label for="gitInit" class="text-sm text-surface-700">Initialize git and push</label>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Initial Commit Message</label>
              <TextInput v-model="templateForm.initialCommitMessage" placeholder="chore: initialize from template" />
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Template Configuration (JSON)</label>
              <p class="text-[11px] text-surface-500 mb-1.5">
                Define how the template is initialized: user input variables, file text replacements, file renames, and setup commands.
              </p>
              <TextArea v-model="templateForm.advancedJson" rows="15" class="font-mono text-xs" placeholder="{&quot;variables&quot;:[{&quot;key&quot;:&quot;projectName&quot;,&quot;label&quot;:&quot;Project Name&quot;,&quot;required&quot;:true}],&quot;fileSubstitutions&quot;:[...],&quot;renameFiles&quot;:[...],&quot;postInitCommands&quot;:[...]}" />
              <div class="mt-1.5 space-y-1">
                <p class="text-[10px] text-surface-400"><strong class="text-surface-500">variables</strong> — Input fields shown to the user when creating a project (key, label, required, default, autoGenerate, length)</p>
                <p class="text-[10px] text-surface-400"><strong class="text-surface-500">fileSubstitutions</strong> — Replace placeholders like <code v-pre>{{projectName}}</code> in files after cloning</p>
                <p class="text-[10px] text-surface-400"><strong class="text-surface-500">renameFiles</strong> — Rename files after cloning (e.g., .env.example → .env)</p>
                <p class="text-[10px] text-surface-400"><strong class="text-surface-500">postInitCommands</strong> — Shell commands to run after setup (e.g., npm install)</p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <TextButton @on-click="showTemplateModal = false">Cancel</TextButton>
              <Button type="submit" :loading="templateSaving">{{ editingTemplate ? 'Save Changes' : 'Create Template' }}</Button>
            </div>
            <p v-if="templateError" class="text-error-500 text-sm">{{ templateError }}</p>
          </form>
        </div>
      </div>
    </Teleport>
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

interface AdminTemplate {
  id: string
  name: string
  description: string
  category: string
  stack: string
  sourceType: string
  sourcePath: string
  branch?: string
  variables: any[]
  fileSubstitutions: any[]
  renameFiles: any[]
  postInitCommands: any[]
  gitInit: boolean
  initialCommitMessage: string
}

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'projects', label: 'Projects' },
  { id: 'activity', label: 'Activity' },
  { id: 'templates', label: 'Templates' },
]
const activeTab = ref('users')

const { data: usersData, pending: usersPending } = await useFetch<{ users: AdminUser[]; total: number }>('/api/admin/users', { key: 'admin-users' })
const { data: projectsData, pending: projectsPending } = await useFetch<{ projects: AdminProject[]; total: number }>('/api/admin/projects', { key: 'admin-projects' })
const { data: activityData, pending: activityPending } = await useFetch<ActivityData>('/api/admin/activity', { key: 'admin-activity' })

const { data: templatesData, pending: templatesPending, refresh: refreshTemplates } = await useFetch<{ templates: AdminTemplate[] }>('/api/admin/templates', { key: 'admin-templates' })

const loading = computed(() => usersPending.value || projectsPending.value || activityPending.value || templatesPending.value)

// Template modal state
const showTemplateModal = ref(false)
const editingTemplate = ref<AdminTemplate | null>(null)
const templateSaving = ref(false)
const templateError = ref('')

const defaultAdvancedJson = JSON.stringify({
  variables: [
    { key: 'projectName', label: 'Project Name', required: true },
    { key: 'projectDescription', label: 'Description', required: false },
    { key: 'appKey', label: 'App Key', required: true, autoGenerate: true, length: 32 },
  ],
  fileSubstitutions: [
    { path: 'package.json', replacements: { PROJECT_NAME: '{{projectName}}' } },
  ],
  renameFiles: [{ from: '.env.example', to: '.env' }],
  postInitCommands: [
    { command: 'npm install', timeout: 300000, description: 'Installing dependencies...' },
  ],
}, null, 2)

const templateForm = reactive({
  id: '',
  name: '',
  description: '',
  category: '',
  stack: '',
  sourceType: 'local_path' as 'local_path' | 'git' | 'npx' | 'command',
  sourcePath: '',
  branch: 'main',
  gitInit: true,
  initialCommitMessage: 'chore: initialize from template',
  advancedJson: defaultAdvancedJson,
})

function openTemplateModal(template?: AdminTemplate) {
  templateError.value = ''
  if (template) {
    editingTemplate.value = template
    templateForm.id = template.id
    templateForm.name = template.name
    templateForm.description = template.description
    templateForm.category = template.category
    templateForm.stack = template.stack
    templateForm.sourceType = template.sourceType as any
    templateForm.sourcePath = template.sourcePath
    templateForm.branch = template.branch || 'main'
    templateForm.gitInit = template.gitInit
    templateForm.initialCommitMessage = template.initialCommitMessage
    templateForm.advancedJson = JSON.stringify({
      variables: template.variables,
      fileSubstitutions: template.fileSubstitutions,
      renameFiles: template.renameFiles,
      postInitCommands: template.postInitCommands,
    }, null, 2)
  } else {
    editingTemplate.value = null
    templateForm.id = ''
    templateForm.name = ''
    templateForm.description = ''
    templateForm.category = ''
    templateForm.stack = ''
    templateForm.sourceType = 'local_path'
    templateForm.sourcePath = ''
    templateForm.branch = 'main'
    templateForm.gitInit = true
    templateForm.initialCommitMessage = 'chore: initialize from template'
    templateForm.advancedJson = defaultAdvancedJson
  }
  showTemplateModal.value = true
}

async function saveTemplate() {
  templateSaving.value = true
  templateError.value = ''

  let advanced: any
  try {
    advanced = JSON.parse(templateForm.advancedJson)
  } catch {
    templateError.value = 'Advanced Config JSON is invalid'
    templateSaving.value = false
    return
  }

  const payload = {
    id: templateForm.id,
    name: templateForm.name,
    description: templateForm.description,
    category: templateForm.category,
    stack: templateForm.stack,
    sourceType: templateForm.sourceType,
    sourcePath: templateForm.sourcePath,
    branch: templateForm.branch || undefined,
    gitInit: templateForm.gitInit,
    initialCommitMessage: templateForm.initialCommitMessage,
    variables: advanced.variables || [],
    fileSubstitutions: advanced.fileSubstitutions || [],
    renameFiles: advanced.renameFiles || [],
    postInitCommands: advanced.postInitCommands || [],
  }

  try {
    if (editingTemplate.value) {
      await $fetch(`/api/admin/templates/${editingTemplate.value.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/admin/templates', {
        method: 'POST',
        body: payload,
      })
    }
    showTemplateModal.value = false
    await refreshTemplates()
  } catch (err: any) {
    templateError.value = err?.data?.statusMessage || err?.data?.message || 'Failed to save template'
  } finally {
    templateSaving.value = false
  }
}

async function deleteTemplate(id: string) {
  if (!confirm(`Are you sure you want to delete template "${id}"?`)) return
  try {
    await $fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
    await refreshTemplates()
  } catch (err: any) {
    alert(err?.data?.statusMessage || 'Failed to delete template')
  }
}

function formatDate(date: string | Date | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatShortDate(date: string | Date | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDateTime(date: string | Date | null) {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
  const isThisYear = d.getFullYear() === now.getFullYear()

  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (isToday) return `Today at ${timeStr}`
  if (isYesterday) return `Yesterday at ${timeStr}`
  if (isThisYear) {
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${dateStr} at ${timeStr}`
  }
  const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  return `${dateStr} at ${timeStr}`
}

function userInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const expandedIds = ref<Set<string>>(new Set())

function isExpanded(id: string) {
  return expandedIds.value.has(id)
}

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
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
