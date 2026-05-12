import type { AdminStats, AdminUser, AdminProject } from '~/types'

export const useAdmin = () => {
  const stats = ref<AdminStats | null>(null)
  const users = ref<AdminUser[]>([])
  const projects = ref<AdminProject[]>([])
  const loadingStats = ref(false)
  const loadingUsers = ref(false)
  const loadingProjects = ref(false)
  const error = ref<string | null>(null)

  async function fetchStats() {
    loadingStats.value = true
    error.value = null
    try {
      stats.value = await $fetch<AdminStats>('/api/admin/stats')
    } catch (err: any) {
      error.value = err?.statusMessage || err?.message || 'Failed to load stats'
      console.error('Failed to fetch admin stats:', err)
    } finally {
      loadingStats.value = false
    }
  }

  async function fetchUsers() {
    loadingUsers.value = true
    error.value = null
    try {
      users.value = await $fetch<AdminUser[]>('/api/admin/users')
    } catch (err: any) {
      error.value = err?.statusMessage || err?.message || 'Failed to load users'
      console.error('Failed to fetch admin users:', err)
    } finally {
      loadingUsers.value = false
    }
  }

  async function fetchProjects() {
    loadingProjects.value = true
    error.value = null
    try {
      projects.value = await $fetch<AdminProject[]>('/api/admin/projects')
    } catch (err: any) {
      error.value = err?.statusMessage || err?.message || 'Failed to load projects'
      console.error('Failed to fetch admin projects:', err)
    } finally {
      loadingProjects.value = false
    }
  }

  return {
    stats,
    users,
    projects,
    loadingStats,
    loadingUsers,
    loadingProjects,
    error,
    fetchStats,
    fetchUsers,
    fetchProjects,
  }
}
