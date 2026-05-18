import type { Brainstorm, BrainstormMessage, Task } from '~/types'

const brainstorms = ref<Brainstorm[]>([])
const currentBrainstorm = ref<Brainstorm | null>(null)
const messages = ref<BrainstormMessage[]>([])
const loading = ref(false)
const sending = ref(false)
const messagesLoading = ref(false)

const activeChatRuntimes = ref<Record<string, boolean>>({})
const chatEventSources = new Map<string, EventSource>()
const chatReplies = ref<Record<string, string>>({})
const chatSteps = ref<Record<string, string>>({})

export const useBrainstorm = () => {
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  async function fetchBrainstorms(workspaceId: string) {
    loading.value = true
    try {
      brainstorms.value = await $fetch<Brainstorm[]>(`/api/workspaces/${workspaceId}/brainstorms`, {
        headers: ssrHeaders,
      })
    } catch (err) {
      console.error('Failed to fetch brainstorms:', err)
    } finally {
      loading.value = false
    }
  }

  async function createBrainstorm(workspaceId: string, data: { title: string; repositoryId?: string | null }) {
    const brainstorm = await $fetch<Brainstorm>(`/api/workspaces/${workspaceId}/brainstorms`, {
      method: 'POST',
      body: data,
    })
    brainstorms.value.unshift(brainstorm)
    return brainstorm
  }

  async function fetchBrainstorm(id: string) {
    try {
      currentBrainstorm.value = await $fetch<Brainstorm>(`/api/brainstorms/${id}`, {
        headers: ssrHeaders,
      })
    } catch (err) {
      console.error('Failed to fetch brainstorm:', err)
    }
  }

  async function fetchMessages(brainstormId: string) {
    messagesLoading.value = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      // Safety timeout: never let loading get stuck
      timeoutId = setTimeout(() => {
        console.warn('[brainstorm] fetchMessages timeout — forcing loading false')
        messagesLoading.value = false
      }, 8000)

      const data = await $fetch<BrainstormMessage[]>(`/api/brainstorms/${brainstormId}/messages`, {
        headers: ssrHeaders,
      })
      messages.value = Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Failed to fetch messages:', err)
      messages.value = []
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      messagesLoading.value = false
    }
  }

  async function sendMessage(brainstormId: string, content: string) {
    sending.value = true
    try {
      const message = await $fetch<BrainstormMessage>(`/api/brainstorms/${brainstormId}/messages`, {
        method: 'POST',
        body: { role: 'user', content },
      })
      messages.value.push(message)
      return message
    } catch (err) {
      console.error('Failed to send message:', err)
      throw err
    } finally {
      sending.value = false
    }
  }

  async function saveAssistantMessage(brainstormId: string, content: string) {
    try {
      const message = await $fetch<BrainstormMessage>(`/api/brainstorms/${brainstormId}/messages`, {
        method: 'POST',
        body: { role: 'assistant', content },
      })
      messages.value.push(message)
      return message
    } catch (err) {
      console.error('Failed to save assistant message:', err)
    }
  }

  async function startChat(brainstormId: string, content?: string) {
    // Stop existing if any
    if (chatEventSources.has(brainstormId) || activeChatRuntimes.value[brainstormId]) {
      stopChat(brainstormId)
    }

    if (content) {
      try {
        await $fetch(`/api/brainstorms/${brainstormId}/chat`, {
          method: 'POST',
          body: { message: content },
        })
      } catch {
        // Silently fall through
      }
    }

    const url = `/api/brainstorms/${brainstormId}/chat`
    const es = new EventSource(url)
    let receivedDone = false
    let replyBuffer = ''

    es.onopen = () => {
      activeChatRuntimes.value = { ...activeChatRuntimes.value, [brainstormId]: true }
      chatReplies.value = { ...chatReplies.value, [brainstormId]: '' }
    }

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.step) {
          chatSteps.value = { ...chatSteps.value, [brainstormId]: data.step }
          if (/>?\s*Done$/.test(data.step) || />?\s*Brainstorm session completed/.test(data.step) || />?\s*Exited with code/.test(data.step)) {
            receivedDone = true
            // Immediately mark as not running so UI updates and auto-save can persist the reply
            activeChatRuntimes.value = { ...activeChatRuntimes.value, [brainstormId]: false }
            chatEventSources.delete(brainstormId)
            es.close()
            // Intentionally no return here — if this event also carries a final agentReply,
            // we want to process it below before the connection closes.
          }
        }
        if (data.agentReply) {
          replyBuffer += data.agentReply
          chatReplies.value = { ...chatReplies.value, [brainstormId]: replyBuffer }
        }
      } catch {}
    }

    es.onerror = () => {
      // Only clean up when the session is actually done or the connection is permanently
      // closed. This preserves EventSource auto-reconnect for transient network errors
      // while the agent is still actively running on the server.
      if (receivedDone || es.readyState === EventSource.CLOSED) {
        chatEventSources.delete(brainstormId)
        activeChatRuntimes.value = { ...activeChatRuntimes.value, [brainstormId]: false }
        es.close()
      }
    }

    chatEventSources.set(brainstormId, es)
    activeChatRuntimes.value = { ...activeChatRuntimes.value, [brainstormId]: true }
  }

  function stopChat(brainstormId: string) {
    const es = chatEventSources.get(brainstormId)
    if (es) {
      es.close()
      chatEventSources.delete(brainstormId)
    }
    activeChatRuntimes.value = { ...activeChatRuntimes.value, [brainstormId]: false }
  }

  async function killChat(brainstormId: string) {
    try {
      await $fetch(`/api/brainstorms/${brainstormId}/chat/kill`, { method: 'POST' })
    } catch {
      // Server process might already be dead
    }
    stopChat(brainstormId)
  }

  function isChatRunning(brainstormId: string): boolean {
    return !!activeChatRuntimes.value[brainstormId]
  }

  function getChatReply(brainstormId: string): string {
    return chatReplies.value[brainstormId] || ''
  }

  function clearChatReply(brainstormId: string) {
    chatReplies.value = { ...chatReplies.value, [brainstormId]: '' }
  }

  function getChatStep(brainstormId: string): string {
    return chatSteps.value[brainstormId] || ''
  }

  function clearChatStep(brainstormId: string) {
    chatSteps.value = { ...chatSteps.value, [brainstormId]: '' }
  }

  async function archiveBrainstorm(brainstormId: string, archived: boolean) {
    const updated = await $fetch<Brainstorm>(`/api/brainstorms/${brainstormId}`, {
      method: 'PATCH',
      body: { archived },
    })
    const idx = brainstorms.value.findIndex((b) => b.id === brainstormId)
    if (idx !== -1) {
      brainstorms.value[idx] = updated
    }
    if (currentBrainstorm.value?.id === brainstormId) {
      currentBrainstorm.value = updated
    }
    return updated
  }

  async function convertToTask(brainstormId: string, messageId: string, projectId: string) {
    try {
      const task = await $fetch<Task>(`/api/brainstorms/${brainstormId}/tasks`, {
        method: 'POST',
        body: { messageId, projectId },
      })
      return task
    } catch (err) {
      console.error('Failed to convert message to task:', err)
      throw err
    }
  }

  return {
    brainstorms,
    currentBrainstorm,
    messages,
    loading,
    sending,
    messagesLoading,
    activeChatRuntimes,
    fetchBrainstorms,
    createBrainstorm,
    fetchBrainstorm,
    fetchMessages,
    sendMessage,
    saveAssistantMessage,
    startChat,
    stopChat,
    killChat,
    isChatRunning,
    getChatReply,
    clearChatReply,
    getChatStep,
    clearChatStep,
    archiveBrainstorm,
    convertToTask,
  }
}
