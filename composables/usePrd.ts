import type { Prd, GeneratedTask } from '~/types'

const prds = ref<Prd[]>([])
const currentPrd = ref<Prd | null>(null)
const generatedTasks = ref<GeneratedTask[]>([])
const generating = ref(false)
const generatingTasks = ref(false)
const committing = ref(false)

const prdGenerationEventSources = new Map<string, EventSource>()
const prdGenerationProgress = ref<Record<string, number>>({})
const prdGenerationSteps = ref<Record<string, string>>({})

const taskGenerationEventSources = new Map<string, EventSource>()
const taskGenerationProgress = ref<Record<string, number>>({})
const taskGenerationSteps = ref<Record<string, string>>({})

export const usePrd = () => {
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  async function fetchPrds(brainstormId: string) {
    try {
      prds.value = await $fetch<Prd[]>(`/api/brainstorms/${brainstormId}/prds`, {
        headers: ssrHeaders,
      })
      // Auto-select the first PRD if none is selected
      if (prds.value.length > 0 && !currentPrd.value) {
        currentPrd.value = prds.value[0]
      }
    }
    catch (err) {
      console.error('Failed to fetch PRDs:', err)
      prds.value = []
    }
  }

  function selectPrd(prdId: string) {
    const prd = prds.value.find((p) => p.id === prdId)
    if (prd) {
      currentPrd.value = prd
    }
  }

  async function generatePrd(brainstormId: string, projectId?: string) {
    generating.value = true
    prdGenerationProgress.value = { ...prdGenerationProgress.value, [brainstormId]: 0 }
    prdGenerationSteps.value = { ...prdGenerationSteps.value, [brainstormId]: 'Starting...' }

    // Stop existing if any
    const existingEs = prdGenerationEventSources.get(brainstormId)
    if (existingEs) {
      existingEs.close()
      prdGenerationEventSources.delete(brainstormId)
    }

    try {
      // Start SSE connection
      const url = `/api/brainstorms/${brainstormId}/prd`
      const response = await $fetch(url, {
        method: 'POST',
        body: projectId ? { projectId } : {},
      })

      // For SSE, we need to use EventSource
      const es = new EventSource(url)
      prdGenerationEventSources.set(brainstormId, es)

      return new Promise<Prd>((resolve, reject) => {
        let prdResult: Prd | null = null

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.step) {
              prdGenerationSteps.value = {
                ...prdGenerationSteps.value,
                [brainstormId]: data.step,
              }
            }
            if (data.progress !== undefined) {
              prdGenerationProgress.value = {
                ...prdGenerationProgress.value,
                [brainstormId]: data.progress,
              }
            }
            if (data.done && data.prd) {
              prdResult = data.prd
              prds.value.unshift(data.prd)
              currentPrd.value = data.prd
              generating.value = false
              prdGenerationEventSources.delete(brainstormId)
              es.close()
              resolve(data.prd)
            }
            if (data.error) {
              generating.value = false
              prdGenerationEventSources.delete(brainstormId)
              es.close()
              reject(new Error(data.error))
            }
          }
          catch (err) {
            // Ignore parse errors
          }
        }

        es.onerror = () => {
          if (es.readyState === EventSource.CLOSED) {
            prdGenerationEventSources.delete(brainstormId)
            generating.value = false
            if (prdResult) {
              resolve(prdResult)
            }
            else {
              reject(new Error('Connection closed unexpectedly'))
            }
          }
        }
      })
    }
    catch (err) {
      generating.value = false
      throw err
    }
  }

  async function fetchPrd(prdId: string) {
    try {
      currentPrd.value = await $fetch<Prd>(`/api/prds/${prdId}`, {
        headers: ssrHeaders,
      })
      return currentPrd.value
    }
    catch (err) {
      console.error('Failed to fetch PRD:', err)
      currentPrd.value = null
      throw err
    }
  }

  async function updatePrd(prdId: string, data: Partial<Prd> & { sections?: any[] }) {
    try {
      const updated = await $fetch<Prd>(`/api/prds/${prdId}`, {
        method: 'PATCH',
        body: data,
      })
      // Update in list
      const idx = prds.value.findIndex((p) => p.id === prdId)
      if (idx !== -1) {
        prds.value[idx] = updated
      }
      if (currentPrd.value?.id === prdId) {
        currentPrd.value = updated
      }
      return updated
    }
    catch (err) {
      console.error('Failed to update PRD:', err)
      throw err
    }
  }

  async function generateTasks(prdId: string, projectId: string, sections?: string[]) {
    generatingTasks.value = true
    generatedTasks.value = []
    taskGenerationProgress.value = { ...taskGenerationProgress.value, [prdId]: 0 }
    taskGenerationSteps.value = { ...taskGenerationSteps.value, [prdId]: 'Starting...' }

    const existingEs = taskGenerationEventSources.get(prdId)
    if (existingEs) {
      existingEs.close()
      taskGenerationEventSources.delete(prdId)
    }

    try {
      const url = `/api/prds/${prdId}/generate-tasks`

      // First send the POST request to trigger generation
      await $fetch(url, {
        method: 'POST',
        body: { projectId, sections },
      })

      // Then connect to SSE
      const es = new EventSource(url)
      taskGenerationEventSources.set(prdId, es)

      return new Promise<GeneratedTask[]>((resolve, reject) => {
        let tasksResult: GeneratedTask[] | null = null

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.step) {
              taskGenerationSteps.value = {
                ...taskGenerationSteps.value,
                [prdId]: data.step,
              }
            }
            if (data.progress !== undefined) {
              taskGenerationProgress.value = {
                ...taskGenerationProgress.value,
                [prdId]: data.progress,
              }
            }
            if (data.done && data.tasks) {
              tasksResult = data.tasks
              generatedTasks.value = data.tasks
              generatingTasks.value = false
              taskGenerationEventSources.delete(prdId)
              es.close()
              resolve(data.tasks)
            }
            if (data.error) {
              generatingTasks.value = false
              taskGenerationEventSources.delete(prdId)
              es.close()
              reject(new Error(data.error))
            }
          }
          catch (err) {
            // Ignore parse errors
          }
        }

        es.onerror = () => {
          if (es.readyState === EventSource.CLOSED) {
            taskGenerationEventSources.delete(prdId)
            generatingTasks.value = false
            if (tasksResult) {
              resolve(tasksResult)
            }
            else {
              reject(new Error('Connection closed unexpectedly'))
            }
          }
        }
      })
    }
    catch (err) {
      generatingTasks.value = false
      throw err
    }
  }

  async function commitTasks(prdId: string, projectId: string, tasks: GeneratedTask[]) {
    committing.value = true
    try {
      const result = await $fetch<{
        success: boolean
        taskIds: string[]
        count: number
      }>(`/api/prds/${prdId}/commit-tasks`, {
        method: 'POST',
        body: { projectId, tasks },
      })

      // Update PRD to mark tasks as generated
      const updated = await fetchPrd(prdId)
      if (updated) {
        updated.tasksGenerated = true
      }
      return result
    }
    catch (err) {
      console.error('Failed to commit tasks:', err)
      throw err
    }
    finally {
      committing.value = false
    }
  }

  async function deletePrd(prdId: string) {
    try {
      await $fetch(`/api/prds/${prdId}`, {
        method: 'DELETE',
      })
      prds.value = prds.value.filter((p) => p.id !== prdId)
      if (currentPrd.value?.id === prdId) {
        currentPrd.value = null
      }
    }
    catch (err) {
      console.error('Failed to delete PRD:', err)
      throw err
    }
  }

  return {
    prds,
    currentPrd,
    generatedTasks,
    generating,
    generatingTasks,
    committing,
    prdGenerationProgress,
    prdGenerationSteps,
    taskGenerationProgress,
    taskGenerationSteps,
    fetchPrds,
    generatePrd,
    fetchPrd,
    updatePrd,
    selectPrd,
    generateTasks,
    commitTasks,
    deletePrd,
  }
}
