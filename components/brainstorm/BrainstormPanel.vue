<template>
  <div class="flex flex-col h-full bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-surface-100 flex-shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          :style="{ background: isGrillMode ? '#f59e0b' : '#8B5CF6' }"
        >
          <Icon :name="isGrillMode ? 'lucide:flame' : 'lucide:lightbulb'" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-surface-900 truncate">{{ displayTitle }}</h3>
          <p v-if="brainstorm.repository" class="text-[11px] text-surface-400 truncate">
            {{ brainstorm.repository.name }} — {{ brainstorm.repository.defaultBranch }}
          </p>
          <p v-else class="text-[11px] text-surface-400">No repository</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          v-if="canGeneratePrd && !isRunning"
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-purple-500 text-white hover:bg-purple-600 transition-colors flex items-center gap-1"
          @click="handleGeneratePrd"
        >
          <Icon name="lucide:file-text" class="w-3 h-3" />
          Generate PRD
        </button>
        <button
          v-if="canCreateGrillTask && !isRunning"
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-1"
          @click="openCreateGrillTaskModal"
        >
          <Icon name="lucide:square-plus" class="w-3 h-3" />
          Create task
        </button>
        <span
          v-else-if="isGrillMode && !isRunning && messages.length >= 2 && grillStatus !== 'complete'"
          class="text-[10px] font-medium px-2 py-1 rounded-md bg-surface-100 text-surface-500"
          title="Complete the grill session to generate a PRD"
        >
          PRD after grill
        </span>
        <span
          v-if="isRunning"
          class="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary-100 text-primary-700 flex items-center gap-1.5"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-500" />
          </span>
          Running
        </span>
        <button
          v-if="!isRunning && !(isGrillMode && grillStatus === 'awaiting_answer')"
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-1"
          @click="handleStart"
        >
          <Icon name="lucide:play" class="w-3 h-3" />
          Start
        </button>
        <button
          v-else
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
          @click="handleStop"
        >
          <Icon name="lucide:square" class="w-3 h-3" />
          Stop
        </button>
      </div>
    </div>

    <!-- Grill mode banner -->
    <div
      v-if="isGrillMode"
      class="px-4 py-2.5 border-b flex items-start gap-2 flex-shrink-0"
      :class="grillStatus === 'complete'
        ? 'bg-emerald-50 border-emerald-100'
        : 'bg-amber-50 border-amber-100'"
    >
      <Icon
        :name="grillStatus === 'complete' ? 'lucide:check-circle' : 'lucide:flame'"
        class="w-4 h-4 flex-shrink-0 mt-0.5"
        :class="grillStatus === 'complete' ? 'text-emerald-600' : 'text-amber-600'"
      />
      <div class="min-w-0">
        <p
          class="text-xs font-semibold"
          :class="grillStatus === 'complete' ? 'text-emerald-800' : 'text-amber-800'"
        >
          {{ grillBannerTitle }}
        </p>
        <p
          class="text-[11px] mt-0.5"
          :class="grillStatus === 'complete' ? 'text-emerald-700' : 'text-amber-700'"
        >
          {{ grillBannerDescription }}
        </p>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      <div v-if="messagesLoading" class="flex flex-col items-center justify-center h-full text-surface-400">
        <span class="relative flex h-6 w-6 mb-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-6 w-6 bg-primary-500" />
        </span>
        <p class="text-sm">Loading messages...</p>
      </div>

      <div v-else-if="displayMessages.length === 0 && !isRunning" class="flex flex-col items-center justify-center h-full text-surface-400">
        <Icon :name="isGrillMode ? 'lucide:flame' : 'lucide:messages-square'" class="w-10 h-10 mb-3 opacity-40" />
        <p class="text-sm">{{ isGrillMode ? 'Waiting for the first grill question' : 'Start a conversation about your codebase' }}</p>
        <p class="text-[11px] mt-1">{{ isGrillMode ? 'The agent will stress-test your plan one question at a time' : 'The agent will read and analyze files without making changes' }}</p>
      </div>

      <template v-for="msg in displayMessages" :key="msg.id">
        <!-- User message -->
        <div v-if="msg.role === 'user'" class="flex gap-2.5 justify-end">
          <div class="max-w-[80%] bg-primary-500 text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 text-sm leading-relaxed">
            {{ msg.content }}
          </div>
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-1 bg-primary-400"
          >
            {{ userInitials }}
          </div>
        </div>

        <!-- Assistant message -->
        <div v-else class="flex gap-2.5">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
            :style="{ background: isGrillMode ? '#f59e0b' : '#8B5CF6' }"
          >
            <Icon name="lucide:bot" class="w-3.5 h-3.5" />
          </div>
          <div class="max-w-[80%] space-y-2">
            <GrillQuestionCard
              v-if="getGrillQuestionMetadata(msg)"
              :metadata="getGrillQuestionMetadata(msg)!"
              :disabled="isRunning || isSending"
              :answered="getGrillQuestionMetadata(msg)!.status !== 'pending'"
              @use-recommended="handleUseRecommended"
            />
            <div
              v-if="getGrillCompleteMetadata(msg)"
              class="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-3"
            >
              <p class="text-xs font-semibold text-emerald-800 mb-1">Grill session complete</p>
              <p class="text-sm text-surface-800 leading-relaxed">{{ getGrillCompleteMetadata(msg)!.summary }}</p>
            </div>
            <div class="bg-surface-50 border border-surface-100 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-surface-800 leading-relaxed max-w-none brainstorm-markdown">
              <div v-html="parseMarkdown(msg.content)" />
            </div>
            <!-- Create task action -->
            <div class="flex items-center gap-2 mt-1.5 ml-1">
              <button
                v-if="msg.id !== 'live-reply'"
                class="text-[10px] font-medium text-surface-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
                @click="openCreateTaskModal(msg)"
              >
                <Icon name="lucide:square-plus" class="w-3 h-3" />
                Create task
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Typing indicator -->
      <div v-if="isRunning && !chatReply.trim()" class="flex gap-2.5">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          :style="{ background: isGrillMode ? '#f59e0b' : '#8B5CF6' }"
        >
          <Icon name="lucide:bot" class="w-3.5 h-3.5" />
        </div>
        <div class="bg-surface-50 border border-surface-100 rounded-2xl rounded-tl-md px-3.5 py-2.5">
          <div class="flex gap-1 items-center h-5">
            <span class="w-1.5 h-1.5 rounded-full bg-surface-400 animate-bounce" style="animation-delay: 0ms" />
            <span class="w-1.5 h-1.5 rounded-full bg-surface-400 animate-bounce" style="animation-delay: 150ms" />
            <span class="w-1.5 h-1.5 rounded-full bg-surface-400 animate-bounce" style="animation-delay: 300ms" />
          </div>
        </div>
      </div>
    </div>

    <!-- Create Task Modal -->
    <Teleport to="body">
      <div v-if="showCreateTaskModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="showCreateTaskModal = false">
        <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-md p-6 animate-scale-in">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-surface-900">
              {{ createTaskMode === 'grill_summary' ? 'Create Task from Grill Summary' : 'Create Task from Message' }}
            </h3>
            <button class="text-surface-400 hover:text-surface-600 transition-colors p-1" @click="showCreateTaskModal = false">
              <Icon name="lucide:x" class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 mb-1.5">Select Project</label>
              <div class="relative">
                <select
                  v-model="selectedProjectId"
                  class="w-full text-sm rounded-lg border border-surface-200 bg-white px-3 py-2 pr-8 appearance-none cursor-pointer focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                >
                  <option value="" disabled>Choose a project</option>
                  <option v-for="project in projects" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
                <Icon
                  name="lucide:chevron-down"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-400 pointer-events-none"
                />
              </div>
              <p class="text-xs text-surface-400 mt-1">Task will be placed in the project's backlog</p>
            </div>

            <div class="bg-surface-50 rounded-lg border border-surface-100 p-3">
              <p class="text-[11px] font-semibold text-surface-500 uppercase tracking-wide mb-1">
                {{ createTaskMode === 'grill_summary' ? 'Task preview' : 'Message preview' }}
              </p>
              <p class="text-xs text-surface-700 line-clamp-6 whitespace-pre-wrap">{{ createTaskPreview }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-5 mt-2 border-t border-surface-100">
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors"
              @click="showCreateTaskModal = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="!selectedProjectId || creatingTask"
              @click="handleCreateTask"
            >
              <span v-if="creatingTask" class="flex items-center gap-1.5">
                <Icon name="lucide:loader-2" class="w-3.5 h-3.5 animate-spin" />
                Creating...
              </span>
              <span v-else>Create Task</span>
            </button>
          </div>

          <p v-if="createTaskError" class="text-error-500 text-sm mt-3">{{ createTaskError }}</p>
        </div>
      </div>
    </Teleport>

    <!-- Input -->
    <div class="border-t border-surface-100 flex-shrink-0">
      <!-- Agent status bar -->
      <div
        v-if="isRunning"
        class="px-4 py-2 bg-primary-50 border-b border-primary-100 flex items-center gap-2"
      >
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
        </span>
        <span class="text-xs text-primary-700 font-medium truncate">{{ currentStep || 'Agent is thinking...' }}</span>
        <button
          class="ml-auto text-[10px] font-semibold px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors flex items-center gap-1 flex-shrink-0"
          @click="handleStop"
        >
          <Icon name="lucide:square" class="w-3 h-3" />
          Stop
        </button>
      </div>

      <div class="p-3">
        <!-- Attachments -->
        <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 mb-2">
          <div
            v-for="att in attachments"
            :key="att.id"
            class="relative group cursor-pointer"
            @click="openLightbox(att)"
          >
            <div class="w-8 h-8 rounded-lg overflow-hidden border border-surface-200 bg-surface-100">
              <img
                :src="`/api/brainstorms/${brainstorm.id}/attachments/${att.id}`"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="hideImage"
              />
            </div>
            <button
              type="button"
              class="absolute -top-1 -right-1 w-3 h-3 bg-surface-700 text-white rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
              @click.stop="removeAttachment(att)"
            >
              <Icon name="lucide:x" class="w-2 h-2" />
            </button>
          </div>
        </div>

        <div class="flex gap-2 items-center">
          <button
            v-if="attachments.length < 3"
            class="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-50 transition-colors flex-shrink-0 leading-none"
            :class="{ 'opacity-50 cursor-not-allowed': isUploadingAttachment }"
            @click="attachmentInput?.click()"
          >
            <Icon v-if="!isUploadingAttachment" name="lucide:paperclip" class="w-4 h-4" />
            <Icon v-else name="lucide:loader-2" class="w-4 h-4 animate-spin" />
          </button>
          <input
            ref="attachmentInput"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            class="hidden"
            @change="handleAttachmentFileSelect"
          />

          <div class="flex-1 relative">
             <textarea
               ref="textareaRef"
               v-model="newMessage"
               :placeholder="inputPlaceholder"
                class="block w-full text-sm rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 pr-10 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors disabled:opacity-60 resize-y min-h-10"
               :disabled="!canSendMessage || isSending"
               rows="1"
               @keydown="handleKeydown"
             />
            <span v-if="isSending" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">Sending...</span>
          </div>
          <button
            :disabled="!newMessage.trim() || isSending || !canSendMessage"
            class="px-3 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 h-10 flex-shrink-0"
            @click="handleSend"
          >
            <Icon name="lucide:send" class="w-3.5 h-3.5" />
          </button>
        </div>
        <p class="text-[10px] text-surface-400 mt-1.5 flex items-center gap-1">
          <Icon name="lucide:shield" class="w-3 h-3" />
          {{ inputHint }}
        </p>
      </div>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxImage"
        class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="closeLightbox"
      >
        <div class="relative max-w-full max-h-full">
          <img
            :src="`/api/brainstorms/${brainstorm.id}/attachments/${lightboxImage.id}`"
            class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            loading="lazy"
          />
          <button
            class="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-surface-600 hover:text-surface-900 transition-colors"
            @click="closeLightbox"
          >
            <Icon name="lucide:x" class="w-4 h-4" />
          </button>
          <p class="text-center text-white text-sm mt-2 font-medium">
            {{ lightboxImage.originalName }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Brainstorm, BrainstormMessage, BrainstormAttachment, GrillCompleteMetadata, GrillQuestionMetadata } from '~/types'
import { getPrimaryGrillMetadata, parseGrillBlocks } from '~/utils/grill-parser'
import { extractGrillDecisionsFromMessages, formatResolvedDecisionsForTask } from '~/utils/grill-decisions'
import { nextTick, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  brainstorm: Brainstorm
  messages: BrainstormMessage[]
  isRunning: boolean
  isSending: boolean
  messagesLoading: boolean
  chatReply: string
  currentStep: string
  projects: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
  send: [content: string]
  start: []
  stop: []
  createTask: [projectId: string, source: 'message' | 'grill_summary', messageId?: string]
  generatePrd: []
}>()

const newMessage = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLDivElement | null>(null)

function autoResizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.max(Math.min(el.scrollHeight, 160), 40) + 'px'
}
const { data: authData } = useAuth()
const userName = computed(() => authData.value?.user?.name || 'You')
const userInitials = computed(() => {
  return userName.value.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
})

