<template>
  <div class="fixed inset-0 z-50 flex">
    <div class="absolute inset-0 bg-black/20 backdrop-blur-sm dark:bg-black/40" @click="$emit('close')" />

    <div class="absolute right-0 top-0 bottom-0 w-[600px] max-w-[100vw] sm:max-w-[90vw] bg-white shadow-2xl border-l border-surface-200 animate-slide-in-right flex flex-col">
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
            <IconButton
              v-if="prUrl || previewAvailable || previewStarting"
              @click="showPreviewModal = true"
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stroke-surface-500 w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </template>
            </IconButton>
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

        <!-- Floating Open PR banner -->
        <div
          v-if="prUrl"
          class="sticky top-0 z-20 px-6 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between gap-2"
        >
          <span class="text-xs font-medium text-green-700">This task has an open pull request</span>
          <div class="flex items-center gap-2 flex-shrink-0">
            <NuxtLink
              :to="`/workspaces/${route.params.slug}/reviews?task=${task.id}`"
              class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-green-200 text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1.5 no-underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open in Reviews
            </NuxtLink>
            <a
              :href="prUrl"
              target="_blank"
              class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1.5 no-underline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open PR
            </a>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <div class="mb-4">
            <TextInput
              v-model="editingTitle"
              placeholder="Task title"
              class="text-lg font-semibold !border-transparent !bg-transparent !px-0"
              @focus="isTitleFocused = true"
              @blur="handleTitleBlur"
              @keydown.enter.prevent="handleTitleEnter"
            />
            <div v-if="task.branchName || isBacklog" class="flex flex-col gap-1 mt-2">
              <div class="flex items-center gap-2 text-sm text-surface-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-surface-400 flex-shrink-0"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
                <span class="text-[11px] text-surface-500">Branch</span>
                <input
                  v-if="isBacklog"
                  v-model="editingBranchName"
                  type="text"
                  placeholder="feature/my-branch"
                  class="font-mono text-xs text-surface-700 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200 outline-none focus:border-primary-500 w-48"
                  :class="{ '!border-error-500': branchNameError }"
                  @blur="handleBranchNameBlur"
                  @keydown.enter.prevent="handleBranchNameBlur"
                />
                <code v-else class="font-mono text-xs text-surface-700 bg-surface-100 px-1.5 py-0.5 rounded">{{ task.branchName || '—' }}</code>
              </div>
              <p v-if="branchNameError" class="text-[10px] text-error-500 ml-5">{{ branchNameError }}</p>
            </div>
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
                </button>
              </div>
            </div>

            <div class="relative">
              <label class="block text-xs font-medium text-surface-500 mb-1">Observer</label>
              <button
                class="w-full flex items-center gap-2 text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 hover:border-surface-300 transition-colors text-left"
                @click="showObserverPicker = !showObserverPicker"
              >
                <template v-if="task.observer">
                  <Avatar :name="task.observer.name" size="sm" />
                  <span class="flex-1 truncate">{{ task.observer.name }}</span>
                </template>
                <template v-else>
                  <span class="text-surface-400 flex-1">None</span>
                </template>
                <ChevronDown class="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              </button>

              <div
                v-if="showObserverPicker"
                class="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-surface-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
              >
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                  @click="setObserver()"
                >
                  <span class="w-5 h-5 rounded-full border-2 border-dashed border-surface-300 flex items-center justify-center flex-shrink-0" />
                  None
                </button>

                <div v-if="members.length > 0" class="px-3 py-1 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Members</div>
                <button
                  v-for="m in members"
                  :key="m.userId"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  :class="{ 'bg-primary-50': task.observerId === m.userId }"
                  @click="setObserver(m.userId)"
                >
                  <Avatar :name="m.user?.name || 'U'" size="sm" />
                  <span class="truncate">{{ m.user?.name }}</span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-500 mb-1">Labels <span class="text-error-500">*</span></label>
              <div v-if="uniqueAvailableLabels.length > 0" class="flex flex-wrap gap-1.5">
                <button
                  v-for="label in uniqueAvailableLabels"
                  :key="label.id"
                  type="button"
                  class="px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all"
                  :class="task.labels?.some((l: Label) => l.id === label.id)
                    ? 'border-transparent text-white'
                    : 'border-surface-200 text-surface-600 hover:border-surface-300'"
                  :style="task.labels?.some((l: Label) => l.id === label.id) ? { backgroundColor: label.color } : {}"
                  @click="toggleLabel(label.id)"
                >
                  {{ label.name }}
                </button>
              </div>
              <p v-else class="text-xs text-surface-400">No labels available.</p>
              <p v-if="!task.labels?.length" class="text-[10px] text-error-500 mt-1">At least one label is required</p>
            </div>
          </div>

          <div v-if="repositories && repositories.length > 0" class="mb-4">
            <label class="block text-xs font-medium text-surface-500 mb-1">Repository</label>
            <select
              :value="task.repositoryId"
              :disabled="!isBacklog"
              class="w-full text-sm rounded-lg border border-surface-200 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              :class="isBacklog ? 'bg-white cursor-pointer' : 'bg-surface-50 text-surface-500 cursor-not-allowed'"
              @change="handleUpdate('repositoryId', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="repo in repositories" :key="repo.id" :value="repo.id">
                {{ repo.name }} — {{ repo.defaultBranch }}
              </option>
            </select>
            <p class="text-[10px] text-surface-400 mt-1">
              {{ isBacklog ? 'Repository can only be changed while task is in backlog' : 'Repository cannot be changed after task leaves backlog' }}
            </p>
          </div>
          <div v-else class="p-2.5 rounded-lg bg-surface-50 border border-surface-200 mb-4">
            <p class="text-[11px] text-surface-500">
              No repositories connected.
              <NuxtLink
                :to="`/workspaces/${route.params.slug}/settings?tab=repositories&focus=add-repo`"
                class="text-accent underline hover:text-accent-700"
                @click="$emit('close')"
              >
                Add one in settings
              </NuxtLink>
            </p>
          </div>

          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-medium text-surface-500">Description</label>
              <div class="flex bg-surface-100 rounded-lg p-0.5">
                <button
                  type="button"
                  class="px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors"
                  :class="descTab === 'preview' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
                  @click="descTab = 'preview'"
                >
                  Preview
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors"
                  :class="descTab === 'write' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'"
                  @click="descTab = 'write'"
                >
                  Write
                </button>
              </div>
            </div>

            <div class="border border-surface-200 rounded-lg overflow-hidden">
              <div v-if="descTab === 'write'" class="border-b border-surface-100 px-3 py-1.5 flex gap-1 bg-surface-50">
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500 transition-colors" @click="insertFormat('**')">
                  <strong class="text-xs">B</strong>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500 transition-colors" @click="insertFormat('*')">
                  <em class="text-xs">I</em>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500 transition-colors" @click="insertFormat('~~')">
                  <span class="text-xs line-through">S</span>
                </button>
                <button class="p-1 rounded hover:bg-surface-200 text-surface-500 transition-colors" @click="insertFormat('`')">
                  <code class="text-xs bg-surface-200 px-0.5 rounded">&lt;/&gt;</code>
                </button>
              </div>
              <div class="p-3 min-h-[100px]">
                <textarea
                  v-if="descTab === 'write'"
                  v-model="editingDescription"
                  rows="6"
                  class="w-full text-sm text-surface-700 outline-none resize-y min-h-[80px] bg-transparent"
                  placeholder="Add a description..."
                  @blur="handleDescriptionBlur"
                />
                <div
                  v-else
                  class="text-sm text-surface-700 min-h-[80px] max-h-[400px] overflow-y-auto prose prose-sm max-w-none"
                  v-html="renderedDescription"
                />
              </div>
            </div>
          </div>

          <!-- Attachments -->
          <div v-if="attachments.length > 0 || isBacklog" class="mb-6">
            <label class="block text-xs font-medium text-surface-500 mb-2">
              Attachments ({{ attachments.length }})
            </label>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="att in attachments"
                :key="att.id"
                class="relative group cursor-pointer"
                @click="openLightbox(att)"
              >
                <div class="w-16 h-16 rounded-lg overflow-hidden border border-surface-200 bg-surface-100">
                  <img
                    :src="`/api/tasks/${props.taskId}/attachments/${att.id}`"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="hideImage($event)"
                  />
                </div>
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors" />
                <button
                  v-if="isBacklog"
                  type="button"
                  class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-surface-700 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  @click.stop="removeAttachment(att)"
                >
                  <Close class="w-3 h-3" />
                </button>
              </div>

              <!-- Upload slot (backlog only) -->
              <div
                v-if="isBacklog && attachments.length < 3"
                class="w-16 h-16 rounded-lg border-2 border-dashed border-surface-300 bg-surface-50 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-surface-100 transition-colors"
                :class="{ 'opacity-50 cursor-not-allowed': isUploadingAttachment }"
                @click="attachmentInput?.click()"
                @dragover.prevent
                @drop.prevent="handleAttachmentDrop"
              >
                <svg v-if="!isUploadingAttachment" class="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <svg v-else class="animate-spin w-5 h-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <input
                  ref="attachmentInput"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  class="hidden"
                  @change="handleAttachmentFileSelect"
                />
              </div>
            </div>
            <p class="text-[10px] text-surface-400 mt-1">PNG, JPEG — max 10 MB</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-surface-500 mb-3">
              Comments ({{ allComments.length }})
            </label>

            <!-- Comment input -->
            <div class="flex gap-2 mb-4 items-end">
              <div class="flex-1 relative">
                <!-- Custom textarea with @mention support -->
                <div
                  class="w-full rounded-lg overflow-hidden stroke-gray-500 border-2 flex min-h-10"
                  :class="isSendingToAgent ? 'bg-gray-100 cursor-not-allowed' : 'bg-white border-gray-200'"
                >
                  <textarea
                    ref="commentInputRef"
                    v-model="newComment"
                    rows="1"
                    :placeholder="isAgentInProgress ? 'Message the agent...' : 'Write a comment... (type @ to mention someone)'"
                    class="block px-2.5 w-full border-none text-gray-900 bg-transparent focus:ring-0 outline-none resize-none py-2"
                    :disabled="isSendingToAgent"
                    @keydown.enter="handleCommentEnter"
                    @keydown.ctrl.enter.prevent="!mentionActive ? handleAddComment() : null"
                    @keydown.meta.enter.prevent="!mentionActive ? handleAddComment() : null"
                    @keydown.escape="mentionActive = false; showAttachmentPicker = false"
                    @keydown.down.prevent="mentionNavigate(1)"
                    @keydown.up.prevent="mentionNavigate(-1)"
                    @input="handleMentionInput"
                  />
                </div>

                <!-- AGENT badge -->
                <span
                  v-if="isAgentInProgress && newComment.length > 0"
                  class="absolute right-2.5 top-2.5 text-[9px] font-semibold text-primary-400 pointer-events-none"
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

                <!-- Attachment reference picker -->
                <div
                  v-if="showAttachmentPicker && attachments.length > 0"
                  class="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-surface-200 rounded-lg shadow-lg p-2"
                >
                  <div class="text-[10px] font-medium text-surface-400 mb-1.5 px-1">Add image reference</div>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="att in attachments"
                      :key="att.id"
                      class="relative group w-12 h-12 rounded-lg overflow-hidden border border-surface-200 hover:border-primary-400 transition-colors flex-shrink-0"
                      :title="att.originalName"
                      @click="insertAttachmentReference(att)"
                    >
                      <img
                        :src="`/api/tasks/${props.taskId}/attachments/${att.id}`"
                        class="w-full h-full object-cover"
                        loading="lazy"
                        @error="hideImage"
                      />
                    </button>
                  </div>
                </div>
              </div>
              <button
                v-if="attachments.length > 0"
                type="button"
                class="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-50 transition-colors flex-shrink-0 leading-none"
                :class="{ 'bg-primary-50 border-primary-300 text-primary-600': showAttachmentPicker }"
                title="Add image reference"
                @click="showAttachmentPicker = !showAttachmentPicker; mentionActive = false"
              >
                <Icon name="lucide:image" class="w-4 h-4" />
              </button>
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

            <!-- Comments list -->
            <div class="space-y-3 mb-4">
              <template v-for="comment in commentsToShow" :key="comment.id">
                <!-- User comment -->
                <div
                  v-if="!comment.isAgent"
                  class="flex gap-3 p-3 rounded-lg bg-surface-50"
                >
                  <Avatar :name="comment.authorName" size="sm" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-sm font-medium text-surface-900">{{ comment.authorName }}</span>
                      <span class="text-xs text-surface-400 ml-auto">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <div class="text-sm text-surface-700 leading-relaxed comment-body" v-html="parseMarkdown(comment.body)"></div>
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
                    <div class="text-sm text-primary-800 leading-relaxed comment-body" v-html="parseMarkdown(comment.body)"></div>
                  </div>
                </div>
              </template>
            </div>

            <button
              v-if="commentsHasMore"
              @click="commentsExpanded = !commentsExpanded"
              class="mb-4 text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors"
            >
              {{ commentsExpanded ? 'Show less' : `Show ${allComments.length - COMMENTS_COLLAPSE_THRESHOLD} more` }}
            </button>



            <div v-if="userActivityLogs.length > 0" class="mt-6 pt-4 border-t border-surface-100">
              <label class="block text-xs font-medium text-surface-500 mb-3">Activity</label>
              <div class="space-y-2">
                <div
                  v-for="log in activityLogsToShow"
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
              <button
                v-if="activityHasMore"
                @click="activityExpanded = !activityExpanded"
                class="mt-2 text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors"
              >
                {{ activityExpanded ? 'Show less' : `Show ${userActivityLogs.length - ACTIVITY_COLLAPSE_THRESHOLD} more` }}
              </button>
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

              <div v-if="previewAvailable" class="mt-3">
                <button
                  class="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5"
                  @click="showPreviewModal = true"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Open Preview
                </button>
              </div>

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

                  <!-- Auth error - missing token -->
                  <div
                    v-if="prCommentsNeedAuth"
                    class="p-3 rounded-lg bg-amber-50 border border-amber-200"
                  >
                    <div class="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <div>
                        <p class="text-[11px] font-medium text-amber-700 mb-1">Access token required</p>
                        <p class="text-[10px] text-amber-600 mb-2">This self-hosted GitLab instance requires an access token to fetch PR comments.</p>
                        <NuxtLink
                          :to="`/workspaces/${route.params.slug}/settings`"
                          class="text-[10px] font-semibold text-amber-700 underline hover:text-amber-800"
                          @click="$emit('close')"
                        >
                          Go to Workspace Settings → Repositories → Add token
                        </NuxtLink>
                      </div>
                    </div>
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
                      <div class="text-[11px] text-surface-600 leading-relaxed review-feedback-body" v-html="parseMarkdown(comment.body)" />
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

  <!-- Preview Modal -->
  <div
    v-if="showPreviewModal"
    class="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    @click.self="showPreviewModal = false"
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
        <span class="text-sm font-semibold text-surface-700 flex-shrink-0">Live Preview</span>
        <div class="flex-1 flex items-center gap-2 bg-surface-50 rounded-lg px-3 py-1.5 border border-surface-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-surface-400 flex-shrink-0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <input
            v-model="previewPath"
            type="text"
            class="w-full bg-transparent text-xs text-surface-700 outline-none"
            placeholder="Enter path (e.g. /login)"
            @keydown.enter="navigatePreview"
          >
        </div>
        <button class="text-surface-400 hover:text-surface-600 flex-shrink-0" @click="showPreviewModal = false">
          <Close class="w-4 h-4" />
        </button>
      </div>
      <div v-if="previewUrl" class="flex-1">
        <iframe
          :src="previewIframeUrl"
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </div>
      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center text-surface-400 gap-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <p class="text-sm font-medium">No preview available yet</p>
        <p class="text-xs">Start a preview server to see your changes live.</p>
        <Button
          :disabled="previewStarting || !task"
          :loading="previewStarting"
          @click="handleStartPreview"
        >
          <template v-if="previewStarting">
            Starting preview server...
          </template>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5"><polygon points="5,3 19,12 5,21"/></svg>
            Start Preview
          </template>
        </Button>
      </div>
    </div>
  </div>

  <!-- Lightbox -->
  <div
    v-if="lightboxImage"
    class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    @click.self="closeLightbox"
  >
    <div class="relative max-w-full max-h-full">
                <img
                    :src="`/api/tasks/${props.taskId}/attachments/${lightboxImage.id}`"
                    class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                    loading="lazy"
                  />
      <button
        class="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-surface-600 hover:text-surface-900 transition-colors"
        @click="closeLightbox"
      >
        <Close class="w-4 h-4" />
      </button>
      <p class="text-center text-white text-sm mt-2 font-medium">
        {{ lightboxImage.originalName }}
      </p>
    </div>
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
import type { Task, Status, Label, Comment, ActivityLog, ProjectMember, Repository, PrComment, Attachment } from '~/types'
import type { Agent } from '~/types'
import { validateBranchName } from '~/utils/branch-validation'
import { useDebounceFn } from '@vueuse/core'
import { nextTick, onUnmounted } from 'vue'

