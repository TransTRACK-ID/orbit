<template>
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-6 sm:px-8 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2 text-sm text-surface-500">
          <NuxtLink :to="`/workspaces/${slug}/releases`" class="hover:text-accent transition-colors">
            Releases
          </NuxtLink>
          <Icon name="lucide:chevron-right" class="w-3.5 h-3.5" />
          <span class="text-surface-900 font-medium">{{ isEdit ? 'Edit changelog' : 'New release' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              v-model="form.published"
              type="checkbox"
              class="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent"
            />
            <span class="text-surface-700">Published</span>
          </label>
          <Button color="primary" :loading="saving" @click="handleSave">
            <Icon name="lucide:save" class="w-3.5 h-3.5" />
            Save
          </Button>
        </div>
      </div>

      <!-- Loading -->
      <UiLoadingState v-if="loading" text="Loading…" />

      <template v-else>
        <!-- App / Version selector -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label class="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">App</label>
            <select
              v-model="selectedAppId"
              class="w-full h-10 px-3 text-sm border border-surface-200 rounded-lg bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              :disabled="isEdit"
            >
              <option value="">Select app</option>
              <option v-for="app in apps" :key="app.id" :value="app.id">{{ app.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Version</label>
            <select
              v-model="selectedVersionId"
              class="w-full h-10 px-3 text-sm border border-surface-200 rounded-lg bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              :disabled="isEdit || !selectedAppId"
            >
              <option value="">Select version</option>
              <option v-for="v in availableVersions" :key="v.id" :value="v.id">
                {{ v.version }} — {{ v.date }} ({{ v.status }})
              </option>
            </select>
          </div>
        </div>

        <!-- Core fields -->
        <div class="space-y-4 mb-6">
          <TextInput
            v-model="form.heroTitle"
            label="Hero title"
            placeholder="e.g. Request tracing, deep health checks, and retry reliability"
          />
          <TextArea
            v-model="form.summary"
            label="Summary"
            placeholder="Short summary of this release…"
            :rows="2"
          />
        </div>

        <!-- Features -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-surface-900">Features</h3>
            <TextButton @click="addFeature">
              <Icon name="lucide:plus" class="w-3.5 h-3.5" />
              Add feature
            </TextButton>
          </div>
          <div class="space-y-3">
            <div
              v-for="(feature, idx) in form.features"
              :key="idx"
              class="bg-white dark:bg-surface-100 border border-surface-200 rounded-xl p-4"
            >
              <div class="flex items-start justify-between mb-2">
                <span class="text-xs font-medium text-surface-400">Feature {{ idx + 1 }}</span>
                <button
                  class="text-surface-400 hover:text-error-500 transition-colors"
                  @click="removeFeature(idx)"
                >
                  <Icon name="lucide:trash-2" class="w-3.5 h-3.5" />
                </button>
              </div>
              <div class="space-y-3">
                <TextInput
                  v-model="feature.heading"
                  placeholder="Feature heading"
                />
                <TextArea
                  v-model="feature.description"
                  placeholder="Describe the feature…"
                  :rows="2"
                />
                <!-- Media -->
                <div v-if="feature.media && feature.media.length > 0" class="space-y-2">
                  <div
                    v-for="(m, mIdx) in feature.media"
                    :key="mIdx"
                    class="flex items-center gap-2"
                  >
                    <select
                      v-model="m.type"
                      class="h-8 px-2 text-xs border border-surface-200 rounded bg-white"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                    <TextInput
                      v-model="m.src"
                      placeholder="URL"
                      class="flex-1"
                    />
                    <TextInput
                      v-model="m.alt"
                      placeholder="Alt text"
                      class="flex-1"
                    />
                    <button class="text-surface-400 hover:text-error-500" @click="removeMedia(feature, mIdx)">
                      <Icon name="lucide:trash-2" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <TextButton @click="addMedia(feature)">
                  <Icon name="lucide:plus" class="w-3 h-3" />
                  Add media
                </TextButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Categories -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <ReleasesCategoryEditor
            v-for="cat in categoryKeys"
            :key="cat.key"
            v-model="form.categories[cat.key]"
            :title="cat.label"
            :icon="cat.icon"
            :color="cat.color"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocsApp, DocsVersion, ReleaseFeature, ReleaseCategories } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const queryApp = computed(() => route.query.app as string | undefined)
const queryVersion = computed(() => route.query.version as string | undefined)

const { workspace, getWorkspaceBySlug } = useWorkspace()
const { apps, loading, fetchApps, saveRelease } = useReleases()

const selectedAppId = ref('')
const selectedVersionId = ref('')
const saving = ref(false)

const isEdit = computed(() => !!queryVersion.value)

const form = ref<{
  published: boolean
  heroTitle: string
  summary: string
  features: ReleaseFeature[]
  categories: ReleaseCategories
}>({
  published: false,
  heroTitle: '',
  summary: '',
  features: [],
  categories: {},
})

const categoryKeys = [
  { key: 'added' as const, label: 'Added', icon: 'lucide:plus-circle', color: 'green' },
  { key: 'fixed' as const, label: 'Fixed', icon: 'lucide:check-circle', color: 'blue' },
  { key: 'changed' as const, label: 'Changed', icon: 'lucide:refresh-cw', color: 'amber' },
  { key: 'deprecated' as const, label: 'Deprecated', icon: 'lucide:alert-triangle', color: 'purple' },
  { key: 'security' as const, label: 'Security', icon: 'lucide:shield', color: 'red' },
]

// SSR fetch
const { data: ssrData } = await useAsyncData(
  `changelog-${slug.value}`,
  async () => {
    const ws = await $fetch(`/api/workspaces/by-slug/${slug.value}`)
    const appsData = await $fetch<DocsApp[]>(`/api/workspaces/${ws.id}/docs-apps`)
    return { workspace: ws, apps: appsData }
  }
)

if (ssrData.value) {
  workspace.value = ssrData.value.workspace
  apps.value = ssrData.value.apps
}

onMounted(async () => {
  if (!workspace.value) {
    workspace.value = await getWorkspaceBySlug(slug.value)
  }
  if (apps.value.length === 0 && workspace.value) {
    await fetchApps(workspace.value.id)
  }

  // Pre-select from query
  if (queryApp.value) {
    selectedAppId.value = queryApp.value
  }
  if (queryVersion.value) {
    selectedVersionId.value = queryVersion.value
    // Load existing release data
    const version = availableVersions.value.find(v => v.id === queryVersion.value)
    if (version?.release) {
      form.value.published = version.release.published
      form.value.heroTitle = version.release.heroTitle || ''
      form.value.summary = version.release.summary || ''
      form.value.features = version.release.features || []
      form.value.categories = version.release.categories || {}
    }
  }
})

const availableVersions = computed(() => {
  if (!selectedAppId.value) return []
  const app = apps.value.find(a => a.id === selectedAppId.value)
  return app?.versions || []
})

watch(selectedAppId, () => {
  if (!isEdit.value) {
    selectedVersionId.value = ''
  }
})

function addFeature() {
  form.value.features.push({
    id: `feature-${Date.now()}`,
    heading: '',
    description: '',
    media: [],
  })
}

function removeFeature(idx: number) {
  form.value.features.splice(idx, 1)
}

function addMedia(feature: ReleaseFeature) {
  if (!feature.media) feature.media = []
  feature.media.push({ type: 'image', src: '', alt: '' })
}

function removeMedia(feature: ReleaseFeature, idx: number) {
  feature.media?.splice(idx, 1)
}

async function handleSave() {
  if (!selectedVersionId.value) {
    alert('Please select a version')
    return
  }
  saving.value = true
  try {
    await saveRelease(selectedVersionId.value, {
      published: form.value.published,
      heroTitle: form.value.heroTitle || null,
      summary: form.value.summary || null,
      features: form.value.features,
      categories: form.value.categories,
    })
    router.push(`/workspaces/${slug.value}/releases`)
  } catch (err) {
    console.error('Failed to save release:', err)
    alert('Failed to save release. Check console for details.')
  } finally {
    saving.value = false
  }
}
</script>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  components: {
    CategoryEditor: defineComponent({
      props: {
        modelValue: { type: Array as () => string[], default: () => [] },
        title: { type: String, required: true },
        icon: { type: String, required: true },
        color: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const items = computed({
          get: () => props.modelValue || [],
          set: (val) => emit('update:modelValue', val),
        })

        const rawText = computed({
          get: () => items.value.join('\n'),
          set: (val: string) => {
            items.value = val.split('\n').map(s => s.trim()).filter(Boolean)
          },
        })

        return { rawText, items, props }
      },
      template: `
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <Icon :name="props.icon" :class="['w-4 h-4', `text-${props.color}-600`]" />
            <span class="text-xs font-semibold text-surface-700">{{ props.title }}</span>
            <span class="text-[10px] text-surface-400 font-mono">{{ items.length }}</span>
          </div>
          <textarea
            v-model="rawText"
            :rows="3"
            placeholder="One item per line…"
            class="w-full text-sm px-3 py-2 border border-surface-200 rounded-lg bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-y"
          />
        </div>
      `,
    }),
  },
})
</script>