const isGrillMode = computed(() => props.brainstorm.mode === 'grill')
const displayTitle = computed(() => props.brainstorm.displayTitle || props.brainstorm.title)
const grillStatus = computed(() => props.brainstorm.grillStatus ?? null)

const grillBannerTitle = computed(() => {
  if (grillStatus.value === 'complete') return 'Grill complete — decisions captured'
  if (grillStatus.value === 'awaiting_answer') return 'Your turn — answer the question below'
  return 'Grill mode — answer one question at a time'
})

const grillBannerDescription = computed(() => {
  if (grillStatus.value === 'complete') {
    return 'All branches are resolved. You can follow up, create a task, or generate a PRD.'
  }
  if (grillStatus.value === 'awaiting_answer') {
    return 'Use the recommended answer or type your own before the agent continues.'
  }
  return 'The agent will ask structured questions with recommended answers. Respond to each question before the next one.'
})

const canGeneratePrd = computed(() => {
  if (!isGrillMode.value) {
    return props.messages.length >= 2
  }
  return grillStatus.value === 'complete'
})

const canCreateGrillTask = computed(() => isGrillMode.value && grillStatus.value === 'complete')

const grillTaskPreview = computed(() => {
  if (!canCreateGrillTask.value) return ''
  const ledger = extractGrillDecisionsFromMessages(props.messages, {
    grillStatus: grillStatus.value,
    currentQuestionId: props.brainstorm.currentQuestionId ?? null,
  })
  const initialPlan = props.messages.find((message) => message.role === 'user')?.content || null
  return formatResolvedDecisionsForTask(ledger, {
    title: displayTitle.value,
    initialPlan,
  }).description
})

