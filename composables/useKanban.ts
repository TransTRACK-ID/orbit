import { ref } from 'vue'
import type { KanbanColumn, Task, Status } from '~/types'

export const highlightedTaskId = ref<string | null>(null)

export function flashHighlight(taskId: string) {
  highlightedTaskId.value = taskId
  setTimeout(() => { highlightedTaskId.value = null }, 3000)
}

export function useKanban() {
  const columns = ref<KanbanColumn[]>([])
  const selectedTask = ref<Task | null>(null)
  const showTaskSidePanel = ref(false)

  function buildColumns(statuses: Status[], tasks: Task[]): KanbanColumn[] {
    return statuses.map((status) => ({
      status,
      tasks: tasks
        .filter((t) => t.statusId === status.id)
        .sort((a, b) => a.position - b.position),
    }))
  }

  function openTaskDetail(task: Task) {
    selectedTask.value = task
    showTaskSidePanel.value = true
  }

  function closeTaskDetail() {
    selectedTask.value = null
    showTaskSidePanel.value = false
  }

  function moveTask(
    columns: KanbanColumn[],
    taskId: string,
    fromStatusId: string,
    toStatusId: string,
    toIndex: number
  ): KanbanColumn[] {
    // Find and remove the task from its current column
    let movedTask: Task | undefined
    const newColumns = columns.map((col) => {
      if (col.status.id === fromStatusId) {
        const task = col.tasks.find((t) => t.id === taskId)
        if (task) movedTask = { ...task }
        return {
          ...col,
          tasks: col.tasks.filter((t) => t.id !== taskId),
        }
      }
      return col
    })

    if (!movedTask) return columns

    // Update the task's status
    movedTask = { ...movedTask, statusId: toStatusId }

    // Insert into the target column at the specified index
    return newColumns.map((col) => {
      if (col.status.id === toStatusId) {
        const newTasks = [...col.tasks]
        newTasks.splice(toIndex, 0, movedTask!)
        return { ...col, tasks: newTasks }
      }
      return col
    })
  }

  return {
    columns,
    selectedTask,
    showTaskSidePanel,
    buildColumns,
    openTaskDetail,
    closeTaskDetail,
    moveTask,
  }
}
