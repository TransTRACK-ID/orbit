import type { Task, Comment, ActivityLog, Attachment } from '~/types'

const tasks = ref<Task[]>([])
const currentTask = ref<Task | null>(null)
const comments = ref<Comment[]>([])
const activityLogs = ref<ActivityLog[]>([])
const loading = ref(false)

export const useTask = () => {
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  async function fetchTasks(projectId: string) {
    loading.value = true
    try {
      tasks.value = await $fetch<Task[]>(`/api/projects/${projectId}/tasks`, {
        headers: ssrHeaders,
      })
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      loading.value = false
    }
  }

  async function createTask(projectId: string, data: {
    title: string
    statusId: string
    assigneeId?: string | null
    assigneeType?: 'user' | 'agent' | null
    observerId?: string | null
    description?: string
    priority?: string
    repositoryId?: string | null
    labelIds?: string[]
    parentTaskId?: string | null
    branchName?: string | null
    agentEnabled?: boolean
  }) {
    const task = await $fetch<Task>(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: data,
    })
    return task
  }

  async function updateTask(id: string, data: Partial<Task> & { labelIds?: string[] }) {
    const updated = await $fetch<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx !== -1) tasks.value[idx] = updated
    if (currentTask.value?.id === id) currentTask.value = updated
    return updated
  }

  async function deleteTask(id: string) {
    await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  async function bulkUpdate(taskIds: string[], data: Partial<Task> & { statusId?: string; assigneeId?: string | null; assigneeType?: 'user' | 'agent' | null; priority?: string }) {
    const updated = await $fetch<Task[]>(`/api/tasks/bulk`, {
      method: 'PATCH',
      body: { taskIds, ...data },
    })
    for (const u of updated) {
      const idx = tasks.value.findIndex((t) => t.id === u.id)
      if (idx !== -1) tasks.value[idx] = u
      if (currentTask.value?.id === u.id) currentTask.value = u
    }
    return updated
  }

  async function bulkDelete(taskIds: string[]) {
    await $fetch(`/api/tasks/bulk`, {
      method: 'DELETE',
      body: { taskIds },
    })
    tasks.value = tasks.value.filter((t) => !taskIds.includes(t.id))
  }

  async function fetchTaskDetail(id: string) {
    const task = await $fetch<Task>(`/api/tasks/${id}`, { headers: ssrHeaders })
    currentTask.value = task
    return task
  }

  async function fetchTaskDetailComposite(id: string) {
    const data = await $fetch<{
      task: Task
      comments: Comment[]
      activityLogs: ActivityLog[]
      attachments: Attachment[]
      agentReplies: Array<{ id: string; body: string; createdAt: string; agentName: string; agentColor?: string }>
    }>(`/api/tasks/${id}/detail`, { headers: ssrHeaders })
    currentTask.value = data.task
    comments.value = data.comments
    activityLogs.value = data.activityLogs
    return data
  }

  async function fetchComments(taskId: string) {
    comments.value = await $fetch<Comment[]>(`/api/tasks/${taskId}/comments`, {
      headers: ssrHeaders,
    })
    return comments.value
  }

  async function addComment(taskId: string, body: string) {
    const comment = await $fetch<Comment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { body },
    })
    comments.value.push(comment)
    return comment
  }

  async function fetchAttachments(taskId: string) {
    return await $fetch<Attachment[]>(`/api/tasks/${taskId}/attachments`, {
      headers: ssrHeaders,
    })
  }

  async function uploadAttachment(
    taskId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<Attachment> {
    const formData = new FormData()
    formData.append('file', file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.open('POST', `/api/tasks/${taskId}/attachments`)
      xhr.send(formData)
    })
  }

  async function deleteAttachment(taskId: string, attachmentId: string) {
    await $fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    })
  }

  async function fetchActivity(taskId: string) {
    activityLogs.value = await $fetch<ActivityLog[]>(`/api/tasks/${taskId}/activity`, {
      headers: ssrHeaders,
    })
    return activityLogs.value
  }

  // Linear-style position calculation for drag and drop
  function calculatePosition(tasks: Task[], targetIndex: number): number {
    if (tasks.length === 0) return 1000
    if (targetIndex === 0) return tasks[0].position / 2
    if (targetIndex >= tasks.length) return tasks[tasks.length - 1].position + 1000
    return (tasks[targetIndex - 1].position + tasks[targetIndex].position) / 2
  }

  return {
    tasks,
    currentTask,
    comments,
    activityLogs,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    bulkUpdate,
    bulkDelete,
    fetchTaskDetail,
    fetchTaskDetailComposite,
    fetchComments,
    addComment,
    fetchAttachments,
    uploadAttachment,
    deleteAttachment,
    fetchActivity,
    calculatePosition,
  }
}