const canSendMessage = computed(() => {
  if (!isGrillMode.value) return true
  if (props.isRunning) return false
  if (grillStatus.value === null) return true
  if (grillStatus.value === 'complete') return true
  if (grillStatus.value === 'awaiting_answer') return true
  return false
})

const inputPlaceholder = computed(() => {
  if (!isGrillMode.value) {
    return props.isRunning ? 'Type a follow-up message...' : 'Ask about your codebase...'
  }
  if (grillStatus.value === 'complete') {
    return 'Optional follow-up...'
  }
  if (grillStatus.value === 'awaiting_answer') {
    return 'Answer the question above...'
  }
  if (props.isRunning) {
    return 'Waiting for the agent...'
  }
  return 'Waiting for the next question...'
})

const inputHint = computed(() => {
  if (!isGrillMode.value) {
    return 'Read-only mode — the agent will not edit any files'
  }
  if (grillStatus.value === 'awaiting_answer') {
    return 'Grill mode — answer the current question to continue'
  }
  if (grillStatus.value === 'complete') {
    return 'Grill mode complete — read-only follow-ups allowed'
  }
  return 'Grill mode — read-only, one question at a time'
})

function getGrillQuestionMetadata(msg: BrainstormMessage): GrillQuestionMetadata | null {
  if (msg.metadata?.type === 'grill_question') {
    return msg.metadata
  }
  if (msg.id === 'live-reply' && msg.content) {
    const { blocks } = parseGrillBlocks(msg.content)
    const metadata = getPrimaryGrillMetadata(blocks)
    if (metadata?.type === 'grill_question') return metadata
  }
  return null
}

