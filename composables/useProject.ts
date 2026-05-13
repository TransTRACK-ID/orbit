import type { Project, ProjectMember, Status, Label } from '~/types'

const projects = ref<Project[]>([])
const currentProject = ref<Project | null>(null)
const projectStatuses = ref<Status[]>([])
const projectLabels = ref<Label[]>([])
const loading = ref(false)

export const useProject = () => {

  async function fetchProjects(workspaceId: string) {
    loading.value = true
    try {
      // Get workspace projects via tasks endpoint for now
      // We need a projects list API
      const ws = await $fetch(`/api/workspaces/${workspaceId}`)
      // Projects are fetched from workspace route
      const allWorkspaces = await $fetch('/api/workspaces')
      const workspace = (allWorkspaces as any[]).find((w: any) => w.id === workspaceId)
      // This is a workaround - we actually need a dedicated projects endpoint
      // Let's use the workspace member route to get projects
      const projectsData = await $fetch(`/api/workspaces/${workspaceId}/projects`)
      projects.value = projectsData as any
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      projects.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchProjectDetail(projectId: string) {
    const data = await $fetch<any>(`/api/projects/${projectId}`)
    currentProject.value = data
    projectStatuses.value = data.statuses || []
    projectLabels.value = data.labels || []
    return data
  }

  async function createProject(workspaceId: string, data: { name: string; description?: string; color?: string; icon?: string; templateId?: string; stack?: string }) {
    const project = await $fetch<Project>(`/api/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: data,
    })
    projects.value = [...projects.value, project]
    return project
  }

  async function createProjectFromTemplate(workspaceId: string, data: {
    name: string
    description?: string
    color?: string
    icon?: string
    templateId: string
    repositoryName: string
    repositoryUrl?: string
    platform?: 'github' | 'gitlab' | 'gitlab-self-hosted'
    token?: string
    createRemoteRepo?: boolean
    isPrivate?: boolean
    variables?: Record<string, string>
  }) {
    const result = await $fetch<{ project: Project }>(`/api/workspaces/${workspaceId}/projects.from-template`, {
      method: 'POST',
      body: data,
    })
    projects.value = [...projects.value, result.project]
    return result.project
  }

  async function updateProject(id: string, data: Partial<Project>) {
    const updated = await $fetch<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: data,
    })
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx !== -1) projects.value[idx] = updated
    if (currentProject.value?.id === id) currentProject.value = updated
    return updated
  }

  async function deleteProject(id: string) {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
    projects.value = projects.value.filter((p) => p.id !== id)
  }

  async function getProjectById(id: string) {
    if (currentProject.value?.id === id) return currentProject.value
    const found = projects.value.find((p) => p.id === id)
    if (found) return found
    try {
      const data = await $fetch<any>(`/api/projects/${id}`)
      currentProject.value = data
      return data
    } catch {
      return null
    }
  }

  async function fetchMembers(projectId: string) {
    return await $fetch<ProjectMember[]>(`/api/projects/${projectId}/members`)
  }

  // Status management
  async function createStatus(projectId: string, data: { name: string; color?: string }) {
    const status = await $fetch<Status>(`/api/projects/${projectId}/statuses`, {
      method: 'POST',
      body: data,
    })
    projectStatuses.value.push(status)
    return status
  }

  // Label management
  async function createLabel(projectId: string, data: { name: string; color?: string }) {
    const label = await $fetch<Label>(`/api/projects/${projectId}/labels`, {
      method: 'POST',
      body: data,
    })
    projectLabels.value.push(label)
    return label
  }

  return {
    projects,
    currentProject,
    projectStatuses,
    projectLabels,
    loading,
    fetchProjects,
    fetchProjectDetail,
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
    fetchMembers,
    createStatus,
    createLabel,
  }
}
