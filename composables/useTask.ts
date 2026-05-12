import type { Task, Comment, ActivityLog } from '~/types'

const tasks = ref<Task[]>([])
const currentTask = ref<Task | null>(null)
const comments = ref<Comment[]>([])
const activityLogs = ref<ActivityLog[]>([])
const loading = ref(false)

export const useTask = () => {

  async function fetchTasks(projectId: string) {
    loading.value = true
    try {
      tasks.value = await $fetch<Task[]>(`/api/projects/${projectId}/tasks`)
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

  async function fetchTaskDetail(id: string) {
    const task = await $fetch<Task>(`/api/tasks/${id}`)
    currentTask.value = task
    return task
  }

  async function fetchComments(taskId: string) {
    comments.value = await $fetch<Comment[]>(`/api/tasks/${taskId}/comments`)
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

  async function fetchActivity(taskId: string) {
    activityLogs.value = await $fetch<ActivityLog[]>(`/api/tasks/${taskId}/activity`)
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
    fetchTaskDetail,
    fetchComments,
    addComment,
    fetchActivity,
    calculatePosition,
  }
}