function getGrillCompleteMetadata(msg: BrainstormMessage): GrillCompleteMetadata | null {
  if (msg.metadata?.type === 'grill_complete') {
    return msg.metadata
  }
  if (msg.id === 'live-reply' && msg.content) {
    const { blocks } = parseGrillBlocks(msg.content)
    const metadata = getPrimaryGrillMetadata(blocks)
    if (metadata?.type === 'grill_complete') return metadata
  }
  return null
}

function handleUseRecommended(answer: string) {
  if (!canSendMessage.value || props.isSending) return
  emit('send', answer)
}

// Create task modal state
const showCreateTaskModal = ref(false)
const createTaskMode = ref<'message' | 'grill_summary'>('message')
const selectedMessage = ref<BrainstormMessage | null>(null)
const selectedProjectId = ref('')
const creatingTask = ref(false)
const createTaskError = ref('')

const createTaskPreview = computed(() => {
  if (createTaskMode.value === 'grill_summary') {
    return grillTaskPreview.value
  }
  return selectedMessage.value?.content || ''
})

// ─── Attachments ───
const { fetchAttachments, uploadAttachment, deleteAttachment } = useBrainstorm()
const attachments = ref<BrainstormAttachment[]>([])
const attachmentInput = ref<HTMLInputElement | null>(null)
const isUploadingAttachment = ref(false)
const lightboxImage = ref<BrainstormAttachment | null>(null)

