import { ref, computed } from 'vue'

const isSelectionMode = ref(false)
const selectedTaskIds = ref<Set<string>>(new Set())
const lastToggledAt = new Map<string, number>()

export function useTaskSelection() {
  const selectedCount = computed(() => selectedTaskIds.value.size)

  const isSelected = (taskId: string) => selectedTaskIds.value.has(taskId)

  function toggleSelection(taskId: string) {
    const now = Date.now()
    const last = lastToggledAt.get(taskId)
    if (last && now - last < 300) return
    lastToggledAt.set(taskId, now)

    const next = new Set(selectedTaskIds.value)
    if (next.has(taskId)) {
      next.delete(taskId)
    } else {
      next.add(taskId)
    }
    selectedTaskIds.value = next
  }

  function selectTask(taskId: string) {
    selectedTaskIds.value = new Set(selectedTaskIds.value).add(taskId)
  }

  function deselectTask(taskId: string) {
    const next = new Set(selectedTaskIds.value)
    next.delete(taskId)
    selectedTaskIds.value = next
  }

  function clearSelection() {
    selectedTaskIds.value = new Set()
  }

  function enterSelectionMode() {
    isSelectionMode.value = true
    clearSelection()
  }

  function exitSelectionMode() {
    isSelectionMode.value = false
    clearSelection()
  }

  function selectAll(taskIds: string[]) {
    const next = new Set(selectedTaskIds.value)
    for (const id of taskIds) {
      next.add(id)
    }
    selectedTaskIds.value = next
  }

  function deselectAll(taskIds: string[]) {
    const next = new Set(selectedTaskIds.value)
    for (const id of taskIds) {
      next.delete(id)
    }
    selectedTaskIds.value = next
  }

  function areAllSelected(taskIds: string[]) {
    if (taskIds.length === 0) return false
    return taskIds.every((id) => selectedTaskIds.value.has(id))
  }

  function toggleSelectAll(taskIds: string[]) {
    if (areAllSelected(taskIds)) {
      deselectAll(taskIds)
    } else {
      selectAll(taskIds)
    }
  }

  return {
    isSelectionMode,
    selectedTaskIds,
    selectedCount,
    isSelected,
    toggleSelection,
    selectTask,
    deselectTask,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    selectAll,
    deselectAll,
    areAllSelected,
    toggleSelectAll,
  }
}
