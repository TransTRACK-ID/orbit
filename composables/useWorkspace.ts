import type { Workspace, WorkspaceMember } from '~/types'

export const useWorkspace = () => {
  const workspaces = ref<Workspace[]>([])
  const loading = ref(false)

  async function fetchWorkspaces() {
    loading.value = true
    try {
      workspaces.value = await $fetch('/api/workspaces')
    } catch (err) {
      console.error('Failed to fetch workspaces:', err)
    } finally {
      loading.value = false
    }
  }

  async function createWorkspace(data: { name: string; slug: string; description?: string }) {
    return await $fetch<Workspace>('/api/workspaces', {
      method: 'POST',
      body: data,
    })
  }

  async function updateWorkspace(id: string, data: Partial<Workspace>) {
    const updated = await $fetch<Workspace>(`/api/workspaces/${id}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = workspaces.value.findIndex((w) => w.id === id)
    if (idx !== -1) workspaces.value[idx] = updated
    return updated
  }

  async function deleteWorkspace(id: string) {
    await $fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
    workspaces.value = workspaces.value.filter((w) => w.id !== id)
  }

  async function fetchMembers(workspaceId: string) {
    return await $fetch<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`)
  }

  async function inviteMember(workspaceId: string, email: string, role = 'member') {
    return await $fetch<WorkspaceMember>(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: { email, role },
    })
  }

  async function removeMember(workspaceId: string, userId: string) {
    await $fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async function getWorkspaceBySlug(slug: string) {
    // Find from loaded workspaces first
    const found = workspaces.value.find((w) => w.slug === slug)
    if (found) return found
    // Fetch fresh if not loaded
    await fetchWorkspaces()
    return workspaces.value.find((w) => w.slug === slug)
  }

  return {
    workspaces,
    loading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    fetchMembers,
    inviteMember,
    removeMember,
    getWorkspaceBySlug,
  }
}
