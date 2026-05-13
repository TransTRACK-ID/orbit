<template>
  <div class="flex flex-col h-full bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-surface-100 flex-shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style="background: #8B5CF6"
        >
          <Icon name="lucide:lightbulb" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-surface-900 truncate">{{ brainstorm.title }}</h3>
          <p v-if="brainstorm.repository" class="text-[11px] text-surface-400 truncate">
            {{ brainstorm.repository.name }} — {{ brainstorm.repository.defaultBranch }}
          </p>
          <p v-else class="text-[11px] text-surface-400">No repository</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          v-if="!isRunning"
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

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      <div v-if="messages.length === 0 && !isRunning" class="flex flex-col items-center justify-center h-full text-surface-400">
        <Icon name="lucide:messages-square" class="w-10 h-10 mb-3 opacity-40" />
        <p class="text-sm">Start a conversation about your codebase</p>
        <p class="text-[11px] mt-1">The agent will read and analyze files without making changes</p>
      </div>

      <template v-for="msg in displayMessages" :key="msg.id">
        <!-- User message -->
        <div v-if="msg.role === 'user'" class="flex gap-2.5 justify-end">
          <div class="max-w-[80%] bg-primary-500 text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 text-sm leading-relaxed">
            {{ msg.content }}
          </div>
          <Avatar :name="userName" size="sm" class="flex-shrink-0 mt-1" />
        </div>

        <!-- Assistant message -->
        <div v-else class="flex gap-2.5">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
            style="background: #8B5CF6"
          >
            <Icon name="lucide:bot" class="w-3.5 h-3.5" />
          </div>
          <div class="max-w-[80%]">
            <div class="bg-surface-50 border border-surface-100 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-surface-800 leading-relaxed prose prose-sm max-w-none">
              <div v-html="parseMarkdown(msg.content)" />
            </div>
          </div>
        </div>
      </template>

      <!-- Typing indicator -->
      <div v-if="isRunning" class="flex gap-2.5">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style="background: #8B5CF6"
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

    <!-- Input -->
    <div class="border-t border-surface-100 p-3 flex-shrink-0">
      <div class="flex gap-2">
        <div class="flex-1 relative">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Ask about your codebase..."
            class="w-full text-sm rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 pr-10 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            :disabled="isSending"
            @keydown.enter.prevent="handleSend"
          />
          <span v-if="isSending" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">Sending...</span>
        </div>
        <button
          :disabled="!newMessage.trim() || isSending || isRunning"
          class="px-3 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          @click="handleSend"
        >
          <Icon name="lucide:send" class="w-3.5 h-3.5" />
        </button>
      </div>
      <p class="text-[10px] text-surface-400 mt-1.5 flex items-center gap-1">
        <Icon name="lucide:shield" class="w-3 h-3" />
        Read-only mode — the agent will not edit any files
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Brainstorm, BrainstormMessage } from '~/types'
import { nextTick, watch, onMounted } from 'vue'

const props = defineProps<{
  brainstorm: Brainstorm
  messages: BrainstormMessage[]
  isRunning: boolean
  isSending: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
  start: []
  stop: []
}>()

const newMessage = ref('')
const messagesContainer = ref<HTMLDivElement | null>(null)
const { data: authData } = useAuth()
const userName = computed(() => authData.value?.user?.name || 'You')

// Combine persisted messages with the live streaming reply
const displayMessages = computed(() => {
  const result = [...props.messages]
  return result
})

watch(() => props.messages.length, () => {
  scrollToBottom()
})

watch(() => props.isRunning, (running) => {
  if (!running) {
    scrollToBottom()
  }
})

onMounted(() => {
  scrollToBottom()
})

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function handleSend() {
  const content = newMessage.value.trim()
  if (!content || props.isSending || props.isRunning) return
  newMessage.value = ''
  emit('send', content)
}

function handleStart() {
  emit('start')
}

function handleStop() {
  emit('stop')
}

function parseMarkdown(md: string): string {
  if (!md) return ''
  return md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^\s*[-*+]\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^\s*\d+\.\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(.*)$/gm, '<p class="mb-1">$1</p>')
    .replace(/<p class="mb-1"><li class="ml-4">(.*?)<\/li><\/p>/g, '<li class="ml-4">$1</li>')
    .replace(/(<li class="ml-4">.*?<\/li>\s*)+/g, '<ul class="list-disc pl-2 my-1">$&</ul>')
    .replace(/\n/g, '')
}
</script>
