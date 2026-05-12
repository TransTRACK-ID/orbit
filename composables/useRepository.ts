import type { Repository } from '~/types'

export const useRepository = () => {
  const repositories = ref<Repository[]>([])
  const loading = ref(false)

  async function fetchRepositories(workspaceId: string) {
    loading.value = true
    try {
      repositories.value = await $fetch<Repository[]>(`/api/workspaces/${workspaceId}/repositories`)
    } catch (err) {
      console.error('Failed to fetch repositories:', err)
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

  return {
    repositories,
    loading,
    fetchRepositories,
    createRepository,
    updateRepository,
    deleteRepository,
  }
}
