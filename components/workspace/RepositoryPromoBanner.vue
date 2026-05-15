<template>
  <div
    v-if="!isDismissed"
    class="mb-6 p-4 rounded-xl bg-accent-50 border border-accent-200 flex items-start gap-3"
    :class="$attrs.class"
  >
    <div class="flex-shrink-0 mt-0.5">
      <Icon name="lucide:git-branch" class="w-5 h-5 text-accent" />
    </div>
    <div class="flex-1 min-w-0">
      <h3 class="text-sm font-semibold text-accent-900 mb-1">
        Connect a repository to unlock the full power of Orbit
      </h3>
      <p class="text-xs text-accent-700 mb-3 leading-relaxed">
        Your kanban board works great, but connecting a repository enables:
        <span class="font-medium">agent code changes</span>,
        <span class="font-medium">PR review tracking</span>,
        <span class="font-medium">branch management</span>, and
        <span class="font-medium">codebase brainstorming</span>.
        You can set this up anytime.
      </p>
      <div class="flex items-center gap-2">
        <NuxtLink
          :to="settingsLink"
          class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-600 transition-colors inline-flex items-center gap-1.5"
        >
          <Icon name="lucide:settings" class="w-3 h-3" />
          Connect Repository
        </NuxtLink>
        <button
          class="text-xs text-accent-600 hover:text-accent-800 underline"
          @click="dismiss"
        >
          I'll do this later
        </button>
      </div>
    </div>
    <button
      class="flex-shrink-0 w-6 h-6 rounded-lg hover:bg-accent-100 text-accent-500 hover:text-accent-700 transition-colors flex items-center justify-center"
      @click="dismiss"
    >
      <Icon name="lucide:x" class="w-3.5 h-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  workspaceSlug: string
  dismissedPrompts?: string[]
}>()

const emit = defineEmits<{
  dismissed: []
}>()

const isDismissed = computed(() =>
  (props.dismissedPrompts || []).includes('repo-setup-promo')
)

const settingsLink = computed(() =>
  `/workspaces/${props.workspaceSlug}/settings?tab=repositories&focus=add-repo`
)

async function dismiss() {
  try {
    await $fetch(`/api/workspaces/${props.workspaceId}/dismiss-prompt`, {
      method: 'PATCH',
      body: { promptKey: 'repo-setup-promo' }
    })
    emit('dismissed')
  } catch (err) {
    console.error('Failed to dismiss prompt:', err)
  }
}
</script>