const { addLog, persistLog, logs: runtimeLogs } = useLog()
const { createLabel } = useProject()
const route = useRoute()

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
  uploadAttachment,
  deleteAttachment,
} = useTask()

interface BrowserSession {
  id: string
  taskId: string
  agentId: string | null
  status: string
  summary: string | null
  error: string | null
  screenshotPath: string | null
  outputDir: string | null
  headed: boolean | null
  createdAt: string
  updatedAt: string
}

const loading = ref(true)
const task = ref<Task | null>(null)
const browserSession = ref<BrowserSession | null>(null)
const screenshotError = ref(false)
const comments = ref<Comment[]>([])
const activityLogs = ref<ActivityLog[]>([])
const newComment = ref('')
const showAttachmentPicker = ref(false)
const confirmDelete = ref(false)
const showAssigneePicker = ref(false)
const showObserverPicker = ref(false)
const previewAvailable = ref(false)
const previewUrl = ref('')
const showPreviewModal = ref(false)
const previewStarting = ref(false)
const previewPath = ref('/')
const committedPreviewPath = ref('/')

const previewIframeUrl = computed(() => {
  if (!previewUrl.value) return ''
  const base = previewUrl.value.replace(/\/$/, '')
  const path = committedPreviewPath.value.startsWith('/') ? committedPreviewPath.value : '/' + committedPreviewPath.value
  return base + path
})

