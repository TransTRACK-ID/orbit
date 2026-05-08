<template>
  <div class="fixed inset-0 z-50 flex">
    <div class="absolute inset-0 bg-surface-900/20 backdrop-blur-sm" @click="$emit('close')" />

    <div class="absolute right-0 top-0 bottom-0 w-[600px] max-w-[90vw] bg-white shadow-2xl border-l border-surface-200 animate-slide-in-right flex flex-col">
      <!-- Agent runtime indicator — floating top-right, only when CLI is actively processing -->
      <div
        v-if="runtimeActive"
        class="absolute top-20 right-6 z-30"
      >
        <Tooltip
          :id="'agent-runtime-status-' + task.id"
          label="Agent runtime is processing..."
        >
          <template #default>
            <div 
              class="w-9 h-9 rounded-full shadow-xl border-2 border-white flex items-center justify-center cursor-help transition-all duration-300 hover:scale-110 group"
              :style="{ background: chatAgentIdentity.color || '#6366f1' }"
            >
              <svg class="animate-spin text-white" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle class="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/><path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
          </template>
        </Tooltip>
      </div>

      <UiLoadingState v-if="loading" text="Loading task..." />

      <template v-else-if="task">
        <div class="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div class="flex items-center gap-3">
            <KanbanPriorityBadge :priority="task.priority" />
            <span class="text-xs font-mono text-surface-400">
              {{ task.id?.slice(0, 8) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <IconButton @click="handleDuplicate">
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stroke-surface-500 w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </template>
            </IconButton>
            <IconButton @click="confirmDelete = true">
              <template #icon>
                <Trash class="stroke-surface-500 w-4 h-4" />
              </template>
            </IconButton>
            <IconButton @click="$emit('close')">
              <template #icon>
                <Close class="stroke-surface-500 w-4 h-4" />
              </template>
            </IconButton>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <div class="mb-4">
            <TextInput
              :model-value="task.title"
              placeholder="Task title"
              class="text-lg font-semibold !border-transparent !bg-transparent !px-0"
              @update:model-value="handleUpdate('title', $event)"
            />
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6 p-4 bg-surface-50 rounded-xl">
            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Status</label>
              <div class="relative">
                <select
                  :value="task.statusId"
                  class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  @change="handleUpdate('statusId', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="s in statuses" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Priority</label>
              <div class="relative">
                <select
                  :value="task.priority"
                  class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  @change="handleUpdate('priority', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="none">None</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div class="relative">
              <label class="block text-xs font-medium text-surface-500 mb-1">Assignee</label>
              <button
                class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 transition-colors text-left"
                @click="showAssigneePicker = !showAssigneePicker"
              >
                <template v-if="task.assignee">
                  <span
                    v-if="task.assignee.color"
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    :style="{ background: task.assignee.color }"
                  >
                    {{ task.assignee.initials || computedInitials(task.assignee.name) }}
                  </span>
                  <Avatar
                    v-else
                    :name="task.assignee.name"
                    size="sm"
                  />
                  <span class="flex-1 truncate">{{ task.assignee.name }}</span>
                  <span v-if="task.assigneeType === 'agent'" class="text-[9px] text-primary-500 font-semibold uppercase">Agent</span>
                </template>
                <template v-else>
                  <span class="text-surface-400 flex-1">Unassigned</span>
                </template>
                <ChevronDown class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              </button>

              <div v-if="isAgentInProgress" class="flex items-center gap-1.5 mt-2">
                <span class="agentic-badge">
                  <span class="agentic-dot" />
                  <span>Agentic · {{ task.assignee?.name }}</span>
                </span>
              </div>

              <div
                v-if="showAssigneePicker"
                class="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
              >
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                  @click="assignTo()"
                >
                  <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                  Unassigned
                </button>

                <div v-if="members.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Members</div>
                <button
                  v-for="m in members"
                  :key="m.userId"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  :class="{ 'bg-primary-50': task.assigneeId === m.userId && task.assigneeType === 'user' }"
                  @click="assignTo(m.userId, 'user')"
                >
                  <Avatar :name="m.user?.name || 'U'" size="sm" />
                  <span class="truncate">{{ m.user?.name }}</span>
                </button>

                <div v-if="agents.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider border-t border-surface-100 mt-1 pt-1">Agents</div>
                <button
                  v-for="a in agents"
                  :key="a.id"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  :class="{ 'bg-primary-50': task.assigneeId === a.id && task.assigneeType === 'agent' }"
                  @click="assignTo(a.id, 'agent')"
                >
                  <span
                    class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    :style="{ background: a.color }"
                  >
                    {{ a.initials }}
                  </span>
                  <span class="truncate">{{ a.name }}</span>
                  <span class="ml-auto text-[9px] text-primary-500 font-semibold uppercase">{{ a.runtime }}</span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Labels</label>
              <div v-if="task.labels?.length" class="flex flex-wrap gap-1">
                <Chip
                  v-for="label in task.labels"
                  :key="label.id"
                  :label="label.name"
                  :color="label.color"
                  size="sm"
                />
              </div>
              <span v-else class="text-sm text-surface-400">None</span>
            </div>
          </div>

          <div v-if="repositories && repositories.length > 0" class="mb-4">
            <label class="block text-xs font-medium text-surface-500 mb-1">Repository</label>
            <select
              :value="task.repositoryId"
              class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              @change="handleUpdate('repositoryId', ($event.target as HTMLSelectElement).value || null)"
            >
              <option :value="null">None</option>
              <option v-for="repo in repositories" :key="repo.id" :value="repo.id">
                {{ repo.name }} — {{ repo.defaultBranch }}
              </option>
            </select>
          </div>

          <div class="mb-6">
            <label class="block text-xs font-medium text-surface-500 mb-2">Description</label>
            <div class="border border-surface-200 rounded-lg overflow-hidden">
              <div class="border-b border-surface-100 px-3 py-2 flex gap-1 bg-surface-50">
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500" @click="toggleBold">
                  <strong class="text-xs">B</strong>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500" @click="toggleItalic">
                  <em class="text-xs">I</em>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500" @click="toggleStrike">
                  <span class="text-xs line-through">S</span>
                </button>
              </div>
              <div class="p-3 min-h-[100px]">
                <div
                  ref="editorRef"
                  contenteditable
                  class="text-sm text-surface-700 outline-none min-h-[80px]"
                  @input="handleDescriptionInput"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-surface-500 mb-3">
              Comments ({{ allComments.length }})
            </label>
            <div class="space-y-3 mb-4">
              <template v-for="comment in allComments" :key="comment.id">
                <!-- User comment -->
                <div
                  v-if="!comment.isAgent"
                  class="flex gap-3 p-3 rounded-lg bg-surface-50"
                >
                  <Avatar :name="comment.authorName" size="sm" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-sm font-medium text-surface-900">{{ comment.authorName }}</span>
                      <span class="text-xs text-surface-400">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <p class="text-sm text-surface-700 whitespace-pre-wrap" v-html="linkify(comment.body)"></p>
                  </div>
                </div>

                <!-- Persisted agent reply -->
                <div
                  v-else
                  class="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-primary-50/50 to-primary-50 border border-primary-100"
                >
                  <span
                    class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    :style="{ background: comment.authorColor || '#6366f1' }"
                  >
                    {{ computedInitials(comment.authorName) }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-sm font-medium text-primary-700">{{ comment.authorName }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-600 font-semibold">AGENT</span>
                      <span class="text-xs text-primary-400 ml-auto">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <p class="text-sm text-primary-800 whitespace-pre-wrap" v-html="linkify(comment.body)"></p>
                  </div>
                </div>
              </template>
            </div>

            <div class="flex gap-2">
              <div class="flex-1 relative">
                <!-- Custom input with @mention support -->
                <div
                  class="w-full rounded-lg overflow-hidden stroke-gray-500 border-2 flex h-10"
                  :class="isSendingToAgent ? 'bg-gray-100 cursor-not-allowed' : 'bg-white border-gray-200'"
                >
                  <input
                    ref="commentInputRef"
                    v-model="newComment"
                    type="text"
                    :placeholder="isAgentInProgress ? 'Message the agent...' : 'Write a comment... (type @ to mention someone)'"
                    class="block px-2.5 w-full h-full border-none text-gray-900 bg-transparent focus:ring-0 outline-none"
                    :disabled="isSendingToAgent"
                    @keydown.enter.prevent="mentionActive ? selectMention(mentionOptions[mentionSelectedIndex]) : handleAddComment()"
                    @keydown.escape="mentionActive = false"
                    @keydown.down.prevent="mentionNavigate(1)"
                    @keydown.up.prevent="mentionNavigate(-1)"
                    @input="handleMentionInput"
                  />
                </div>

                <!-- AGENT badge -->
                <span
                  v-if="isAgentInProgress && newComment.length > 0"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-primary-400 pointer-events-none"
                >
                  AGENT
                </span>

                <!-- @mention dropdown -->
                <div
                  v-if="mentionActive && mentionOptions.length > 0"
                  class="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-surface-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="(option, idx) in mentionOptions"
                    :key="option.id"
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-50 transition-colors text-left"
                    :class="{ 'bg-primary-50': idx === mentionSelectedIndex }"
                    @click="selectMention(option)"
                    @mouseenter="mentionSelectedIndex = idx"
                  >
                    <span
                      class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                      :style="{ background: option.color || '#64748b' }"
                    >
                      {{ option.initials }}
                    </span>
                    <span class="flex-1 truncate text-surface-800">{{ option.name }}</span>
                    <span v-if="option.type" class="text-[9px] font-semibold uppercase flex-shrink-0" :class="option.type === 'agent' ? 'text-primary-500' : 'text-surface-400'">
                      {{ option.type }}
                    </span>
                  </button>
                  <div v-if="mentionOptions.length === 0" class="px-3 py-2 text-sm text-surface-400">
                    No matches found
                  </div>
                </div>
              </div>
              <Button
                :disabled="!newComment || isSendingToAgent"
                :loading="isSendingToAgent"
                @click="handleAddComment"
              >
                <template v-if="isAgentInProgress && !isSendingToAgent">
                  <span class="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
                    Send
                  </span>
                </template>
                <template v-else>Send</template>
              </Button>
            </div>

            <div v-if="userActivityLogs.length > 0" class="mt-6 pt-4 border-t border-surface-100">
              <label class="block text-xs font-medium text-surface-500 mb-3">Activity</label>
              <div class="space-y-2">
                <div
                  v-for="log in userActivityLogs"
                  :key="log.id"
                  class="flex items-start gap-2 text-sm text-surface-500"
                >
                  <Avatar :name="log.userName || 'U'" size="xs" />
                  <div>
                    <span class="font-medium text-surface-700">{{ log.userName }}</span>
                    <span>{{ ' ' + log.message }}</span>
                    <span class="text-xs text-surface-400 ml-1">{{ log.displayTime }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="task" class="mt-6 pt-4 border-t border-surface-100">
              <div class="flex items-center gap-2 mb-3">
                <button
                  class="flex items-center gap-1 flex-1 text-left group"
                  @click="runtimeLogsExpanded = !runtimeLogsExpanded"
                >
                  <ChevronDown
                    class="w-3 h-3 text-surface-400 transition-transform duration-200"
                    :class="{ 'rotate-180': runtimeLogsExpanded }"
                  />
                  <label class="text-xs font-medium text-surface-500 cursor-pointer group-hover:text-surface-700 transition-colors">
                    Runtime ({{ runtimeLogsForTask.length }})
                  </label>
                </button>
                <button
                  v-if="isAgentInProgress && !runtimeActive"
                  class="text-[10px] font-semibold px-2 py-1 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-1"
                  @click="startRuntime(task.id); prUrl = ''; prError = ''"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                  Run
                </button>
                <button
                  v-if="runtimeActive"
                  class="text-[10px] font-semibold px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
                  @click="stopRuntime(task.id)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Stop
                </button>
              </div>

              <template v-if="runtimeLogsForTask.length > 0 || runtimeActive">

              <div class="flex items-start gap-2 text-sm text-surface-500 mb-2">
                <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-600"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M9 14h6"/><path d="M12 14v4"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium text-surface-700">Runtime</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-semibold">LIVE</span>
                  </div>
                  <p class="text-sm text-surface-600 truncate mt-0.5">{{ latestRuntimeLog?.message || 'Waiting...' }}</p>
                </div>
              </div>

              <div
                v-if="runtimeLogsExpanded"
                class="space-y-0.5 max-h-40 overflow-y-auto rounded-lg bg-surface-50 p-2"
              >
                <div
                  v-for="log in runtimeLogsForTask"
                  :key="log.id"
                  class="flex items-start gap-1.5 py-0.5 text-[11px] leading-snug"
                >
                  <span class="text-primary-400 mt-0.5 flex-shrink-0">&#8250;</span>
                  <span class="text-surface-600 font-mono flex-1 min-w-0">{{ log.message }}</span>
                  <span class="text-surface-400 flex-shrink-0 whitespace-nowrap">{{ log.displayTime }}</span>
                </div>
              </div>

              <div v-if="runtimeCompleted && !runtimeActive" class="mt-3">
                <div
                  v-if="prSkipped"
                  class="w-full text-[11px] px-3 py-2 rounded-lg bg-surface-100 text-surface-500 flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  No code changes to commit
                </div>
                <button
                  v-else-if="prLoading"
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-500 text-white flex items-center justify-center gap-1.5 opacity-70 cursor-wait"
                  disabled
                >
                  <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Creating PR...
                </button>
                <a
                  v-else-if="prUrl"
                  :href="prUrl"
                  target="_blank"
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 no-underline"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Open PR
                </a>
                <button
                  v-else
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                  @click="handleCreatePr"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                  Create PR
                </button>
                <p v-if="prError" class="text-[10px] text-red-500 mt-1">{{ prError }}</p>
              </div>
            </template>

              <!-- Review Feedback Section -->
              <div v-if="prUrl && isReviewStatus" class="mt-6 pt-4 border-t border-surface-100">
                <div class="flex items-center gap-2 mb-3">
                  <button
                    class="flex items-center gap-1 flex-1 text-left group"
                    @click="showReviewFeedback = !showReviewFeedback"
                  >
                    <ChevronDown
                      class="w-3 h-3 text-surface-400 transition-transform duration-200"
                      :class="{ 'rotate-180': showReviewFeedback }"
                    />
                    <label class="text-xs font-medium text-surface-500 cursor-pointer group-hover:text-surface-700 transition-colors">
                      Review Feedback ({{ prComments.length }})
                    </label>
                  </button>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">REVIEW</span>
                  <!-- Agent fixing indicator -->
                  <span
                    v-if="runtimeActive && prComments.length > 0"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-semibold flex items-center gap-1"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    Fixing...
                  </span>
                </div>

                <template v-if="showReviewFeedback">
                  <!-- Auto-loading state -->
                  <div
                    v-if="autoLoadingComments"
                    class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white flex items-center justify-center gap-1.5 opacity-70 cursor-wait"
                  >
                    <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Loading feedback...
                  </div>

                  <!-- Fetch from GitHub button when no comments loaded and not auto-loading -->
                  <button
                    v-if="prComments.length === 0 && !fetchingComments && !autoLoadingComments"
                    class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5"
                    @click="handleFetchComments"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Fetch PR Feedback
                  </button>

                  <!-- Fetching from GitHub -->
                  <div
                    v-if="fetchingComments"
                    class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white flex items-center justify-center gap-1.5 opacity-70 cursor-wait"
                  >
                    <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Fetching comments...
                  </div>

                  <!-- Comments list -->
                  <div v-if="prComments.length > 0" class="space-y-2 max-h-48 overflow-y-auto">
                    <div
                      v-for="comment in prComments"
                      :key="comment.id"
                      class="rounded-lg bg-surface-50 p-2.5"
                    >
                      <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-[10px] font-semibold text-surface-700 bg-surface-200 rounded-full px-1.5 py-0.5">{{ comment.author }}</span>
                        <span v-if="comment.path" class="text-[9px] text-surface-400 font-mono truncate">{{ comment.path }}{{ comment.line ? `:${comment.line}` : '' }}</span>
                        <span v-if="comment.isReview" class="text-[9px] text-amber-500 ml-auto">review</span>
                      </div>
                      <div class="text-[11px] text-surface-600 leading-relaxed review-feedback-body" v-html="comment.body" />
                    </div>
                  </div>

                  <!-- Agent working status banner -->
                  <div
                    v-if="runtimeActive && prComments.length > 0"
                    class="mt-3 p-2.5 rounded-lg bg-primary-50 border border-primary-100 flex items-center gap-2.5"
                  >
                    <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-[11px] font-medium text-primary-700">Agent is fixing feedback...</p>
                      <p class="text-[10px] text-primary-500 truncate">{{ latestRuntimeLog?.message?.replace('> ', '') || 'Working...' }}</p>
                    </div>
                  </div>

                  <!-- Bottom actions row: Refresh + Fix with Agent -->
                  <div v-if="prComments.length > 0" class="flex gap-2 mt-3">
                    <button
                      class="flex-1 text-[11px] font-semibold px-3 py-2 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5"
                      :disabled="fetchingComments"
                      :class="{ 'opacity-70 cursor-wait': fetchingComments }"
                      @click="handleFetchComments"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      Refresh
                    </button>
                    <button
                      v-if="feedbackFixed"
                      class="flex-1 text-[11px] font-semibold px-3 py-2 rounded-lg bg-green-600 text-white flex items-center justify-center gap-1.5 cursor-default"
                      disabled
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Fix Applied
                    </button>
                    <button
                      v-else
                      class="flex-1 text-[11px] font-semibold px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5"
                      :disabled="fixingFeedback || runtimeActive"
                      :class="{ 'opacity-70 cursor-wait': fixingFeedback || runtimeActive }"
                      @click="handleFixFeedback"
                    >
                      <svg v-if="fixingFeedback || runtimeActive" class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 19,12 5,21"/></svg>
                      {{ fixingFeedback || runtimeActive ? 'Fixing...' : `Fix with Agent (${prComments.length})` }}
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <ModalConfirmation
      v-if="confirmDelete"
      title="Delete Task"
      message="Are you sure you want to delete this task? This action cannot be undone."
      confirm-text="Delete"
      variant="danger"
      @confirm="handleDelete"
      @cancel="confirmDelete = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { Task, Status, Label, Comment, ActivityLog, ProjectMember, Repository, PrComment } from '~/types'
import type { Agent } from '~/types'
import { useDebounceFn } from '@vueuse/core'
import { nextTick } from 'vue'

const { addLog, persistLog, logs: runtimeLogs } = useLog()

const props = defineProps<{
  taskId: string
  projectId: string
  workspaceId: string
  statuses: Status[]
  labels: Label[]
  members: ProjectMember[]
  agents: Agent[]
  repositories?: Repository[]
}>()

const emit = defineEmits<{
  close: []
  updated: [task: Task]
  deleted: [taskId: string]
  duplicated: [task: Task]
}>()

const {
  fetchTaskDetail,
  fetchComments,
  addComment,
  fetchActivity,
  createTask: createTaskApi,
  updateTask: updateTaskApi,
  deleteTask: deleteTaskApi,
} = useTask()

const loading = ref(true)
const task = ref<Task | null>(null)
const comments = ref<Comment[]>([])
const activityLogs = ref<ActivityLog[]>([])
const newComment = ref('')
const confirmDelete = ref(false)
const editorRef = ref<HTMLDivElement | null>(null)
const showAssigneePicker = ref(false)

const isAgentInProgress = computed(() => {
  return (
    task.value?.assigneeType === 'agent' &&
    task.value?.assignee &&
    task.value?.status?.name &&
    /progress/i.test(task.value.status.name)
  )
})

/** Tracks when we are sending a comment to the agent runtime */
const isSendingToAgent = ref(false)

/**
 * When `true`, the current runtime was triggered by a chat comment from the
 * user, so completion should NOT auto-create a PR or change the task status.
 */
const isChatMessage = ref(false)

// ─── @mention autocomplete ───

/** Reference to the raw comment input element for cursor manipulation */
const commentInputRef = ref<HTMLInputElement | null>(null)

/** Whether the @mention dropdown is currently shown */
const mentionActive = ref(false)

/** The text typed after "@" that we're filtering by */
const mentionQuery = ref('')

/** Index of the currently highlighted option in the dropdown (keyboard nav) */
const mentionSelectedIndex = ref(0)

/** Agents mapped to mention options */
const agentMentionOptions = computed(() =>
  props.agents.map(a => ({
    id: a.id,
    name: a.name,
    initials: a.initials,
    color: a.color,
    type: 'agent' as const,
  }))
)

/** Project members mapped to mention options */
const memberMentionOptions = computed(() =>
  props.members.map(m => ({
    id: m.userId,
    name: m.user?.name || 'Unknown',
    initials: (m.user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    color: undefined,
    type: 'member' as const,
  }))
)

/** Combined & filtered mention options based on current query */
const mentionOptions = computed(() => {
  const q = mentionQuery.value.toLowerCase().trim()
  const agents = q
    ? agentMentionOptions.value.filter(o => o.name.toLowerCase().includes(q))
    : agentMentionOptions.value
  const members = q
    ? memberMentionOptions.value.filter(o => o.name.toLowerCase().includes(q))
    : memberMentionOptions.value
  return [...agents, ...members]
})

/**
 * Called on every keystroke in the comment input. Detects "@" followed by a
 * query string (no spaces) and activates the mention dropdown.
 */
function handleMentionInput(e: Event) {
  const input = e.target as HTMLInputElement
  const val = input.value
  const cursorPos = input.selectionStart || 0

  // Find the last "@" before the cursor position
  const textBeforeCursor = val.slice(0, cursorPos)
  const atIndex = textBeforeCursor.lastIndexOf('@')

  if (atIndex !== -1) {
    // Only trigger if preceded by whitespace or at the very start
    const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
    if (charBefore === ' ' || charBefore === '\n') {
      const afterAt = textBeforeCursor.slice(atIndex + 1)
      // Query must not contain spaces (user is still typing the name)
      if (!afterAt.includes(' ')) {
        mentionQuery.value = afterAt
        mentionSelectedIndex.value = 0
        mentionActive.value = true
        return
      }
    }
  }

  mentionActive.value = false
}

/** Navigate the dropdown with arrow keys */
function mentionNavigate(dir: number) {
  const len = mentionOptions.value.length
  if (len === 0) return
  mentionSelectedIndex.value = (mentionSelectedIndex.value + dir + len) % len
}

/** Insert the selected mention into the comment text */
function selectMention(option: { name: string }) {
  const input = commentInputRef.value
  if (!input) return

  const val = input.value
  const cursorPos = input.selectionStart || 0
  const textBeforeCursor = val.slice(0, cursorPos)
  const atIndex = textBeforeCursor.lastIndexOf('@')

  if (atIndex === -1) {
    mentionActive.value = false
    return
  }

  // Find where the "@query" text ends (first space after @ or cursor position)
  const afterAt = textBeforeCursor.slice(atIndex + 1)
  const spaceAfter = afterAt.search(/\s/)
  const queryEnd = spaceAfter !== -1 ? atIndex + 1 + spaceAfter : cursorPos

  // Replace "@query" with "@Name " in the full value
  const newVal = val.slice(0, atIndex) + `@${option.name} ` + val.slice(queryEnd)
  newComment.value = newVal
  mentionActive.value = false

  // Restore focus & place cursor right after the inserted name
  nextTick(() => {
    input.focus()
    const newPos = atIndex + option.name.length + 2
    input.setSelectionRange(newPos, newPos)
  })
}

// ─── Agent @mention detection ───

/** When the user last sent a comment to the agent (0 = never). Used to
 *  filter runtime logs so the "reply" bubble only shows fresh responses. */
const lastAgentChatTimestamp = ref(0)

/** Find the first agent @mentioned in a comment body (case-insensitive).
 *  Returns the agent info or null if no agent is mentioned. */
function findMentionedAgent(body: string): { name: string; color?: string } | null {
  const atMentions = body.match(/@(\S+)/g)
  if (!atMentions) return null
  for (const mention of atMentions) {
    const mentionedName = mention.slice(1).toLowerCase().trim()
    const agent = props.agents.find(a => a.name.toLowerCase() === mentionedName)
    if (agent) return { name: agent.name, color: agent.color }
  }
  return null
}

/** Whether the task has agent activity that warrants showing the chat UI.
 *  True when: the task is agent-assigned + in-progress, OR the runtime is
 *  actively processing, OR we're in the process of sending to the agent. */
const showAgentChat = computed(() =>
  isAgentInProgress.value || runtimeActive.value || isSendingToAgent.value
)

/** The agent identity to show in chat UI — prefers the @mentioned agent,
 *  falls back to the task's assigned agent, then the first available agent. */
const chatAgentIdentity = computed(() => {
  // Use the agent from the most recent mention if one was found
  if (lastAgentChatTimestamp.value > 0 && mentionedAgentName.value) {
    return { name: mentionedAgentName.value, color: mentionedAgentColor.value }
  }
  if (task.value?.assignee) {
    return { name: task.value.assignee.name, color: task.value.assignee.color }
  }
  // Fall back to the first agent on the project
  const first = props.agents[0]
  if (first) return { name: first.name, color: first.color }
  return { name: 'Agent', color: '#6366f1' }
})

/** The name of the most recently @mentioned agent (sticky across renders) */
const mentionedAgentName = ref('')
const mentionedAgentColor = ref<string | undefined>(undefined)

/**
 * The latest agent "reply" — a recent runtime log shown inside the comments
 * section to create a conversational feel. Only shows logs that appeared
 * *after* the last user message was sent to the agent.
 */
const latestAgentReply = computed(() => {
  const logs = runtimeLogsForTask.value
  if (logs.length === 0) return null

  // Only show logs from the current chat session (after last agent-directed comment)
  const recentLogs = lastAgentChatTimestamp.value > 0
    ? logs.filter(log => log.timestamp >= lastAgentChatTimestamp.value)
    : logs

  if (recentLogs.length === 0) return null

  for (const log of recentLogs) {
    if (log.message.startsWith('[AGENT_REPLY] ')) {
      return log.message.slice(14)
    }
    const msg = log.message.replace(/^>\s*/, '')
    if (
      msg &&
      !/Waiting for opencode|Process exited|Done|Step (started|completed)|Exited with|Chat session ended/i.test(msg) &&
      !/Spawning opencode|Cloning|Cloned to|Switched to|Checked out|Including PR|Pushed|No changes|Push failed|Including PR feedback|Including user message/i.test(msg) &&
      !/^User:/.test(msg) &&
      !/Agent .+ assigned (to|from)/i.test(msg) &&
      !/^(Reading |Writing to |Editing |Running:|Searching:|Searching for|Listing |Notification:|Question:|Creating directory|Tool:)/i.test(msg)
    ) {
      return msg.slice(0, 200)
    }
  }
  return null
})

// ─── Persisted agent replies ───

/**
 * Persisted agent responses fetched from the server. These are runtime_log
 * entries in activity_logs that were saved by the opencode runtime. Unlike
 * the in-memory runtimeLogsForTask, these survive page refresh.
 */
const agentReplies = ref<Array<{ id: string; body: string; createdAt: string; agentName: string; agentColor?: string }>>([])

async function fetchAgentReplies() {
  if (!task.value) return
  try {
    // Clear the bridge first so allComments never sees a duplicate
    // (virtual entry + persisted entry for the same reply).
    lastChatReplyText.value = null
    lastChatReplyTimestamp.value = 0
    agentReplies.value = await $fetch(`/api/tasks/${task.value.id}/agent-replies`)
  } catch {
    agentReplies.value = []
  }
}

const allComments = computed(() => {
  const merged = [
    ...comments.value.map(c => ({
      id: c.id,
      body: c.body,
      createdAt: new Date(c.createdAt).getTime(),
      authorName: c.user?.name || 'U',
      isAgent: false,
    })),
    ...agentReplies.value.map(r => {
      let agent = props.agents.find(a => a.name === r.agentName)
      if (!agent) {
        agent = props.agents.find(a => a.name === chatAgentIdentity.value.name)
      }
      return {
        id: r.id,
        body: r.body,
        createdAt: new Date(r.createdAt).getTime(),
        authorName: agent?.name || chatAgentIdentity.value.name || 'Agent',
        authorColor: r.agentColor || agent?.color || chatAgentIdentity.value.color || '#6366f1',
        isAgent: true,
      }
    }),
  ]

  // Include the in-memory agent reply (live during runtime, or bridged after
  // runtime ends) as a virtual comment entry so it appears in chronological
  // order with all other comments and respects the full comment history.
  // Skip if already present in persisted agent replies (avoids duplication
  // after runtime finishes and agentReplies are refreshed).
  const liveReply = latestAgentReply.value
  const bridgedReply = lastChatReplyText.value
  const inMemoryBody = liveReply || bridgedReply
  const alreadyPersisted = agentReplies.value.some(r => r.body === inMemoryBody)
  if (inMemoryBody && !alreadyPersisted) {
    const isLive = !!liveReply
    merged.push({
      id: 'in-memory-reply',
      body: inMemoryBody,
      createdAt: isLive ? Date.now() : (lastChatReplyTimestamp.value || Date.now()),
      authorName: isLive ? chatAgentIdentity.value.name : (lastChatReplyAuthor.value || chatAgentIdentity.value.name),
      authorColor: isLive ? (chatAgentIdentity.value.color || '#6366f1') : (lastChatReplyAuthorColor.value || '#6366f1'),
      isAgent: true,
    })
  }

  return merged.sort((a, b) => a.createdAt - b.createdAt)
})

const { startRuntime, stopRuntime, isRunning } = useAgentRuntime()
const runtimeActive = computed(() => task.value ? isRunning(task.value.id) : false)

/** In-memory store for the last agent chat reply that survives runtime completion */
const lastChatReplyText = ref<string | null>(null)
const lastChatReplyAuthor = ref<string>('Agent')
const lastChatReplyAuthorColor = ref<string>('#6366f1')
const lastChatReplyTimestamp = ref(0)

/** Safety net: when the runtime transitions from active to inactive, refresh
 *  persisted agent replies. This covers edge cases where the "Done" log from
 *  runtimeLogsForTask may not fire the completion watch (e.g. non-zero exit,
 *  network interruption, or the premature "Step completed" match before our fix). */
watch(runtimeActive, async (active) => {
  if (!active && task.value && isChatMessage.value) {
    setTimeout(async () => {
      await fetchAgentReplies()
    }, 500)
  }
})

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatRelativeTimeFromMs(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const runtimeLogsExpanded = ref(false)

const userActivityLogs = computed(() =>
  activityLogs.value
    .filter(log => log.action !== 'runtime_log' && log.action !== 'agent_reply')
    .map(log => ({
      id: log.id,
      userName: log.user?.name || 'Unknown',
      message: formatActivity(log),
      displayTime: formatRelativeTime(log.createdAt),
      timestamp: new Date(log.createdAt).getTime(),
    }))
)

const runtimeLogsForTask = computed(() => {
  const inMemoryLogs = runtimeLogs.value
    .filter(log => log.taskId === props.taskId)
    .map(log => ({
      id: `runtime-${log.time}`,
      message: log.msg,
      displayTime: formatRelativeTimeFromMs(log.time),
      timestamp: log.time,
    }))

  const persistedLogs = activityLogs.value
    .filter(log => log.action === 'runtime_log')
    .map(log => ({
      id: `persisted-${log.id}`,
      message: `> ${log.newValue?.message || ''}`,
      displayTime: formatRelativeTime(log.createdAt),
      timestamp: new Date(log.createdAt).getTime(),
    }))

  return [...inMemoryLogs, ...persistedLogs].sort((a, b) => b.timestamp - a.timestamp)
})

const latestRuntimeLog = computed(() => runtimeLogsForTask.value[0] || null)

const runtimeCompleted = computed(() =>
  runtimeLogsForTask.value.some(log => /Done|exited/i.test(log.message) && !/^>?\s*Step /i.test(log.message))
)

/** Watch the live agent reply and capture it so it stays visible even after the
 *  runtime ends and "Chat session ended" causes latestAgentReply to return null. */
watch(latestAgentReply, (reply) => {
  if (reply && reply.length > 0) {
    lastChatReplyText.value = reply
    lastChatReplyAuthor.value = chatAgentIdentity.value.name
    lastChatReplyAuthorColor.value = chatAgentIdentity.value.color || '#6366f1'
    lastChatReplyTimestamp.value = Date.now()
  }
})

const remotePrUrl = ref('')

const prUrl = computed(() => {
  const prLog = activityLogs.value.find(l => l.action === 'pr_created' || l.action === 'pr_updated')
  return prLog?.newValue?.url || remotePrUrl.value || ''
})

const prLoading = ref(false)
const prError = ref('')
const prSkipped = ref(false)

// Review feedback state
const showReviewFeedback = ref(false)
const prComments = ref<PrComment[]>([])
const fetchingComments = ref(false)
const fixingFeedback = ref(false)
const autoLoadingComments = ref(false)
const feedbackFixed = ref(false)

const isReviewStatus = computed(() =>
  task.value?.status?.name && /review/i.test(task.value.status.name)
)

async function checkExistingPr() {
  if (!task.value) return
  try {
    const { url } = await $fetch<{ url: string | null }>(`/api/tasks/${task.value.id}/pr`, { method: 'GET' })
    if (url) remotePrUrl.value = url
  } catch {}
}

async function handleCreatePr() {
  if (!task.value) return
  if (prUrl.value) return
  prLoading.value = true
  prError.value = ''
  try {
    const res = await $fetch<{ url: string | null; noChanges?: boolean }>(`/api/tasks/${task.value.id}/pr`, { method: 'POST' })
    if (res.noChanges) {
      prSkipped.value = true
    } else {
      activityLogs.value = await fetchActivity(props.taskId)
    }
  } catch (err: any) {
    prError.value = err.message || err.data?.statusMessage || 'Failed to create PR'
  } finally {
    prLoading.value = false
  }
}

let hasAdvanced = false
let isFixRun = false

/**
 * Tracks completion events from the runtime. Incremented each time a new
 * "Done"/"completed"/"exited" log arrives that we haven't acted on yet.
 * The watch below only fires on new increments, solving the problem where
 * runtimeCompleted computed stays `true` after the first run's "Done" message.
 */
const runtimeCompletionTick = ref(0)
const lastCompletionTimestamp = ref(0)

watch(runtimeLogsForTask, async (logs) => {
  if (!task.value || hasAdvanced || prSkipped.value) return
  if (logs.length === 0) return

  // Look for a "Done" or "Exited" message that's newer than what we've already processed.
  // IMPORTANT: "Step completed" also contains the word "completed", so we explicitly
  // exclude it — otherwise the first step completion triggers the handler prematurely
  // and fetchAgentReplies() never fires on the actual "Done".
  const latest = logs[0]
  if (
    /Done|exited/i.test(latest.message) &&
    !/^>?\s*Step /i.test(latest.message) &&
    latest.timestamp > lastCompletionTimestamp.value
  ) {
    lastCompletionTimestamp.value = latest.timestamp
    runtimeCompletionTick.value++
    hasAdvanced = true

    if (isChatMessage.value) {
      // Chat messages should not trigger PR creation or status changes.
      // Reset the flag so the next non-chat run behaves normally.
      isChatMessage.value = false
      addLog('Runtime', 'Chat session ended', props.taskId)

      // Refresh persisted agent replies so the comments section shows them
      await fetchAgentReplies()
      return
    }

    if (isFixRun) {
      feedbackFixed.value = true
      persistLog(props.workspaceId, { entityType: 'task', entityId: props.taskId, entityName: task.value.title, action: 'fix_feedback_completed', message: 'Agent applied PR feedback fixes' })
      isFixRun = false
    } else {
      await autoCreatePr()
      isFixRun = false
    }
    const reviewStatus = props.statuses.find(s => /review/i.test(s.name))
    if (reviewStatus && task.value.statusId !== reviewStatus.id) {
      await handleUpdate('statusId', reviewStatus.id)
      activityLogs.value = await fetchActivity(props.taskId)
    }
  }
})

async function autoCreatePr() {
  if (!task.value || prSkipped.value) return
  if (isFixRun) {
    // For fix runs, push to existing branch instead of creating new PR
    try {
      const res = await $fetch<{ url: string | null; noChanges?: boolean }>(`/api/tasks/${task.value.id}/pr`, { method: 'POST' })
      if (res.noChanges) {
        prSkipped.value = true
      } else {
        // If PR already existed, the create will silently fail but push succeeded
        await checkExistingPr()
        activityLogs.value = await fetchActivity(props.taskId)
      }
    } catch {}
    return
  }
  if (prUrl.value) return
  try {
    const res = await $fetch<{ url: string | null; noChanges?: boolean }>(`/api/tasks/${task.value.id}/pr`, { method: 'POST' })
    if (res.noChanges) {
      prSkipped.value = true
    } else {
      activityLogs.value = await fetchActivity(props.taskId)
    }
  } catch {}
  await checkExistingPr()
}

async function assignTo(assigneeId?: string, assigneeType?: 'user' | 'agent') {
  showAssigneePicker.value = false
  if (!task.value) return
  const oldAssigneeType = task.value.assigneeType
  const updated = await updateTaskApi(task.value.id, {
    assigneeId: assigneeId || null,
    assigneeType: assigneeType || null,
  })
  task.value = updated
  emit('updated', updated)
}

async function loadPersistedComments() {
  if (!task.value || !prUrl.value) return
  autoLoadingComments.value = true
  try {
    const res = await $fetch<{ comments: PrComment[]; prUrl: string; cached?: boolean }>(`/api/tasks/${task.value.id}/pr-comments?prUrl=${encodeURIComponent(prUrl.value)}`, { method: 'GET' })
    if (res.comments.length > 0) {
      prComments.value = res.comments
      showReviewFeedback.value = true
    }
  } catch {
    // Silently fail — user can manually fetch
  } finally {
    autoLoadingComments.value = false
  }
}

async function handleFetchComments() {
  if (!task.value) return
  fetchingComments.value = true
  try {
    const res = await $fetch<{ comments: PrComment[]; prUrl: string }>(`/api/tasks/${task.value.id}/pr-comments?prUrl=${encodeURIComponent(prUrl.value)}&refresh=true`, { method: 'GET' })
    prComments.value = res.comments || []
    showReviewFeedback.value = true
  } catch {
    prComments.value = []
  } finally {
    fetchingComments.value = false
  }
}

async function handleFixFeedback() {
  if (!task.value || prComments.value.length === 0) return
  feedbackFixed.value = false
  fixingFeedback.value = true
  try {
    // Strip HTML from feedback to avoid confusing the agent CLI
    function stripHtml(html: string) {
      return html
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    const feedbackText = prComments.value
      .map(c => {
        const location = c.path ? ` (File: ${c.path}${c.line ? `, line ${c.line}` : ''})` : ''
        return `[Comment by ${c.author}]${location}\n${stripHtml(c.body)}`
      })
      .join('\n\n---\n\n')
      .slice(0, 5000) // Cap at 5000 chars to keep CLI args manageable

    persistLog(props.workspaceId, { entityType: 'task', entityId: props.taskId, entityName: task.value.title, action: 'fix_feedback', message: `Agent fixing ${prComments.value.length} feedback items from PR review` })

    prSkipped.value = false
    isFixRun = true
    hasAdvanced = false

    // Expand runtime logs so user can see the agent working
    runtimeLogsExpanded.value = true

    await startRuntime(task.value.id, feedbackText)
  } catch {
  } finally {
    fixingFeedback.value = false
  }
}

const renderedDescription = computed(() => {
  if (!task.value?.description) return ''
  return task.value.description
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
})

function syncDescription() {
  if (editorRef.value) {
    editorRef.value.innerHTML = task.value?.description
      ? renderedDescription.value
      : ''
  }
}

onMounted(async () => {
  lastCompletionTimestamp.value = Date.now()
  try {
    task.value = await fetchTaskDetail(props.taskId)
    comments.value = await fetchComments(props.taskId)
    activityLogs.value = await fetchActivity(props.taskId)
    await fetchAgentReplies()
  } catch (err) {
    console.error('Failed to load task detail:', err)
  } finally {
    loading.value = false
    nextTick(syncDescription)
  }

  if (task.value && isAgentInProgress.value && !isRunning(task.value.id)) {
    const hasLogs = activityLogs.value.some(l => l.action === 'runtime_log')
    if (!hasLogs) {
      await startRuntime(task.value.id)
    } else {
      const { active } = await $fetch<{ active: boolean }>(`/api/tasks/${task.value.id}/execute/status`)
      if (active) {
        await startRuntime(task.value.id)
      }
    }
  }

  await checkExistingPr()

  // Auto-load persisted PR comments if task is in review status
  if (prUrl.value && isReviewStatus.value) {
    await loadPersistedComments()

    // Reattach to a running fix process if one exists (survives page refresh)
    const hasRuntimeLogs = activityLogs.value.some(l => l.action === 'runtime_log')
    if (hasRuntimeLogs && !isRunning(task.value.id)) {
      try {
        const { active } = await $fetch<{ active: boolean }>(`/api/tasks/${task.value.id}/execute/status`)
        if (active) {
          await startRuntime(task.value.id)
        }
      } catch {}
    }
  }

  // Restore feedbackFixed state from persisted logs (survives page refresh)
  // Only restore if no runtime activity occurred after the fix completed
  // (prevents showing "Fix Applied" when a new agent run is in progress)
  const fixCompletedLog = activityLogs.value.find(l => l.action === 'fix_feedback_completed')
  if (fixCompletedLog) {
    const fixCompletedAt = new Date(fixCompletedLog.createdAt).getTime()
    const hasNewerRuntime = activityLogs.value.some(l =>
      l.action === 'runtime_log' && new Date(l.createdAt).getTime() > fixCompletedAt
    )
    if (!hasNewerRuntime) {
      feedbackFixed.value = true
    }
  }
})

async function handleUpdate(field: string, value: any) {
  if (!task.value) return
  const old = { ...task.value }
  const updated = await updateTaskApi(task.value.id, { [field]: value })
  if (updated && field === 'statusId' && old.statusId !== value) {
    const newStatus = props.statuses.find((s) => s.id === value)
    const oldStatus = props.statuses.find((s) => s.id === old.statusId)
    persistLog(props.workspaceId, { entityType: 'task', entityId: props.taskId, entityName: updated.title, action: 'status_change', message: `Moved from "${oldStatus?.name || '?'}" to "${newStatus?.name || '?'}"` })
    if (newStatus && /progress/i.test(newStatus.name) && updated.assigneeType === 'agent' && updated.assignee) {
      addLog('Runtime', `Agent "${updated.assignee.name}" started processing "${updated.title}"`, props.taskId)
      await startRuntime(updated.id)
    }
  }
  task.value = updated
  emit('updated', updated)
}

function handleDescriptionInput(e: Event) {
  // Simple markdown-style handling
  const html = (e.target as HTMLDivElement).innerHTML
  const plain = html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<div>/g, '\n')
    .replace(/<\/div>/g, '')
    .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
    .replace(/<em>(.+?)<\/em>/g, '*$1*')
    .replace(/&nbsp;/g, ' ')
  if (task.value) {
    task.value.description = plain
  }
  debouncedSave('description', plain)
}

const debouncedSave = useDebounceFn(async (field: string, value: any) => {
  if (!task.value) return
  try {
    await updateTaskApi(task.value.id, { [field]: value })
  } catch (err) {
    console.error(`Failed to save ${field}:`, err)
  }
}, 500)

function toggleBold() {
  document.execCommand('bold')
  editorRef.value?.focus()
}

function toggleItalic() {
  document.execCommand('italic')
  editorRef.value?.focus()
}

function toggleStrike() {
  document.execCommand('strikeThrough')
  editorRef.value?.focus()
}

async function handleAddComment() {
  if (!newComment.value || !task.value) return
  const commentBody = newComment.value
  newComment.value = ''

  // Save the comment to the database
  await addComment(task.value.id, commentBody)
  comments.value = await fetchComments(task.value.id)

  // Detect if the comment @mentions any agent by name (case-insensitive).
  // If so, forward the comment to that agent's runtime — even if the task
  // isn't currently assigned to an agent or "In Progress".
  const mentionedAgent = findMentionedAgent(commentBody)
  const shouldSendToAgent = isAgentInProgress.value || mentionedAgent !== null

  if (shouldSendToAgent) {
    isSendingToAgent.value = true
    runtimeLogsExpanded.value = true

    // Stamp the chat timestamp so the reply bubble only shows fresh logs
    lastAgentChatTimestamp.value = Date.now()

    // Persist the agent identity for reply-bubble rendering
    if (mentionedAgent) {
      mentionedAgentName.value = mentionedAgent.name
      mentionedAgentColor.value = mentionedAgent.color
    }

    // Log the user's message in the runtime feed so it feels like a conversation
    addLog('Runtime', `User: ${commentBody}`, props.taskId)
    persistLog(props.workspaceId, {
      entityType: 'task',
      entityId: props.taskId,
      entityName: task.value.title,
      action: 'runtime_log',
      message: `User: ${commentBody}`,
    })

    try {
      // Reset completion tracking so the watch below re-fires on new "Done"
      isChatMessage.value = true
      hasAdvanced = false
      prSkipped.value = false
      // Clear the previous chat reply so the new one can take its place
      lastChatReplyText.value = null
      lastChatReplyTimestamp.value = 0

      // Build a context message for the agent. Include the @mention as a hint
      // about who the user is talking to, but the full request is always included.
      const agentHint = mentionedAgent
        ? `Addressed to agent "${mentionedAgent.name}" (mentioned via @). `
        : ''

      // Send the comment as feedback and restart the runtime so the agent
      // immediately receives the new instruction
      await startRuntime(
        task.value.id,
        `${agentHint}[USER MESSAGE]\n${commentBody}\n\nPlease respond to this user message appropriately. If it is a question or greeting, respond conversationally. If it requires codebase modifications, make the necessary changes.`
      )
    } catch (err) {
      console.error('Failed to send comment to agent:', err)
      addLog('Runtime', `Failed to send message to agent: ${err}`, props.taskId)
    } finally {
      isSendingToAgent.value = false
    }
  }
}

async function handleDelete() {
  if (!task.value) return
  const taskName = task.value.title
  const taskId = task.value.id
  await deleteTaskApi(taskId)
  persistLog(props.workspaceId, { entityType: 'task', entityId: taskId, entityName: taskName, action: 'delete', message: `Deleted task "${taskName}"` })
  emit('deleted', taskId)
}

async function handleDuplicate() {
  if (!task.value) return
  const backlog = props.statuses.find(s => /backlog/i.test(s.name))
    || props.statuses.find(s => /todo/i.test(s.name))
    || props.statuses[0]
  if (!backlog) return

  const dup = await createTaskApi(props.projectId, {
    title: `${task.value.title} (copy)`,
    statusId: backlog.id,
    description: task.value.description,
    priority: task.value.priority,
    assigneeId: null,
    assigneeType: null,
    repositoryId: task.value.repositoryId,
    labelIds: task.value.labels?.map(l => l.id),
  })

  persistLog(props.workspaceId, { entityType: 'task', entityId: dup.id, entityName: dup.title, action: 'duplicate', message: `Duplicated from "${task.value.title}"` })

  emit('duplicated', dup)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatActivity(log: ActivityLog) {
  switch (log.action) {
    case 'status_change':
      return `moved from "${log.oldValue?.statusName}" to "${log.newValue?.statusName}"`
    case 'assignee_change': {
      const oldType = log.oldValue?.assigneeType
      const newType = log.newValue?.assigneeType
      if (oldType !== 'agent' && newType === 'agent') {
        return 'assigned to runtime agent'
      }
      if (oldType === 'agent' && newType !== 'agent') {
        return 'removed from runtime agent'
      }
      return 'changed assignee'
    }
    case 'comment_added':
      return 'added a comment'
    case 'pr_created':
    case 'pr_updated':
      return log.newValue?.url ? log.action.replace(/_/g, ' ') : 'PR creation failed'
    default:
      return log.action.replace(/_/g, ' ')
  }
}
</script>

<style scoped>
.review-feedback-body :deep(h3) {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  margin: 8px 0 4px;
  line-height: 1.4;
}

.review-feedback-body :deep(h3:first-child) {
  margin-top: 0;
}

.review-feedback-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  background: #e2e8f0;
  padding: 1px 4px;
  border-radius: 3px;
  color: #334155;
}

.review-feedback-body :deep(pre) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  background: #f1f5f9;
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  line-height: 1.5;
  margin: 4px 0;
  color: #475569;
  white-space: pre-wrap;
  word-break: break-word;
}

.review-feedback-body :deep(details) {
  margin: 6px 0;
  font-size: 11px;
}

.review-feedback-body :deep(summary) {
  cursor: pointer;
  font-weight: 500;
  color: #475569;
  padding: 2px 0;
}

.review-feedback-body :deep(summary:hover) {
  color: #1e293b;
}

.review-feedback-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 3px;
  margin: 4px 0;
}

.review-feedback-body :deep(a) {
  color: #6366f1;
  text-decoration: underline;
  word-break: break-all;
}

.review-feedback-body :deep(a:hover) {
  color: #4f46e5;
}

.review-feedback-body :deep(blockquote) {
  border-left: 2px solid #cbd5e1;
  margin: 4px 0;
  padding: 2px 0 2px 8px;
  color: #64748b;
  font-size: 10px;
}

.review-feedback-body :deep(br) {
  display: block;
  content: '';
  margin: 2px 0;
}

.review-feedback-body :deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

.review-feedback-body :deep(em) {
  font-style: italic;
}
</style>
