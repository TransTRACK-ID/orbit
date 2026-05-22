import type { Task, TaskPriority } from '~/types'

export interface FilterState {
  search: string
  statuses: string[]
  priorities: TaskPriority[]
  labels: string[]
  assigneeType: 'user' | 'agent' | 'unassigned' | null
  agentEnabled: boolean | null
}

export interface SortState {
  field: 'manual' | 'priority' | 'createdAt' | 'updatedAt' | 'dueDate' | 'title'
  direction: 'asc' | 'desc'
}

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

export function filterTasks(tasks: Task[], filters: FilterState): Task[] {
  return tasks.filter((task) => {
    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase()
      const titleMatch = task.title.toLowerCase().includes(query)
      const descMatch = task.description?.toLowerCase().includes(query) ?? false
      if (!titleMatch && !descMatch) return false
    }

    // Status filter
    if (filters.statuses.length > 0) {
      if (!filters.statuses.includes(task.statusId)) return false
    }

    // Priority filter
    if (filters.priorities.length > 0) {
      if (!filters.priorities.includes(task.priority)) return false
    }

    // Label filter
    if (filters.labels.length > 0) {
      const taskLabelIds = task.labels?.map(l => l.id) ?? []
      const hasMatchingLabel = filters.labels.some(id => taskLabelIds.includes(id))
      if (!hasMatchingLabel) return false
    }

    // Assignee type filter
    if (filters.assigneeType) {
      if (filters.assigneeType === 'unassigned') {
        if (task.assigneeId !== null) return false
      } else {
        if (task.assigneeType !== filters.assigneeType) return false
      }
    }

    // Agent enabled filter
    if (filters.agentEnabled !== null) {
      if (task.agentEnabled !== filters.agentEnabled) return false
    }

    return true
  })
}

export function sortTasks(tasks: Task[], sort: SortState): Task[] {
  const sorted = [...tasks]

  switch (sort.field) {
    case 'manual':
      sorted.sort((a, b) => a.position - b.position)
      break
    case 'priority':
      sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      break
    case 'createdAt':
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      break
    case 'updatedAt':
      sorted.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      break
    case 'dueDate':
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      break
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title))
      break
  }

  if (sort.direction === 'desc') {
    sorted.reverse()
  }

  return sorted
}

export function useBoardFilterSort(projectId: string) {
  const filterStorageKey = `orbit-board-filters-${projectId}`
  const sortStorageKey = `orbit-board-sort-${projectId}`

  const defaultFilters: FilterState = {
    search: '',
    statuses: [],
    priorities: [],
    labels: [],
    assigneeType: null,
    agentEnabled: null,
  }

  const defaultSort: SortState = {
    field: 'manual',
    direction: 'asc',
  }

  const filters = reactive<FilterState>({ ...defaultFilters })
  const sort = reactive<SortState>({ ...defaultSort })

  // Load from localStorage
  function loadFromStorage() {
    try {
      const savedFilters = localStorage.getItem(filterStorageKey)
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters)
        Object.assign(filters, parsed)
      }
    } catch {
      // ignore parse errors
    }

    try {
      const savedSort = localStorage.getItem(sortStorageKey)
      if (savedSort) {
        const parsed = JSON.parse(savedSort)
        Object.assign(sort, parsed)
      }
    } catch {
      // ignore parse errors
    }
  }

  // Save to localStorage
  function saveToStorage() {
    localStorage.setItem(filterStorageKey, JSON.stringify({
      search: filters.search,
      statuses: filters.statuses,
      priorities: filters.priorities,
      labels: filters.labels,
      assigneeType: filters.assigneeType,
      agentEnabled: filters.agentEnabled,
    }))
    localStorage.setItem(sortStorageKey, JSON.stringify({
      field: sort.field,
      direction: sort.direction,
    }))
  }

  const filteredTasks = (tasks: Task[]) => filterTasks(tasks, filters)
  const sortedTasks = (tasks: Task[]) => sortTasks(tasks, sort)

  return {
    filters,
    sort,
    loadFromStorage,
    saveToStorage,
    filteredTasks,
    sortedTasks,
  }
}