function navigatePreview() {
  committedPreviewPath.value = previewPath.value || '/'
}

const DEFAULT_LABELS = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#22c55e' },
  { name: 'improvement', color: '#3b82f6' },
  { name: 'docs', color: '#a855f7' },
  { name: 'chore', color: '#6b7280' },
]

const availableLabels = ref<Label[]>([...props.labels])

watch(() => props.labels, (newLabels) => {
  availableLabels.value = [...newLabels]
}, { immediate: true })

// Reset preview state when modal opens/closes
watch(showPreviewModal, (isOpen) => {
  if (isOpen) {
    previewPath.value = '/'
    committedPreviewPath.value = '/'
  } else {
    previewStarting.value = false
  }
})

const uniqueAvailableLabels = computed(() => {
  const seen = new Set<string>()
  return availableLabels.value.filter((l) => {
    if (seen.has(l.name)) return false
    seen.add(l.name)
    return true
  })
})

async function ensureDefaultLabels() {
  const existingNames = new Set(availableLabels.value.map((l) => l.name))
  const missing = DEFAULT_LABELS.filter((d) => !existingNames.has(d.name))
  if (missing.length === 0) return

  const created: Label[] = []
  for (const def of missing) {
    try {
      const label = await createLabel(props.projectId, def)
      created.push(label)
    } catch {
      // ignore duplicate or creation errors
    }
  }
  if (created.length > 0) {
    availableLabels.value = [...availableLabels.value, ...created]
  }
}

