<template>
  <div>
    <UiLoadingState v-if="loading" text="Loading members..." />

    <div v-else class="space-y-2">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex items-center gap-3 p-3 rounded-lg bg-surface-50"
      >
        <Avatar
          :name="member.user?.name || 'U'"
          size="sm"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-surface-900 truncate">
            {{ member.user?.name }}
            <span v-if="member.role === 'owner'" class="text-xs text-primary-500 font-normal ml-1">Owner</span>
            <span v-else-if="member.role === 'admin'" class="text-xs text-info-500 font-normal ml-1">Admin</span>
          </p>
          <p class="text-xs text-surface-500 truncate">{{ member.user?.email }}</p>
        </div>
        <Chip
          v-if="member.role === 'owner'"
          label="Owner"
          color="#F14848"
          size="sm"
        />
        <IconButton
          v-if="member.role !== 'owner'"
          @click="handleRemove(member)"
        >
          <template #icon>
            <Close class="w-3.5 h-3.5" />
          </template>
        </IconButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceMember } from '~/types'

const props = defineProps<{
  workspaceId: string
}>()

const { fetchMembers, removeMember } = useWorkspace()

const members = ref<WorkspaceMember[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    members.value = await fetchMembers(props.workspaceId)
  } catch (err) {
    console.error('Failed to fetch members:', err)
  } finally {
    loading.value = false
  }
})

async function handleRemove(member: WorkspaceMember) {
  try {
    await removeMember(props.workspaceId, member.userId)
    members.value = members.value.filter((m) => m.id !== member.id)
  } catch (err) {
    console.error('Failed to remove member:', err)
  }
}
</script>