watch(() => props.brainstorm.id, () => {
  loadAttachments()
}, { immediate: true })

async function loadAttachments() {
  try {
    attachments.value = await fetchAttachments(props.brainstorm.id)
  } catch {
    attachments.value = []
  }
}

function openLightbox(att: BrainstormAttachment) {
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
  if (!input.files || input.files.length === 0) return
  await uploadAttachmentFile(input.files[0])
  input.value = ''
}

async function uploadAttachmentFile(file: File) {
  if (attachments.value.length >= 3) {
    alert('Attachment limit reached (max 3)')
    return
  }
  isUploadingAttachment.value = true
  try {
    const newAtt = await uploadAttachment(props.brainstorm.id, file)
    attachments.value.push(newAtt)
  } catch (err: any) {
    alert(err?.message || 'Failed to upload attachment')
  } finally {
    isUploadingAttachment.value = false
  }
}

async function removeAttachment(att: BrainstormAttachment) {
  if (!confirm('Are you sure you want to delete this attachment?')) return
  try {
    await deleteAttachment(props.brainstorm.id, att.id)
    attachments.value = attachments.value.filter((a) => a.id !== att.id)
  } catch {
    alert('Failed to delete attachment')
  }
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightboxImage.value) {
    closeLightbox()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})

function openCreateTaskModal(msg: BrainstormMessage) {
  createTaskMode.value = 'message'
  selectedMessage.value = msg
  selectedProjectId.value = ''
  createTaskError.value = ''
  showCreateTaskModal.value = true
}

function openCreateGrillTaskModal() {
  createTaskMode.value = 'grill_summary'
  selectedMessage.value = null
  selectedProjectId.value = ''
  createTaskError.value = ''
  showCreateTaskModal.value = true
}

async function handleCreateTask() {
  if (!selectedProjectId.value) return
  if (createTaskMode.value === 'message' && !selectedMessage.value) return
  creatingTask.value = true
  createTaskError.value = ''
  try {
    emit(
      'createTask',
      selectedProjectId.value,
      createTaskMode.value,
      selectedMessage.value?.id,
    )
    showCreateTaskModal.value = false
  } catch (err: any) {
    createTaskError.value = err?.data?.message || 'Failed to create task'
  } finally {
    creatingTask.value = false
  }
}

// Combine persisted messages with the live streaming reply
const displayMessages = computed(() => {
  const result = [...props.messages]
  if (props.chatReply.trim()) {
    result.push({
      id: 'live-reply',
      brainstormId: props.brainstorm.id,
      role: 'assistant',
      content: props.chatReply.trim(),
      createdAt: new Date().toISOString(),
    })
  }
  return result
})