// ─── Description editor ───
const descTab = ref<'write' | 'preview'>('preview')
const editingDescription = ref('')
const editingTitle = ref('')
const editingBranchName = ref('')
const branchNameError = ref('')
const isTitleFocused = ref(false)

const isAgentInProgress = computed(() => {
  return (
    task.value?.assigneeType === 'agent' &&
    task.value?.assignee &&
    task.value?.status?.name &&
    /progress/i.test(task.value.status.name)
  )
})

const isBacklog = computed(() =>
  task.value?.status?.name && /backlog/i.test(task.value.status.name)
)

/** Tracks when we are sending a comment to the agent runtime */
const isSendingToAgent = ref(false)

/**
 * When `true`, the current runtime was triggered by a chat comment from the
 * user, so completion should NOT auto-create a PR or change the task status.
 */
const isChatMessage = ref(false)

// ─── @mention autocomplete ───

/** Reference to the raw comment textarea element for cursor manipulation */
const commentInputRef = ref<HTMLTextAreaElement | null>(null)

/** Auto-resize the comment textarea based on its content */
function autoResizeCommentTextarea() {
  const el = commentInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

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
 * Called on every keystroke in the comment textarea. Detects "@" followed by a
 * query string (no spaces) and activates the mention dropdown.
 */
function handleMentionInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  const val = textarea.value
  const cursorPos = textarea.selectionStart || 0

  // Auto-resize textarea as content changes
  autoResizeCommentTextarea()

  // Close attachment picker when user types
  if (showAttachmentPicker.value) {
    showAttachmentPicker.value = false
  }

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

/** Handle Enter key in the comment textarea */
function handleCommentEnter(e: KeyboardEvent) {
  if (mentionActive.value) {
    e.preventDefault()
    selectMention(mentionOptions.value[mentionSelectedIndex.value])
  }
  // Otherwise allow default newline behaviour
}

/** Navigate the dropdown with arrow keys */
function mentionNavigate(dir: number) {
  const len = mentionOptions.value.length
  if (len === 0) return
  mentionSelectedIndex.value = (mentionSelectedIndex.value + dir + len) % len
}

/** Insert the selected mention into the comment text */
function selectMention(option: { name: string }) {
  const textarea = commentInputRef.value
  if (!textarea) return

  const val = textarea.value
  const cursorPos = textarea.selectionStart || 0
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

  // Restore focus, place cursor right after the inserted name, and resize
  nextTick(() => {
    textarea.focus()
    const newPos = atIndex + option.name.length + 2
    textarea.setSelectionRange(newPos, newPos)
    autoResizeCommentTextarea()
  })
}

/** Insert a markdown image reference to an existing task attachment at the cursor position */
function insertAttachmentReference(att: Attachment) {
  const textarea = commentInputRef.value
  if (!textarea) return

  const val = textarea.value
  const cursorPos = textarea.selectionStart || 0
  const imageMarkdown = `![${att.originalName}](/api/tasks/${props.taskId}/attachments/${att.id})`

  // Insert at cursor with a leading space if not at start and no preceding space/newline
  const needsLeadingSpace = cursorPos > 0 && !/[\s\n]/.test(val[cursorPos - 1])
  const prefix = needsLeadingSpace ? ' ' : ''

  // Add trailing newline if at end or no trailing newline
  const needsTrailingNewline = cursorPos === val.length || !/[\s\n]/.test(val[cursorPos] || '')
  const suffix = needsTrailingNewline ? '\n' : ''

  const newVal = val.slice(0, cursorPos) + prefix + imageMarkdown + suffix + val.slice(cursorPos)
  newComment.value = newVal
  showAttachmentPicker.value = false

  nextTick(() => {
    textarea.focus()
    const newPos = cursorPos + prefix.length + imageMarkdown.length + suffix.length
    textarea.setSelectionRange(newPos, newPos)
    autoResizeCommentTextarea()
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

  // Only show agent replies when:
  // 1. User explicitly messaged the agent (chat session), OR
  // 2. Task is in a terminal state (Done), OR
  // 3. Agent runtime has completed (so the final summary is visible)
  const isDone = task.value?.status?.name && /done/i.test(task.value.status.name)
  if (lastAgentChatTimestamp.value === 0 && !isDone && !runtimeCompleted.value) return null

  // Only show logs from the current chat session (after last agent-directed comment)
  const recentLogs = lastAgentChatTimestamp.value > 0
    ? logs.filter(log => log.timestamp >= lastAgentChatTimestamp.value)
    : logs

  if (recentLogs.length === 0) return null

  // Find the most recent explicit agent reply — only messages that are
  // clearly marked as agent output. Never treat random runtime logs as replies.
  for (const log of recentLogs) {
    const msg = log.message.replace(/^>\s*/, '')
    if (msg.startsWith('[AGENT_REPLY]')) {
      return msg.replace(/^\[AGENT_REPLY\]\s*/, '')
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
    const fetched = await $fetch(`/api/tasks/${task.value.id}/agent-replies`) as Array<{ id: string; body: string; createdAt: string; agentName: string; agentColor?: string }>
    agentReplies.value = fetched
    // Only clear the in-memory bridge once we confirm the reply was persisted.
    // This prevents a gap where no agent reply is visible during the fetch.
    const alreadyPersisted = fetched.some(
      (r) => r.body === lastChatReplyText.value
    )
    if (alreadyPersisted) {
      lastChatReplyText.value = null
      lastChatReplyTimestamp.value = 0
    }
  } catch {
    agentReplies.value = []
  }
}

async function fetchBrowserSession() {
  if (!task.value) return
  try {
    const session = await $fetch<BrowserSession | null>(`/api/tasks/${task.value.id}/browser-session`)
    browserSession.value = session
    screenshotError.value = false
  } catch {
    browserSession.value = null
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
    // Stable timestamp: prefer the bridged timestamp (set by watch(latestAgentReply))
    // so the in-memory reply doesn't flicker to the top on every computed re-evaluation.
    const replyTimestamp = lastChatReplyTimestamp.value || Date.now()
    // Unique key based on a content fingerprint so Vue doesn't recycle the DOM
    // element when the body changes or when the list re-orders.
    const contentFingerprint = inMemoryBody.slice(0, 40).replace(/\s+/g, '-')
    merged.push({
      id: `in-memory-reply-${contentFingerprint}-${replyTimestamp}`,
      body: inMemoryBody,
      createdAt: replyTimestamp,
      authorName: isLive ? chatAgentIdentity.value.name : (lastChatReplyAuthor.value || chatAgentIdentity.value.name),
      authorColor: isLive ? (chatAgentIdentity.value.color || '#6366f1') : (lastChatReplyAuthorColor.value || '#6366f1'),
      isAgent: true,
    })
  }

  return merged.sort((a, b) => b.createdAt - a.createdAt)
})

const COMMENTS_COLLAPSE_THRESHOLD = 10
const commentsExpanded = ref(false)
const commentsToShow = computed(() => {
  if (commentsExpanded.value || allComments.value.length <= COMMENTS_COLLAPSE_THRESHOLD) {
    return allComments.value
  }
  return allComments.value.slice(0, COMMENTS_COLLAPSE_THRESHOLD)
})
const commentsHasMore = computed(() => allComments.value.length > COMMENTS_COLLAPSE_THRESHOLD)

const { startRuntime, stopRuntime, isRunning } = useAgentRuntime()
const runtimeActive = computed(() => task.value ? isRunning(task.value.id) : false)

// ─── Attachments ───
const { fetchAttachments } = useTask()
const attachments = ref<Attachment[]>([])
const lightboxImage = ref<Attachment | null>(null)
const attachmentInput = ref<HTMLInputElement | null>(null)
const isUploadingAttachment = ref(false)

async function loadAttachments() {
  if (!task.value) return
  try {
    attachments.value = await fetchAttachments(task.value.id)
  } catch {
    attachments.value = []
  }
}

async function checkPreview() {
  if (!task.value) return
  try {
    const status = await $fetch<{ available: boolean; url?: string }>(`/api/tasks/${task.value.id}/preview-status`)
    previewAvailable.value = status.available
    previewUrl.value = status.url || ''
  } catch {
    previewAvailable.value = false
    previewUrl.value = ''
  }
}

async function handleStartPreview() {
  if (!task.value || previewStarting.value) return
  previewStarting.value = true
  try {
    const result = await $fetch<{ available: boolean; url: string; message: string }>(`/api/tasks/${task.value.id}/preview-start`, {
      method: 'POST',
    })
    previewAvailable.value = result.available
    previewUrl.value = result.url
    // Poll for a few seconds to confirm the server is truly ready
    let attempts = 0
    const pollInterval = setInterval(async () => {
      attempts++
      await checkPreview()
      if (previewAvailable.value || attempts >= 10) {
        clearInterval(pollInterval)
        previewStarting.value = false
      }
    }, 2000)
  } catch (err: any) {
    console.error('Failed to start preview:', err)
    previewStarting.value = false
  }
}

function openLightbox(att: Attachment) {
  lightboxImage.value = att
}

function closeLightbox() {
  lightboxImage.value = null
}

function hideImage(e: Event) {
  const target = e.target as HTMLImageElement
  if (target) {
    target.style.display = 'none'
  }
}

async function handleAttachmentFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0 || !task.value) return
  await uploadAttachmentFile(input.files[0])
  input.value = ''
}

async function handleAttachmentDrop(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer?.files.length || !task.value) return
  await uploadAttachmentFile(event.dataTransfer.files[0])
}

