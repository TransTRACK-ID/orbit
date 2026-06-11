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
                  <button
                    class="text-error-500 hover:text-error-600 font-semibold"
                    :disabled="deletingTemplateId === template.id"
                    :class="{ 'opacity-50 cursor-wait': deletingTemplateId === template.id }"
                    @click="deleteTemplate(template.id)"
                  >
                    {{ deletingTemplateId === template.id ? 'Deleting...' : 'Delete' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!templatesData?.templates?.length" class="px-4 py-8 text-center text-[11px] text-surface-400">
            No templates found.
          </div>
        </div>
      </div>

      <!-- Runtimes Tab -->
      <div v-if="activeTab === 'runtimes'">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs text-surface-500">Enable or disable agent runtime CLIs available to users.</p>
            <p class="text-[10px] text-surface-400 mt-1">
              Default runtime from <code class="font-mono">AGENT_RUNTIME</code>:
              <span class="font-semibold text-surface-600">{{ runtimesData?.defaultRuntime || agentRuntime }}</span>
              (cannot be disabled)
            </p>
          </div>
          <Button
            :loading="savingRuntimes"
            @on-click="saveRuntimeSettings"
          >
            Save Changes
          </Button>
        </div>

        <div v-if="runtimesPending" class="flex items-center justify-center py-12">
          <Icon name="lucide:loader-circle" class="w-5 h-5 text-surface-400 animate-spin" />
        </div>

        <div v-else class="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <table class="w-full text-[11px]">
            <thead class="bg-surface-50 border-b border-surface-200">
              <tr>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Runtime</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Description</th>
                <th class="text-left px-4 py-2 font-semibold text-surface-500">Status</th>
                <th class="text-right px-4 py-2 font-semibold text-surface-500">Enabled</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="runtime in runtimeSettings"
                :key="runtime.id"
                class="border-b border-surface-100 last:border-0"
              >
                <td class="px-4 py-3 font-medium text-surface-900">
                  {{ runtime.name }}
                  <span
                    v-if="runtime.isDefault"
                    class="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-accent/10 text-accent"
                  >
                    Default
                  </span>
                </td>
                <td class="px-4 py-3 text-surface-500">{{ runtime.desc }}</td>
                <td class="px-4 py-3">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="runtime.enabled ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-500'"
                  >
                    {{ runtime.enabled ? 'Enabled' : 'Disabled' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <Toggle
                    :model-value="runtime.enabled"
                    :disabled="!runtime.canDisable || savingRuntimes"
                    @update:model-value="toggleRuntime(runtime.id, $event)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
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

      <!-- Diagnostics Tab -->
      <div v-if="activeTab === 'diagnostics'" class="space-y-6">
        <div v-if="diagnosticsPending && !diagnosticsData" class="flex items-center justify-center gap-2 py-8">
          <svg class="animate-spin w-4 h-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-xs text-surface-500">Loading diagnostics...</span>
        </div>
        <!-- Section 1: System Health & Memory Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Memory Stats -->
          <div class="bg-white border border-surface-200 rounded-xl p-4 shadow-sm">
            <h3 class="text-xs font-semibold text-surface-700 uppercase tracking-wider mb-3">Node.js Memory</h3>
            <div class="space-y-2 text-[11px]">
              <div class="flex justify-between border-b border-surface-50 pb-1.5">
                <span class="text-surface-500 font-medium">RSS (Resident Set Size)</span>
                <span class="font-bold text-surface-900 font-mono">{{ diagnosticsData?.memoryMb?.rss || 0 }} MB</span>
              </div>
              <div class="flex justify-between border-b border-surface-50 pb-1.5">
                <span class="text-surface-500 font-medium">Heap Used</span>
                <span class="font-bold text-surface-900 font-mono">{{ diagnosticsData?.memoryMb?.heapUsed || 0 }} / {{ diagnosticsData?.memoryMb?.heapTotal || 0 }} MB</span>
              </div>
              <div class="flex justify-between border-b border-surface-50 pb-1.5">
                <span class="text-surface-500 font-medium">External</span>
                <span class="font-bold text-surface-900 font-mono">{{ diagnosticsData?.memoryMb?.external || 0 }} MB</span>
              </div>
            </div>
          </div>

          <!-- Active Processes -->
          <div class="bg-white border border-surface-200 rounded-xl p-4 shadow-sm md:col-span-2">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-semibold text-surface-700 uppercase tracking-wider">Active Agent Processes ({{ diagnosticsData?.runningTasks?.length || 0 }})</h3>
              <button 
                class="text-[10px] font-semibold text-accent hover:underline flex items-center gap-1"
                @click="refreshDiagnostics"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Refresh
              </button>
            </div>
            <div v-if="diagnosticsData?.runningTasks?.length" class="overflow-x-auto">
              <table class="w-full text-[11px]">
                <thead class="bg-surface-50 border-b border-surface-200">
                  <tr>
                    <th class="text-left px-3 py-1.5 font-semibold text-surface-500">Task ID</th>
                    <th class="text-left px-3 py-1.5 font-semibold text-surface-500">Runtime</th>
                    <th class="text-left px-3 py-1.5 font-semibold text-surface-500">PID</th>
                    <th class="text-right px-3 py-1.5 font-semibold text-surface-500">Active SSE Streams</th>
                    <th class="text-right px-3 py-1.5 font-semibold text-surface-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="task in diagnosticsData.runningTasks" :key="task.taskId" class="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                    <td class="px-3 py-2 font-mono text-surface-700 truncate max-w-xs">{{ task.taskId }}</td>
                    <td class="px-3 py-2">
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="task.runtime === 'cursor' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'">
                        {{ task.runtime }}
                      </span>
                    </td>
                    <td class="px-3 py-2 font-mono text-surface-900">{{ task.pid || 'N/A' }}</td>
                    <td class="px-3 py-2 text-right font-medium text-surface-600">{{ task.streamCount }}</td>
                    <td class="px-3 py-2 text-right">
                      <button
                        class="px-2 py-1 rounded text-[11px] font-semibold bg-semantic-red/10 text-semantic-red hover:bg-semantic-red hover:text-white transition-colors border border-semantic-red/20"
                        :disabled="killingTaskId === task.taskId"
                        @click="killTask(task.taskId)"
                      >
                        <span v-if="killingTaskId === task.taskId">Stopping...</span>
                        <span v-else>Force Stop</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-[11px] text-surface-400 py-6 text-center">
              No active agent processes running.
            </div>
          </div>
        </div>

        <!-- Section 2: Linux Meminfo (Optional) -->
        <div v-if="diagnosticsData?.procMemInfo" class="bg-white border border-surface-200 rounded-xl p-4 shadow-sm">
          <h3 class="text-xs font-semibold text-surface-700 uppercase tracking-wider mb-3">Host Memory Details</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px]">
            <div v-for="(val, key) in diagnosticsData.procMemInfo" :key="key" class="bg-surface-50 rounded-lg p-2.5 border border-surface-100">
              <span class="text-surface-400 font-medium block truncate" :title="key">{{ formatMemLabel(key) }}</span>
              <span class="font-bold text-surface-800 text-sm mt-0.5 block font-mono">{{ formatMemInfo(val) }}</span>
            </div>
          </div>
        </div>

        <!-- Section 3: Crash History -->
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
          <h3 class="text-xs font-semibold text-surface-700 px-4 py-3 bg-surface-50 border-b border-surface-200 uppercase tracking-wider">Recent Crashes & Failures</h3>
          <div v-if="diagnosticsData?.crashEvents?.length" class="overflow-x-auto">
            <table class="w-full text-[11px]">
              <thead class="bg-surface-50 border-b border-surface-200 text-surface-500 font-semibold">
                <tr>
                  <th class="text-left px-4 py-2">Timestamp</th>
                  <th class="text-left px-4 py-2">Event</th>
                  <th class="text-left px-4 py-2">Task</th>
                  <th class="text-left px-4 py-2">Triggered By</th>
                  <th class="text-left px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="event in paginatedCrashEvents" :key="event.id">
                  <tr 
                    class="border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors cursor-pointer"
                    @click="toggleExpand(event.id)"
                  >
                    <td class="px-4 py-2.5 text-surface-400 font-mono whitespace-nowrap">
                      <div class="flex items-center gap-1.5">
                        <ChevronRight class="w-3 h-3 text-surface-300 transition-transform" :class="isExpanded(event.id) ? 'rotate-90' : ''" />
                        {{ formatDateTime(event.createdAt) }}
                      </div>
                    </td>
                    <td class="px-4 py-2.5">
                      <span 
                        class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                        :class="event.action === 'agent_crash' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'"
                      >
                        {{ event.action === 'agent_crash' ? 'Crash / OOM' : 'Error' }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 font-medium text-surface-900">
                      <span class="truncate block max-w-[200px]" :title="event.taskTitle">{{ event.taskTitle }}</span>
                      <span class="text-[9px] font-mono text-surface-400 block">{{ event.taskId }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-surface-600">{{ event.triggeredBy }}</td>
                    <td class="px-4 py-2.5 font-mono text-surface-500 max-w-sm">
                      <span v-if="event.exitCode !== null">Exit Code: {{ event.exitCode }}</span>
                      <span v-if="event.signal"> | Signal: {{ event.signal }}</span>
                      <p class="text-[10px] text-surface-400 mt-0.5 line-clamp-2" :title="event.message">{{ event.message }}</p>
                    </td>
                  </tr>
                  <tr v-if="isExpanded(event.id)" class="bg-surface-50/50">
                    <td colspan="5" class="px-4 py-3">
                      <div class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-3 space-y-2">
                        <div class="flex items-center justify-between">
                          <h4 class="text-[10px] font-bold text-surface-700 uppercase tracking-wider">Full Crash Details</h4>
                          <button 
                            class="text-[10px] text-surface-400 hover:text-surface-600 flex items-center gap-1 transition-colors"
                            @click.stop="copyCrashDetails(event)"
                          >
                            <Copy size="12" />
                            Copy Details
                          </button>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span class="text-surface-400">Task ID:</span> <span class="font-mono text-surface-700">{{ event.taskId }}</span></div>
                          <div><span class="text-surface-400">Action:</span> <span class="font-mono text-surface-700">{{ event.action }}</span></div>
                          <div><span class="text-surface-400">Exit Code:</span> <span class="font-mono text-surface-700">{{ event.exitCode ?? 'N/A' }}</span></div>
                          <div><span class="text-surface-400">Signal:</span> <span class="font-mono text-surface-700">{{ event.signal ?? 'N/A' }}</span></div>
                          <div><span class="text-surface-400">Triggered By:</span> <span class="font-mono text-surface-700">{{ event.triggeredBy }}</span></div>
                          <div><span class="text-surface-400">Timestamp:</span> <span class="font-mono text-surface-700">{{ formatDateTime(event.createdAt) }}</span></div>
                        </div>
                        <div v-if="event.message" class="mt-2">
                          <span class="text-[10px] text-surface-400 font-medium">Message:</span>
                          <pre class="mt-1 text-[10px] font-mono text-surface-700 bg-surface-50 dark:bg-surface-800 p-2 rounded border border-surface-100 dark:border-surface-700 whitespace-pre-wrap break-all">{{ event.message }}</pre>
                        </div>
                        <div class="mt-3">
                          <div class="flex items-center justify-between mb-1.5">
                            <h5 class="text-[10px] font-bold text-surface-700 uppercase tracking-wider">Raw Agent Terminal Log History</h5>
                            <span class="text-[9px] text-surface-400">Last 30 related logs</span>
                          </div>
                          <div class="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-lg p-2 max-h-64 overflow-y-auto font-mono text-[10px] space-y-0.5">
                            <div 
                              v-for="log in getRelatedLogs(event)" 
                              :key="log.id" 
                              class="flex items-start gap-2 py-0.5 px-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800/50"
                            >
                              <span class="text-surface-400 dark:text-surface-600 flex-shrink-0 select-none">{{ formatShortTime(log.createdAt) }}</span>
                              <span class="text-primary-600 dark:text-primary-400 font-bold flex-shrink-0 w-20 truncate" :title="log.taskTitle">{{ log.taskTitle }}</span>
                              <span class="text-surface-700 dark:text-surface-300 flex-1 whitespace-pre-wrap break-all">{{ log.message }}</span>
                            </div>
                            <div v-if="getRelatedLogs(event).length === 0" class="text-surface-400 text-center py-2">
                              No terminal logs found for this crash event.
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            <div class="px-4 py-2.5 bg-surface-50 border-t border-surface-200 flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-3">
                <span class="text-surface-400">
                  {{ ((crashPage - 1) * crashPageSize) + 1 }}–{{ Math.min(crashPage * crashPageSize, crashTotalCount) }} of {{ crashTotalCount }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="text-surface-400">Show</span>
                  <select
                    v-model="crashPageSize"
                    class="bg-white border border-surface-200 rounded px-1.5 py-0.5 text-surface-600 outline-none focus:border-primary-500 cursor-pointer text-[10px]"
                  >
                    <option v-for="opt in CRASH_PAGE_SIZE_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="px-2 py-1 rounded border border-surface-200 bg-white text-surface-600 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  :disabled="crashPage <= 1"
                  @click="crashPage--"
                >
                  Prev
                </button>
                <span class="text-surface-400 px-1">{{ crashPage }} / {{ crashTotalPages }}</span>
                <button
                  class="px-2 py-1 rounded border border-surface-200 bg-white text-surface-600 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  :disabled="crashPage >= crashTotalPages"
                  @click="crashPage++"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <div v-else class="text-[11px] text-surface-400 py-12 text-center">
            No agent crash or execution failure logs found.
          </div>
        </div>

        <!-- Section 4: Full Runtime Logs -->
        <div class="bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
          <div class="px-4 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between gap-3">
            <h3 class="text-xs font-semibold text-surface-700 uppercase tracking-wider">Raw Agent Terminal Log History (Last 200 Logs)</h3>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-surface-400">Auto-refresh</span>
              <select
                v-model="autoRefreshSeconds"
                class="text-[10px] bg-white border border-surface-200 rounded px-1.5 py-0.5 text-surface-600 outline-none focus:border-primary-500 cursor-pointer"
              >
                <option v-for="opt in AUTO_REFRESH_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg
                v-if="diagnosticsRefreshing"
                class="animate-spin w-3 h-3 text-primary-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="text-[10px] text-surface-400">Admin diagnostics view</span>
            </div>
          </div>
          <div v-if="filteredRuntimeLogs?.length" ref="logsScrollContainer" class="bg-white dark:bg-surface-950 font-mono text-xs text-surface-700 dark:text-surface-300 max-h-[500px] overflow-y-auto select-text scrollbar-thin">
            <div class="sticky top-0 z-10 bg-white dark:bg-surface-950 border-b border-surface-200 dark:border-surface-800 p-2 flex items-center justify-between">
              <span class="text-[10px] text-surface-400">{{ filteredRuntimeLogs.length }} log entries</span>
              <button
                class="text-[10px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                @click="copyAllLogs"
              >
                <Copy size="12" />
                {{ copiedLogs ? 'Copied!' : 'Copy All' }}
              </button>
            </div>
            <div class="p-4 space-y-1">
              <div v-for="log in filteredRuntimeLogs" :key="log.id" class="group hover:bg-surface-100 dark:hover:bg-surface-800/50 py-0.5 px-1 rounded flex items-start gap-3">
                <span class="text-surface-400 dark:text-surface-600 text-[10px] select-none flex-shrink-0">{{ formatShortTime(log.createdAt) }}</span>
                <span class="text-primary-600 dark:text-primary-400 font-bold select-none text-[10px] flex-shrink-0 w-24 truncate" :title="log.taskTitle">{{ log.taskTitle }}</span>
                <span class="text-surface-800 dark:text-surface-100 flex-1 whitespace-pre-wrap word-break-all">{{ log.message }}</span>
              </div>
            </div>
          </div>
          <div v-else class="text-[11px] text-surface-400 py-12 text-center">
            No live raw execution logs available.
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
  { id: 'runtimes', label: 'Runtimes' },
  { id: 'diagnostics', label: 'Diagnostics' },
]
const activeTab = ref('users')

const { data: usersData, pending: usersPending } = await useFetch<{ users: AdminUser[]; total: number }>('/api/admin/users', { key: 'admin-users' })
const { data: projectsData, pending: projectsPending } = await useFetch<{ projects: AdminProject[]; total: number }>('/api/admin/projects', { key: 'admin-projects' })
const { data: activityData, pending: activityPending } = await useFetch<ActivityData>('/api/admin/activity', { key: 'admin-activity' })

const { data: templatesData, pending: templatesPending, refresh: refreshTemplates } = await useFetch<{ templates: AdminTemplate[] }>('/api/admin/templates', { key: 'admin-templates' })
const { data: diagnosticsData, pending: diagnosticsPending, refresh: _refreshDiagnostics } = await useFetch<any>('/api/admin/diagnostics', { key: 'admin-diagnostics' })
const { success: toastSuccess, error: toastError } = useToast()
const { public: { agentRuntime } } = useRuntimeConfig()

interface AdminRuntimeSetting {
  id: string
  name: string
  desc: string
  enabled: boolean
  isDefault: boolean
  canDisable: boolean
}

const { data: runtimesData, pending: runtimesPending, refresh: refreshRuntimes } = await useFetch<{
  runtimes: AdminRuntimeSetting[]
  defaultRuntime: string
}>('/api/admin/runtimes', { key: 'admin-runtimes' })

const runtimeSettings = ref<AdminRuntimeSetting[]>([])
const savingRuntimes = ref(false)
const copiedLogs = ref(false)

watch(runtimesData, (data) => {
  if (data?.runtimes) {
    runtimeSettings.value = data.runtimes.map(r => ({ ...r }))
  }
}, { immediate: true })

function toggleRuntime(id: string, enabled: boolean) {
  const runtime = runtimeSettings.value.find(r => r.id === id)
  if (!runtime || !runtime.canDisable) return
  runtime.enabled = enabled
}

async function saveRuntimeSettings() {
  savingRuntimes.value = true
  try {
    const res = await $fetch<{ runtimes: AdminRuntimeSetting[]; defaultRuntime: string }>('/api/admin/runtimes', {
      method: 'PATCH',
      body: {
        runtimes: runtimeSettings.value.map(r => ({ id: r.id, enabled: r.enabled })),
      },
    })
    runtimesData.value = res
    runtimeSettings.value = res.runtimes.map(r => ({ ...r }))
    toastSuccess('Runtime settings saved successfully.')
  } catch (err: any) {
    toastError(err?.data?.statusMessage || 'Failed to save runtime settings')
    await refreshRuntimes()
  } finally {
    savingRuntimes.value = false
  }
}

// ── Auto-refresh for diagnostics ──
const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
]
const autoRefreshSeconds = ref(10)
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
/** Separate from diagnosticsPending so auto-refresh doesn't trigger full-page loading */
const diagnosticsRefreshing = ref(false)
/** Ref to the scrollable log container so we can preserve scroll position across refreshes */
const logsScrollContainer = ref<HTMLElement | null>(null)

// ── Crash events pagination ──
const crashPage = ref(1)
const crashPageSize = ref(5)
const CRASH_PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

async function refreshDiagnostics() {
  const scrollTop = logsScrollContainer.value?.scrollTop ?? 0
  diagnosticsRefreshing.value = true
  try {
    await _refreshDiagnostics()
  } finally {
    diagnosticsRefreshing.value = false
    // Restore scroll position after Vue updates the DOM
    nextTick(() => {
      if (logsScrollContainer.value) {
        logsScrollContainer.value.scrollTop = scrollTop
      }
    })
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (autoRefreshSeconds.value > 0 && activeTab.value === 'diagnostics') {
    autoRefreshTimer = setInterval(() => {
      refreshDiagnostics()
    }, autoRefreshSeconds.value * 1000)
  }
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

watch([autoRefreshSeconds, activeTab], () => {
  startAutoRefresh()
})

onMounted(() => {
  startAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
})

// ── Kill active agent process ──
const killingTaskId = ref<string | null>(null)

async function killTask(taskId: string) {
  if (!taskId) return
  killingTaskId.value = taskId
  try {
    const res = await $fetch(`/api/tasks/${taskId}/execute/kill`, { method: 'POST' })
    if (res.killed) {
      toastSuccess(`Agent process for task ${taskId} stopped successfully.`)
      await refreshDiagnostics()
    } else {
      toastError(`Failed to stop agent process: ${res.reason || 'Unknown error'}`)
    }
  } catch (err: any) {
    toastError(`Error stopping agent process: ${err?.message || 'Unknown error'}`)
  } finally {
    killingTaskId.value = null
  }
}

const loading = computed(() => usersPending.value || projectsPending.value || activityPending.value || templatesPending.value)

const paginatedCrashEvents = computed(() => {
  const events = diagnosticsData.value?.crashEvents || []
  const start = (crashPage.value - 1) * crashPageSize.value
  const end = start + crashPageSize.value
  return events.slice(start, end)
})

const crashTotalPages = computed(() => {
  const events = diagnosticsData.value?.crashEvents || []
  return Math.ceil(events.length / crashPageSize.value)
})

const crashTotalCount = computed(() => diagnosticsData.value?.crashEvents?.length || 0)

watch(crashPageSize, () => {
  crashPage.value = 1
})

// ── Runtime logs filter ──
const IGNORED_LOG_PATTERNS = [
  'opencode runtime cli Copy All',
  'Step started',
  'Step completed',
]

const filteredRuntimeLogs = computed(() => {
  const logs = diagnosticsData.value?.recentRuntimeLogs || []
  return logs.filter((log: any) => {
    const msg = String(log.message || '')
    return !IGNORED_LOG_PATTERNS.some(pattern => msg.includes(pattern))
  })
})

const deletingTemplateId = ref<string | null>(null)

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
  deletingTemplateId.value = id
  try {
    await $fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
    await refreshTemplates()
  } catch (err: any) {
    alert(err?.data?.statusMessage || 'Failed to delete template')
  } finally {
    deletingTemplateId.value = null
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

function formatShortTime(date: string | Date | null) {
  if (!date) return '-'
  return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const memLabelMap: Record<string, string> = {
  MemTotal: 'Total Memory',
  MemFree: 'Free Memory',
  MemAvailable: 'Available Memory',
  Buffers: 'Buffers',
  Cached: 'Cached',
  SwapCached: 'Swap Cached',
  Active: 'Active',
  Inactive: 'Inactive',
  'Active(anon)': 'Active (Anonymous)',
  'Inactive(anon)': 'Inactive (Anonymous)',
  'Active(file)': 'Active (File)',
  'Inactive(file)': 'Inactive (File)',
  Unevictable: 'Unevictable',
  Mlocked: 'Mlocked',
  SwapTotal: 'Total Swap',
  SwapFree: 'Free Swap',
  Dirty: 'Dirty',
  Writeback: 'Writeback',
  AnonPages: 'Anonymous Pages',
  Mapped: 'Mapped',
  Shmem: 'Shared Memory',
  KReclaimable: 'Reclaimable',
  Slab: 'Slab',
  SReclaimable: 'Reclaimable Slab',
  SUnreclaim: 'Unreclaimable Slab',
  KernelStack: 'Kernel Stack',
  PageTables: 'Page Tables',
  NFS_Unstable: 'NFS Unstable',
  Bounce: 'Bounce',
  WritebackTmp: 'Writeback Temp',
  CommitLimit: 'Commit Limit',
  Committed_AS: 'Committed AS',
  VmallocTotal: 'VMalloc Total',
  VmallocUsed: 'VMalloc Used',
  VmallocChunk: 'VMalloc Chunk',
  Percpu: 'Per CPU',
  HardwareCorrupted: 'Hardware Corrupted',
  AnonHugePages: 'Anonymous Huge Pages',
  ShmemHugePages: 'Shared Huge Pages',
  ShmemPmdMapped: 'Shared PMD Mapped',
  FileHugePages: 'File Huge Pages',
  FilePmdMapped: 'File PMD Mapped',
  CmaTotal: 'CMA Total',
  CmaFree: 'CMA Free',
  HugePages_Total: 'Huge Pages Total',
  HugePages_Free: 'Huge Pages Free',
  HugePages_Rsvd: 'Huge Pages Reserved',
  HugePages_Surp: 'Huge Pages Surplus',
  Hugepagesize: 'Huge Page Size',
  Hugetlb: 'Huge TLB',
  DirectMap4k: 'Direct Map 4K',
  DirectMap2M: 'Direct Map 2M',
  DirectMap1G: 'Direct Map 1G',
}

function formatMemLabel(key: string): string {
  return memLabelMap[key] || key.replace(/([A-Z])/g, ' $1').trim()
}

function formatMemInfo(val: string | number): string {
  if (typeof val === 'number') {
    return formatBytes(val * 1024)
  }
  const match = String(val).match(/^([\d.]+)\s*kB$/i)
  if (match) {
    const kb = parseFloat(match[1])
    return formatBytes(kb * 1024)
  }
  return String(val)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const clamped = Math.min(i, units.length - 1)
  const size = bytes / Math.pow(1024, clamped)
  return `${size.toFixed(2)} ${units[clamped]}`
}

function copyCrashDetails(event: any) {
  const relatedLogs = getRelatedLogs(event)
  const logLines = relatedLogs.length > 0
    ? relatedLogs.map((log: any) => `[${formatShortTime(log.createdAt)}] [${log.taskTitle}] ${log.message}`).join('\n')
    : 'No terminal logs found for this crash event.'

  const details = [
    `Crash Event Details`,
    `==================`,
    `Timestamp: ${formatDateTime(event.createdAt)}`,
    `Action: ${event.action}`,
    `Task: ${event.taskTitle} (${event.taskId})`,
    `Triggered By: ${event.triggeredBy}`,
    `Exit Code: ${event.exitCode ?? 'N/A'}`,
    `Signal: ${event.signal ?? 'N/A'}`,
    ``,
    `Message:`,
    event.message || 'No message',
    ``,
    `Raw Agent Terminal Log History (Last ${relatedLogs.length} related logs)`,
    `------------------------------------------------`,
    logLines,
  ].join('\n')

  navigator.clipboard.writeText(details).catch(() => {})
}

function copyAllLogs() {
  if (!filteredRuntimeLogs.value?.length) return
  const logs = filteredRuntimeLogs.value
    .map((log: any) => `[${formatShortTime(log.createdAt)}] [${log.taskTitle}] ${log.message}`)
    .join('\n')

  navigator.clipboard.writeText(logs).then(() => {
    copiedLogs.value = true
    setTimeout(() => copiedLogs.value = false, 2000)
  }).catch(() => {})
}

function getRelatedLogs(event: any) {
  if (!filteredRuntimeLogs.value?.length) return []
  const crashTime = new Date(event.createdAt).getTime()
  const windowMs = 5 * 60 * 1000 // 5 minutes window before crash
  return filteredRuntimeLogs.value
    .filter((log: any) => {
      const logTime = new Date(log.createdAt).getTime()
      return log.taskId === event.taskId && logTime <= crashTime && (crashTime - logTime) <= windowMs
    })
    .slice(0, 30)
}
</script>
