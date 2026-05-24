import type { DocsApp, FlattenedRelease, DocsRelease, ReleaseFeature, ReleaseCategories } from '~/types'

const apps = ref<DocsApp[]>([])
const releases = ref<FlattenedRelease[]>([])
const loading = ref(false)

export const useReleases = () => {
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  async function fetchApps(workspaceId: string) {
    loading.value = true
    try {
      apps.value = await $fetch<DocsApp[]>(`/api/workspaces/${workspaceId}/docs-apps`, {
        headers: ssrHeaders,
      })
    } catch (err) {
      console.error('Failed to fetch docs apps:', err)
      apps.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchReleases(workspaceId: string) {
    loading.value = true
    try {
      releases.value = await $fetch<FlattenedRelease[]>(`/api/workspaces/${workspaceId}/releases`, {
        headers: ssrHeaders,
      })
    } catch (err) {
      console.error('Failed to fetch releases:', err)
      releases.value = []
    } finally {
      loading.value = false
    }
  }

  async function createApp(workspaceId: string, data: { name: string; slug: string; currentVersion?: string }) {
    const app = await $fetch<DocsApp>(`/api/workspaces/${workspaceId}/docs-apps`, {
      method: 'POST',
      body: data,
    })
    apps.value = [...apps.value, app]
    return app
  }

  async function createVersion(workspaceId: string, appId: string, data: { version: string; date: string; author: string; status?: string }) {
    const version = await $fetch(`/api/workspaces/${workspaceId}/docs-apps/${appId}/versions`, {
      method: 'POST',
      body: data,
    })
    await fetchApps(workspaceId)
    return version
  }

  async function saveRelease(versionId: string, data: Partial<DocsRelease>) {
    const release = await $fetch<DocsRelease>(`/api/versions/${versionId}/release`, {
      method: 'POST',
      body: data,
    })
    return release
  }

  async function updateRelease(releaseId: string, data: Partial<DocsRelease>) {
    const release = await $fetch<DocsRelease>(`/api/releases/${releaseId}`, {
      method: 'PATCH',
      body: data,
    })
    return release
  }

  async function getRelease(releaseId: string) {
    return await $fetch<FlattenedRelease>(`/api/releases/${releaseId}`, {
      headers: ssrHeaders,
    })
  }

  return {
    apps,
    releases,
    loading,
    fetchApps,
    fetchReleases,
    createApp,
    createVersion,
    saveRelease,
    updateRelease,
    getRelease,
  }
}