async function uploadAttachmentFile(file: File) {
  if (!task.value) return
  if (attachments.value.length >= 3) {
    alert('Attachment limit reached (max 3)')
    return
  }
  isUploadingAttachment.value = true
  try {
    const newAtt = await uploadAttachment(task.value.id, file)
    attachments.value.push(newAtt)
  } catch (err: any) {
    alert(err?.message || 'Failed to upload attachment')
  } finally {
    isUploadingAttachment.value = false
  }
}

async function removeAttachment(att: Attachment) {
  if (!task.value) return
  if (!confirm('Are you sure you want to delete this attachment?')) return
  try {
    await deleteAttachment(task.value.id, att.id)
    attachments.value = attachments.value.filter((a) => a.id !== att.id)
  } catch {
    alert('Failed to delete attachment')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightboxImage.value) {
    closeLightbox()
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

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
  if (!active && task.value) {
    // Do NOT clear lastChatReplyText here — let fetchAgentReplies decide
    // after the API returns whether the reply was already persisted.
    // This prevents a gap where no agent reply is visible during the fetch.
    setTimeout(async () => {
      await fetchAgentReplies()
      await checkPreview()
      await fetchBrowserSession()
    }, 500)
  }
})

function computedInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function formatTimeFromMs(ts: number) {
  const date = new Date(ts)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
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

const ACTIVITY_COLLAPSE_THRESHOLD = 10
const activityExpanded = ref(false)
const activityLogsToShow = computed(() => {
  if (activityExpanded.value || userActivityLogs.value.length <= ACTIVITY_COLLAPSE_THRESHOLD) {
    return userActivityLogs.value
  }
  return userActivityLogs.value.slice(0, ACTIVITY_COLLAPSE_THRESHOLD)
})
const activityHasMore = computed(() => userActivityLogs.value.length > ACTIVITY_COLLAPSE_THRESHOLD)

const runtimeLogsForTask = computed(() => {
  const inMemoryLogs = runtimeLogs.value
    .filter(log => log.taskId === props.taskId)
    .map(log => ({
      id: `runtime-${log.time}`,
      message: log.msg,
      displayTime: formatTimeFromMs(log.time),
      timestamp: log.time,
    }))

  const persistedLogs = activityLogs.value
    .filter(log => log.action === 'runtime_log')
    .map(log => ({
      id: `persisted-${log.id}`,
      message: `> ${log.newValue?.message || ''}`,
      displayTime: formatTimeFromMs(new Date(log.createdAt).getTime()),
      timestamp: new Date(log.createdAt).getTime(),
    }))

  return [...inMemoryLogs, ...persistedLogs].sort((a, b) => b.timestamp - a.timestamp)
})

const latestRuntimeLog = computed(() => runtimeLogsForTask.value[0] || null)

const runtimeCompleted = computed(() =>
  runtimeLogsForTask.value.some(log => />?\s*Done$/.test(log.message))
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

watch(() => props.taskId, () => {
  debouncedSaveTitle.cancel()
  isTitleFocused.value = false
  editingBranchName.value = task.value?.branchName || ''
  branchNameError.value = ''
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
const prCommentsNeedAuth = ref(false)
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

const hasAdvanced = ref(false)
let isFixRun = false

/**
 * Tracks completion events from the runtime. Incremented each time a new
 * "Done" log arrives that we haven't acted on yet.
 * The watch below only fires on new increments, solving the problem where
 * the completion handler would re-fire on old persisted logs after mount.
 */
const runtimeCompletionTick = ref(0)
const lastCompletionTimestamp = ref(Date.now())

watch(runtimeLogsForTask, async (logs) => {
  if (!task.value || hasAdvanced.value || prSkipped.value) return
  if (logs.length === 0) return

  // Only react to the *current* run's "Done" message.
  // We ignore "exited" (crashed / killed / SIGTERM) because that is NOT a
  // successful completion — the agent didn't finish its work.
  const latest = logs[0]
  if (
    />?\s*Done$/.test(latest.message) &&
    latest.timestamp > lastCompletionTimestamp.value
  ) {
    lastCompletionTimestamp.value = latest.timestamp
    runtimeCompletionTick.value++
    hasAdvanced.value = true

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
  const updated = await updateTaskApi(task.value.id, {
    assigneeId: assigneeId || null,
    assigneeType: assigneeType || null,
  })
  task.value = updated
  emit('updated', updated)
}

async function setObserver(observerId?: string) {
  showObserverPicker.value = false
  if (!task.value) return
  const updated = await updateTaskApi(task.value.id, {
    observerId: observerId || null,
  })
  task.value = updated
  emit('updated', updated)
}

async function loadPersistedComments() {
  if (!task.value || !prUrl.value) return
  autoLoadingComments.value = true
  prCommentsNeedAuth.value = false
  try {
    const res = await $fetch<{ comments: PrComment[]; prUrl: string; cached?: boolean; needsAuth?: boolean }>(`/api/tasks/${task.value.id}/pr-comments?prUrl=${encodeURIComponent(prUrl.value)}`, { method: 'GET' })
    if (res.needsAuth) {
      prCommentsNeedAuth.value = true
      showReviewFeedback.value = true
    } else if (res.comments.length > 0) {
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
  prCommentsNeedAuth.value = false
  try {
    const res = await $fetch<{ comments: PrComment[]; prUrl: string; needsAuth?: boolean }>(`/api/tasks/${task.value.id}/pr-comments?prUrl=${encodeURIComponent(prUrl.value)}&refresh=true`, { method: 'GET' })
    if (res.needsAuth) {
      prCommentsNeedAuth.value = true
      showReviewFeedback.value = true
    } else {
      prComments.value = res.comments || []
      showReviewFeedback.value = true
    }
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
    // Delegate to the server endpoint which refreshes comments from GitHub,
    // persists them to the database, and stores feedback for the runtime.
    const res = await $fetch<{ success: true; taskId: string; commentCount: number; feedbackLength: number }>(
      `/api/tasks/${task.value.id}/fix-feedback`,
      { method: 'POST' }
    )

    persistLog(props.workspaceId, {
      entityType: 'task',
      entityId: props.taskId,
      entityName: task.value.title,
      action: 'fix_feedback',
      message: `Agent fixing ${res.commentCount} feedback items from PR review`,
    })

    prSkipped.value = false
    isFixRun = true
    hasAdvanced.value = false

    // Expand runtime logs so user can see the agent working
    runtimeLogsExpanded.value = true

    // The server already stored the feedback; we just need to start the runtime stream
    await startRuntime(res.taskId)
  } catch (err: any) {
    console.error('Failed to fix feedback:', err)
  } finally {
    fixingFeedback.value = false
  }
}

function parseMarkdown(md: string): string {
  if (!md) return '<p class="text-surface-400 italic">No description provided</p>'

  // 1. Extract fenced code blocks first so they don't get processed by other rules
  const codeBlocks: string[] = []
  let processed = md.replace(/```(\w*)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(code)
    return `__FENCED_BLOCK_${idx}__`
  })

  // 2. Extract inline code so it doesn't get wrapped in paragraphs
  const inlineCodes: string[] = []
  processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = inlineCodes.length
    inlineCodes.push(code)
    return `__INLINE_CODE_${idx}__`
  })

  // 3. Process markdown structure
  processed = processed
    .replace(/^(#{1,6})\s+(.*)$/gm, (_, hashes, text) => {
      const level = hashes.length
      return `<h${level} class="font-semibold text-slate-800 mt-2 mb-1">${text}</h${level}>`
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg border border-surface-200 max-w-full my-2" />')
    .replace(/^\s*[-*+]\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^\s*\d+\.\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(.*)$/gm, (match) => {
      // Don't wrap placeholders, images, or empty lines in paragraphs
      if (/^__(FENCED_BLOCK|INLINE_CODE)_\d+__$/.test(match.trim()) || !match.trim() || /^<img\b/.test(match.trim())) return match
      return `<p class="mb-1">${match}</p>`
    })
    .replace(/<p class="mb-1"><h(\d)[^>]*>(.*?)<\/h\d><\/p>/g, '<h$1 class="font-semibold text-slate-800 mt-2 mb-1">$2</h$1>')
    .replace(/<p class="mb-1"><li class="ml-4">(.*?)<\/li><\/p>/g, '<li class="ml-4">$1</li>')
    .replace(/(<li class="ml-4">.*?<\/li>\s*)+/g, '<ul class="list-disc pl-2 my-1">$&</ul>')
    .replace(/\n/g, '')

  // 4. Restore inline code
  processed = processed.replace(/__INLINE_CODE_(\d+)__/g, (_match, idx) => {
    return `<code>${inlineCodes[parseInt(idx)]}</code>`
  })

  // 5. Restore fenced code blocks as <pre><code>
  processed = processed.replace(/__FENCED_BLOCK_(\d+)__/g, (_match, idx) => {
    const code = codeBlocks[parseInt(idx)]
    return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  })

  return processed
}

const renderedDescription = computed(() => {
  return parseMarkdown(task.value?.description || '')
})

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  try {
    await ensureDefaultLabels()
    task.value = await fetchTaskDetail(props.taskId)
    comments.value = await fetchComments(props.taskId)
    activityLogs.value = await fetchActivity(props.taskId)
    await fetchAgentReplies()
    await loadAttachments()
    await fetchBrowserSession()
  } catch (err) {
    console.error('Failed to load task detail:', err)
  } finally {
    loading.value = false
    editingDescription.value = task.value?.description || ''
    editingTitle.value = task.value?.title || ''
    editingBranchName.value = task.value?.branchName || ''
  }

  // Initialize lastCompletionTimestamp from the most recent "Done" log
  // so the watch only reacts to NEW completions, not old persisted ones.
  const doneLog = runtimeLogsForTask.value.find(log => />?\s*Done$/.test(log.message))
  lastCompletionTimestamp.value = doneLog ? doneLog.timestamp : Date.now()

  // Handle runtime that already completed while the panel was closed
  if (task.value && !runtimeActive.value && runtimeCompleted.value && !hasAdvanced.value) {
    if (!isReviewStatus.value && !/done/i.test(task.value.status?.name || '')) {
      await autoCreatePr()
      const reviewStatus = props.statuses.find(s => /review/i.test(s.name))
      if (reviewStatus && task.value.statusId !== reviewStatus.id) {
        await handleUpdate('statusId', reviewStatus.id)
        activityLogs.value = await fetchActivity(props.taskId)
      }
      hasAdvanced.value = true
    }
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
    await checkPreview()

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
  // Title is handled separately via debouncedSaveTitle / handleTitleBlur
  if (field === 'title') return
  const old = { ...task.value }
  try {
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
  } catch {
    // Revert local state on error so the UI stays in sync
    if (field === 'repositoryId') {
      // Force a re-render of the select by reassigning task
      task.value = { ...old }
    }
  }
}

// ── Debounced saves with race protection ──

let lastDescriptionSaveCounter = 0

async function saveDescription(value: string) {
  if (!task.value) return
  const currentSave = ++lastDescriptionSaveCounter
  try {
    const updated = await updateTaskApi(task.value.id, { description: value })
    if (updated && lastDescriptionSaveCounter === currentSave) {
      task.value = updated
      emit('updated', updated)
    }
  } catch (err) {
    console.error('Failed to save description:', err)
  }
}

const debouncedSaveDescription = useDebounceFn((value: string) => saveDescription(value), 800)

function handleDescriptionBlur() {
  if (!task.value) return
  const plain = editingDescription.value
  if (plain !== task.value.description) {
    debouncedSaveDescription.cancel()
    saveDescription(plain)
  }
}

// Counter to prevent stale debounced saves from overwriting newer ones.
// Each save attempt increments the counter; only the most recent one applies.
let lastTitleSaveCounter = 0

async function saveTitle(value: string) {
  if (!task.value) return
  const currentSave = ++lastTitleSaveCounter
  try {
    const updated = await updateTaskApi(task.value.id, { title: value })
    // Only apply if this is still the most recent save attempt.
    // This prevents an in-flight debounced save from overwriting a newer blur save.
    if (updated && lastTitleSaveCounter === currentSave) {
      task.value = updated
      emit('updated', updated)
    }
  } catch (err) {
    console.error('Failed to save title:', err)
  }
}

const debouncedSaveTitle = useDebounceFn((value: string) => saveTitle(value), 800)

function handleTitleBlur() {
  isTitleFocused.value = false
  if (!task.value) return
  const value = editingTitle.value.trim()
  if (value && value !== task.value.title) {
    debouncedSaveTitle.cancel()
    saveTitle(value)
  }
}

function handleTitleEnter() {
  if (!task.value) return
  const value = editingTitle.value.trim()
  if (value && value !== task.value.title) {
    debouncedSaveTitle.cancel()
    saveTitle(value)
  }
  // Blur the input so focus moves away and user sees the save happened
  const input = document.querySelector('.mb-4 input[type="text"]') as HTMLInputElement
  input?.blur()
}

async function saveBranchName(value: string) {
  if (!task.value) return
  try {
    const updated = await updateTaskApi(task.value.id, { branchName: value || null })
    task.value = updated
    emit('updated', updated)
  } catch (err: any) {
    console.error('Failed to save branch name:', err)
    // Revert on error
    editingBranchName.value = task.value.branchName || ''
  }
}

function handleBranchNameBlur() {
  if (!task.value || !isBacklog.value) return
  const value = editingBranchName.value.trim()
  const error = validateBranchName(value)
  branchNameError.value = error
  if (!error && value !== (task.value.branchName || '')) {
    saveBranchName(value)
  }
}

watch(editingTitle, (value) => {
  if (isTitleFocused.value && task.value && value !== task.value.title) {
    debouncedSaveTitle(value)
  }
})

watch(editingDescription, (value) => {
  if (task.value && value !== task.value.description) {
    debouncedSaveDescription(value)
  }
})

function toggleLabel(labelId: string) {
  if (!task.value) return
  const currentIds = task.value.labels?.map((l: Label) => l.id) || []
  const idx = currentIds.indexOf(labelId)
  let nextIds: string[]
  if (idx === -1) {
    nextIds = [...currentIds, labelId]
  } else {
    nextIds = currentIds.filter((id: string) => id !== labelId)
  }
  // Prevent removing the last label so it stays mandatory
  if (nextIds.length === 0) return
  task.value = { ...task.value, labels: uniqueAvailableLabels.value.filter((l: Label) => nextIds.includes(l.id)) }
  handleUpdate('labelIds', nextIds)
}

function insertFormat(wrap: string) {
  const textarea = document.querySelector('.mb-6 textarea') as HTMLTextAreaElement
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const val = editingDescription.value
  const before = val.slice(0, start)
  const selected = val.slice(start, end)
  const after = val.slice(end)
  editingDescription.value = before + wrap + (selected || wrap) + wrap + after
  nextTick(() => {
    textarea.focus()
    const newPos = start + wrap.length + (selected || wrap).length + wrap.length
    textarea.setSelectionRange(newPos, newPos)
  })
}

async function handleAddComment() {
  if (!newComment.value || !task.value) return
  const commentBody = newComment.value
  newComment.value = ''
  showAttachmentPicker.value = false

  // Reset textarea height after clearing
  nextTick(() => {
    if (commentInputRef.value) {
      commentInputRef.value.style.height = 'auto'
    }
  })

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
      hasAdvanced.value = false
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
    branchName: task.value.branchName,
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

.review-feedback-body :deep(pre) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  background: #f1f5f9;
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  line-height: 1.5;
  margin: 4px 0;
  color: #334155;
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
.dark .review-feedback-body :deep(a) {
  color: #a5b4fc;
}

.review-feedback-body :deep(a:hover) {
  color: #4f46e5;
}
.dark .review-feedback-body :deep(a:hover) {
  color: #c7d2fe;
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
.dark .review-feedback-body :deep(strong) {
  color: #f1f5f9;
}

.review-feedback-body :deep(em) {
  font-style: italic;
}

.review-feedback-body :deep(h1),
.review-feedback-body :deep(h2),
.review-feedback-body :deep(h3),
.review-feedback-body :deep(h4) {
  font-weight: 600;
  color: #1e293b;
  margin: 6px 0 3px;
  line-height: 1.3;
}
.dark .review-feedback-body :deep(h1),
.dark .review-feedback-body :deep(h2),
.dark .review-feedback-body :deep(h3),
.dark .review-feedback-body :deep(h4) {
  color: #f1f5f9;
}

.review-feedback-body :deep(h1) { font-size: 12px; }
.review-feedback-body :deep(h2) { font-size: 11px; }
.review-feedback-body :deep(h3),
.review-feedback-body :deep(h4) { font-size: 10px; }

.review-feedback-body :deep(p) {
  margin: 2px 0;
}

.review-feedback-body :deep(ul),
.review-feedback-body :deep(ol) {
  margin: 3px 0;
  padding-left: 14px;
}

.review-feedback-body :deep(li) {
  margin: 1px 0;
}

.review-feedback-body :deep(code) {
  background: #f1f5f9;
  color: #334155;
  padding: 0 3px;
  border-radius: 3px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
}
.dark .review-feedback-body :deep(code) {
  background: #334155;
  color: #f8fafc !important;
}

.review-feedback-body :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 4px 0;
  font-size: 9px;
  line-height: 1.4;
}
.dark .review-feedback-body :deep(pre) {
  background: #1e293b;
  color: #f8fafc !important;
}

.review-feedback-body :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
.dark .review-feedback-body :deep(pre code) {
  color: #f8fafc !important;
}

/* Override old Tailwind classes in persisted agent comments for dark mode readability */
.dark .review-feedback-body :deep(.bg-slate-100) {
  background-color: #334155 !important;
  color: #f8fafc !important;
}
.dark .review-feedback-body :deep(.text-slate-800) {
  color: #f1f5f9 !important;
}

.review-feedback-body :deep(hr) {
  margin: 6px 0;
  border-color: #e2e8f0;
}
.dark .review-feedback-body :deep(hr) {
  border-color: #334155;
}

/* ─── Description markdown preview (prose) ─── */
.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3),
.prose :deep(h4) {
  margin-top: 0.5em;
  margin-bottom: 0.25em;
  color: #1e293b;
}
.dark .prose :deep(h1),
.dark .prose :deep(h2),
.dark .prose :deep(h3),
.dark .prose :deep(h4) {
  color: #f1f5f9;
}
.prose :deep(p) {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}
.prose :deep(ul),
.prose :deep(ol) {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
  padding-left: 1.25em;
}
.prose :deep(li) {
  margin-top: 0.125em;
  margin-bottom: 0.125em;
}
.prose :deep(code) {
  background: #f1f5f9;
  padding: 0.125em 0.375em;
  border-radius: 4px;
  font-size: 0.875em;
}
.dark .prose :deep(code) {
  background: #1e293b;
  color: #f8fafc !important;
}
.prose :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.75em 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.dark .prose :deep(pre) {
  background: #1e293b;
  color: #f8fafc !important;
}
.prose :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}
.dark .prose :deep(pre code) {
  color: #f8fafc !important;
}

/* Override old Tailwind classes in persisted content for dark mode readability */
.dark .prose :deep(.bg-slate-100) {
  background-color: #334155 !important;
  color: #f8fafc !important;
}
.dark .prose :deep(.text-slate-800) {
  color: #f1f5f9 !important;
}

.prose :deep(blockquote) {
  border-left: 3px solid #e2e8f0;
  padding-left: 0.75em;
  margin: 0.5em 0;
  color: #64748b;
}
.dark .prose :deep(blockquote) {
  border-left-color: #334155;
  color: #94a3b8;
}
.prose :deep(a) {
  color: #6366f1;
  text-decoration: underline;
}
.dark .prose :deep(a) {
  color: #a5b4fc;
}
.prose :deep(img) {
  max-width: 100%;
  border-radius: 6px;
  margin: 0.5em 0;
}
.prose :deep(hr) {
  margin: 0.75em 0;
  border-color: #e2e8f0;
}
.dark .prose :deep(hr) {
  border-color: #334155;
}
.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
}
.prose :deep(th),
.prose :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.375em 0.5em;
  text-align: left;
  font-size: 0.875em;
}
.dark .prose :deep(th),
.dark .prose :deep(td) {
  border-color: #334155;
}
.prose :deep(th) {
  background: #f8fafc;
  font-weight: 600;
}
.dark .prose :deep(th) {
  background: #0f172a;
}

/* ─── Comment markdown body ─── */
.comment-body :deep(p) {
  margin: 3px 0;
}

.comment-body :deep(strong) {
  font-weight: 600;
}

.comment-body :deep(em) {
  font-style: italic;
}

.comment-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  background: #e2e8f0;
  color: #334155;
  padding: 1px 4px;
  border-radius: 3px;
}
.dark .comment-body :deep(code) {
  background: #334155;
  color: #f8fafc !important;
}

.comment-body :deep(pre) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  background: #f1f5f9;
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  line-height: 1.5;
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.dark .comment-body :deep(pre) {
  background: #1e293b;
  color: #f8fafc !important;
}

.comment-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: inherit;
}
.dark .comment-body :deep(pre code) {
  color: #f8fafc !important;
}

/* Override old Tailwind classes in persisted agent comments for dark mode readability */
.dark .comment-body :deep(.bg-slate-100) {
  background-color: #334155 !important;
  color: #f8fafc !important;
}
.dark .comment-body :deep(.text-slate-800) {
  color: #f1f5f9 !important;
}

.comment-body :deep(ul),
.comment-body :deep(ol) {
  margin: 4px 0;
  padding-left: 16px;
}

.comment-body :deep(li) {
  margin: 2px 0;
}

.comment-body :deep(a) {
  color: #6366f1;
  text-decoration: underline;
  word-break: break-all;
}
.dark .comment-body :deep(a) {
  color: #a5b4fc;
}

.comment-body :deep(blockquote) {
  border-left: 2px solid #cbd5e1;
  margin: 4px 0;
  padding: 2px 0 2px 8px;
  color: #64748b;
}
.dark .comment-body :deep(blockquote) {
  border-left-color: #334155;
  color: #94a3b8;
}

.comment-body :deep(h1),
.comment-body :deep(h2),
.comment-body :deep(h3),
.comment-body :deep(h4) {
  font-weight: 600;
  margin: 6px 0 3px;
  line-height: 1.3;
}

.comment-body :deep(h1) { font-size: 14px; }
.comment-body :deep(h2) { font-size: 13px; }
.comment-body :deep(h3) { font-size: 12px; }
.comment-body :deep(h4) { font-size: 11px; }

.comment-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin: 8px 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.comment-body :deep(img:hover) {
  opacity: 0.9;
}
.dark .comment-body :deep(img) {
  border-color: #334155;
}
</style>
