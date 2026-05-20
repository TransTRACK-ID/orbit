import type { Repository } from '~/types'

export const useRepository = () => {
  const repositories = ref<Repository[]>([])
  const loading = ref(false)
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  async function fetchRepositories(workspaceId: string) {
    loading.value = true
    try {
      const data = await $fetch<Repository[]>(`/api/workspaces/${workspaceId}/repositories`, {
        headers: ssrHeaders,
      })
      repositories.value = data
      return data
    } catch (err) {
      console.error('Failed to fetch repositories:', err)
      repositories.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  async function createRepository(workspaceId: string, data: { name: string; url: string; defaultBranch?: string; createBranch?: boolean; platform?: 'github' | 'gitlab' | 'gitlab-self-hosted'; token?: string }) {
    const repo = await $fetch<Repository>(`/api/workspaces/${workspaceId}/repositories`, {
      method: 'POST',
      body: data,
    })
    repositories.value.push(repo)
    return repo
  }

  async function updateRepository(workspaceId: string, repoId: string, data: Partial<Repository>) {
    const updated = await $fetch<Repository>(`/api/workspaces/${workspaceId}/repositories/${repoId}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = repositories.value.findIndex((r) => r.id === repoId)
    if (idx !== -1) repositories.value[idx] = updated
    return updated
  }

  async function deleteRepository(workspaceId: string, repoId: string) {
    await $fetch(`/api/workspaces/${workspaceId}/repositories/${repoId}`, { method: 'DELETE' })
    repositories.value = repositories.value.filter((r) => r.id !== repoId)
  }

  async function checkRepositoryConnection(workspaceId: string, data: { url: string; platform: 'github' | 'gitlab' | 'gitlab-self-hosted'; token?: string }) {
    return await $fetch<{ success: boolean; message: string }>(`/api/workspaces/${workspaceId}/repositories/check-connection`, {
      method: 'POST',
      body: data,
    })
  }

  return {
    repositories,
    loading,
    fetchRepositories,
    createRepository,
    updateRepository,
    deleteRepository,
    checkRepositoryConnection,
  }
}