watch(() => props.messages.length, () => {
  scrollToBottom()
})

watch(() => props.chatReply, () => {
  scrollToBottom()
})

watch(() => props.isRunning, (running) => {
  if (!running) {
    scrollToBottom()
  }
})

watch(newMessage, () => {
  autoResizeTextarea()
})

onMounted(() => {
  autoResizeTextarea()
  scrollToBottom()
})

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
  // Shift+Enter falls through — browser inserts newline naturally
}

async function handleSend() {
  const content = newMessage.value.trim()
  if (!content || props.isSending || !canSendMessage.value) return
  newMessage.value = ''
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
  // Clear one-time attachments from the input area after sending
  attachments.value = []
  emit('send', content)
}

function handleStart() {
  emit('start')
}

function handleStop() {
  emit('stop')
}

function handleGeneratePrd() {
  emit('generatePrd')
}

defineExpose({
  openCreateGrillTaskModal,
})

import { marked } from 'marked'

function parseMarkdown(md: string): string {
  if (!md) return ''
  return marked.parse(md, { async: false, breaks: true }) as string
}
</script>

<style scoped>
.brainstorm-markdown :deep(p) {
  @apply mb-2 last:mb-0 text-surface-800;
}
.brainstorm-markdown :deep(h1) {
  @apply text-lg font-bold mt-4 mb-2 text-surface-900;
}
.brainstorm-markdown :deep(h2) {
  @apply text-base font-semibold mt-3 mb-2 text-surface-900;
}
.brainstorm-markdown :deep(h3) {
  @apply text-sm font-semibold mt-2 mb-1.5 text-surface-900;
}
.brainstorm-markdown :deep(h4),
.brainstorm-markdown :deep(h5),
.brainstorm-markdown :deep(h6) {
  @apply text-sm font-medium mt-2 mb-1 text-surface-900;
}
.brainstorm-markdown :deep(ul) {
  @apply list-disc pl-4 my-2 space-y-0.5;
}
.brainstorm-markdown :deep(ol) {
  @apply list-decimal pl-4 my-2 space-y-0.5;
}
.brainstorm-markdown :deep(li) {
  @apply ml-1 text-surface-800;
}
.brainstorm-markdown :deep(pre) {
  @apply bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto;
}
.brainstorm-markdown :deep(pre code) {
  @apply text-xs text-slate-300 font-mono leading-relaxed bg-transparent p-0;
}
.brainstorm-markdown :deep(p code),
.brainstorm-markdown :deep(li code),
.brainstorm-markdown :deep(h1 code),
.brainstorm-markdown :deep(h2 code),
.brainstorm-markdown :deep(h3 code),
.brainstorm-markdown :deep(blockquote code) {
  @apply bg-surface-100 text-primary-700 px-1 py-0.5 rounded text-[11px] font-mono;
}
.brainstorm-markdown :deep(blockquote) {
  @apply border-l-2 border-primary-300 pl-3 py-1 my-2 bg-primary-100 rounded-r text-surface-600 italic;
}
.brainstorm-markdown :deep(hr) {
  @apply border-surface-200 my-3;
}
.brainstorm-markdown :deep(a) {
  @apply text-primary-600 hover:text-primary-700 underline underline-offset-2;
}
.brainstorm-markdown :deep(strong) {
  @apply font-semibold text-surface-900;
}
.brainstorm-markdown :deep(em) {
  @apply italic text-surface-700;
}
.brainstorm-markdown :deep(table) {
  @apply w-full border-collapse my-2 text-xs;
}
.brainstorm-markdown :deep(thead) {
  @apply bg-surface-100;
}
.brainstorm-markdown :deep(th) {
  @apply px-2 py-1.5 text-left font-semibold text-surface-700 border border-surface-200;
}
.brainstorm-markdown :deep(td) {
  @apply px-2 py-1.5 text-surface-800 border border-surface-200;
}
.brainstorm-markdown :deep(tr:nth-child(even)) {
  background-color: var(--surface-100);
}
.brainstorm-markdown :deep(del) {
  @apply line-through text-surface-400;
}
.brainstorm-markdown :deep(img) {
  @apply max-w-full rounded-lg my-2;
}
</style>
