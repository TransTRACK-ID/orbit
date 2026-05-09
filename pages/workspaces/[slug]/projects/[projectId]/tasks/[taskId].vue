<template>
  <div class="page-container max-w-4xl">
    <UiLoadingState v-if="loading" text="Loading task..." />

    <template v-else-if="task">
      <!-- Back button -->
      <div class="mb-4">
        <NuxtLink
          :to="`/workspaces/${route.params.slug}/projects/${route.params.projectId}/board`"
          class="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-900 transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          Back to board
        </NuxtLink>
      </div>

      <!-- Task detail -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <KanbanPriorityBadge :priority="task.priority" />
            <span class="text-xs font-mono text-surface-400 bg-surface-100 px-2 py-0.5 rounded">
              {{ task.id?.slice(0, 8) }}
            </span>
          </div>
          <ButtonBack @click="router.back()" />
        </div>

        <!-- Title -->
        <h1 class="text-xl font-bold text-surface-900 mb-4">{{ task.title }}</h1>

        <!-- Properties grid -->
        <div class="grid grid-cols-2 gap-4 mb-6 p-4 bg-surface-50 rounded-xl">
          <div>
            <LabelData label="Status">
              <Chip
                v-if="task.status"
                :label="task.status.name"
                :color="task.status.color"
                size="sm"
              />
            </LabelData>
          </div>
          <div>
            <LabelData label="Assignee">
              <div v-if="task.assignee" class="flex items-center gap-2">
                <Avatar :name="task.assignee.name" size="sm" />
                <span class="text-sm">{{ task.assignee.name }}</span>
              </div>
              <span v-else class="text-sm text-surface-400">Unassigned</span>
            </LabelData>
          </div>
          <div>
            <LabelData label="Priority">
              <span class="text-sm capitalize">{{ task.priority }}</span>
            </LabelData>
          </div>
          <div>
            <LabelData label="Labels">
              <div v-if="task.labels?.length" class="flex gap-1 flex-wrap">
                <Chip
                  v-for="label in task.labels"
                  :key="label.id"
                  :label="label.name"
                  :color="label.color"
                  size="sm"
                />
              </div>
              <span v-else class="text-sm text-surface-400">None</span>
            </LabelData>
          </div>
        </div>

        <!-- Description -->
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-surface-700 mb-2">Description</h3>
          <div
            v-if="task.description"
            class="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap"
          >
            {{ task.description }}
          </div>
          <p v-else class="text-sm text-surface-400 italic">No description</p>
        </div>

        <!-- Comments -->
        <div>
          <h3 class="text-sm font-semibold text-surface-700 mb-3">
            Comments ({{ comments.length }})
          </h3>
          <div class="space-y-3 mb-4">
            <div
              v-for="comment in comments"
              :key="comment.id"
              class="flex gap-3 p-3 rounded-lg bg-surface-50"
            >
              <Avatar
                :name="comment.user?.name || 'U'"
                size="sm"
              />
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-medium text-surface-900">{{ comment.user?.name }}</span>
                  <span class="text-xs text-surface-400">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="text-sm text-surface-700" v-html="linkify(comment.body.replace(/^Summary:\s*(##\s*Summary)/i, '$1').replace(/^Summary:\s*/i, ''))"></p>
              </div>
            </div>
          </div>

          <!-- Add comment -->
          <div class="flex gap-2">
            <TextInput
              v-model="newComment"
              placeholder="Write a comment..."
              class="flex-1"
              @keydown.enter.prevent="handleAddComment"
            />
            <Button :disabled="!newComment" @click="handleAddComment">Send</Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Task, Comment } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const taskId = computed(() => route.params.taskId as string)

const { fetchTaskDetail, fetchComments, addComment } = useTask()

const loading = ref(true)
const task = ref<Task | null>(null)
const comments = ref<Comment[]>([])
const newComment = ref('')

onMounted(async () => {
  try {
    task.value = await fetchTaskDetail(taskId.value)
    comments.value = await fetchComments(taskId.value)
  } catch (err) {
    console.error('Failed to load task:', err)
  } finally {
    loading.value = false
  }
})

async function handleAddComment() {
  if (!newComment.value) return
  try {
    await addComment(taskId.value, newComment.value)
    newComment.value = ''
    comments.value = await fetchComments(taskId.value)
  } catch (err) {
    console.error('Failed to add comment:', err)
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
