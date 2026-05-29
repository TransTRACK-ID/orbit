<template>
  <div class="flex flex-col h-full bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-surface-100 flex-shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style="background: #8B5CF6"
        >
          <Icon name="lucide:file-text" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-surface-900 truncate">{{ prd.title }}</h3>
          <p class="text-[11px] text-surface-400 truncate">
            From: "{{ prd.brainstorm?.title || 'Brainstorm' }}" brainstorm
            <span v-if="prd.version > 1" class="text-primary-500">(v{{ prd.version }})</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Status badge -->
        <div class="relative">
          <button
            class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 transition-colors"
            :class="statusBadgeClass"
            @click="showStatusDropdown = !showStatusDropdown"
          >
            <Icon name="lucide:circle" class="w-2 h-2" />
            {{ prd.status }}
            <Icon name="lucide:chevron-down" class="w-3 h-3" />
          </button>
          <!-- Status dropdown -->
          <div
            v-if="showStatusDropdown"
            class="absolute right-0 mt-1 w-32 bg-white border border-surface-200 rounded-lg shadow-lg py-1 z-20"
          >
            <button
              v-for="status in ['draft', 'review', 'approved', 'archived']"
              :key="status"
              class="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 transition-colors capitalize"
              :class="prd.status === status ? 'text-primary-600 font-semibold' : 'text-surface-700'"
              @click="handleStatusChange(status)"
            >
              {{ status }}
            </button>
          </div>
        </div>

        <!-- PRD count badge -->
        <span
          v-if="prds.length > 1"
          class="text-[10px] text-surface-500 bg-surface-100 px-2 py-1 rounded-full"
        >
          {{ prds.length }} PRDs
        </span>
      </div>
    </div>

    <!-- Sections -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      <div v-if="generating" class="flex flex-col items-center justify-center h-full text-surface-400 py-12">
        <div class="relative mb-4">
          <div class="w-12 h-12 rounded-full border-2 border-surface-200 border-t-primary-500 animate-spin" />
        </div>
        <p class="text-sm font-medium">{{ generationStep }}</p>
        <p class="text-[11px] mt-1">{{ generationProgress }}%</p>
      </div>

      <div v-else-if="!prd.sections || prd.sections.length === 0" class="flex flex-col items-center justify-center h-full text-surface-400 py-12">
        <Icon name="lucide:file-text" class="w-10 h-10 mb-3 opacity-40" />
        <p class="text-sm">No sections in this PRD</p>
      </div>

      <template v-else>
        <PrdSectionCard
          v-for="section in prd.sections"
          :key="section.id"
          :section="section"
          :editing="editingSectionId === section.id"
          @save="(content) => handleSectionSave(section, content)"
        />
      </template>
    </div>

    <!-- Actions footer -->
    <div class="border-t border-surface-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center gap-2">
        <button
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors flex items-center gap-1"
          :disabled="generating"
          @click="$emit('regenerate')"
        >
          <Icon name="lucide:refresh-cw" class="w-3 h-3" />
          Regenerate
        </button>
        <button
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors flex items-center gap-1"
          @click="toggleEditMode"
        >
          <Icon name="lucide:edit" class="w-3 h-3" />
          {{ isEditing ? 'Done' : 'Edit' }}
        </button>
        <button
          v-if="prd.status === 'draft'"
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1"
          @click="confirmDelete"
        >
          <Icon name="lucide:trash-2" class="w-3 h-3" />
          Delete
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="!prd.tasksGenerated"
          class="text-[10px] font-semibold px-2.5 py-1.5 rounded-md bg-purple-500 text-white hover:bg-purple-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="generatingTasks"
          :title="generatingTasks ? 'Task generation in progress...' : 'Generate tasks from this PRD'"
          @click="$emit('generateTasks')"
        >
          <Icon name="lucide:list-checks" class="w-3 h-3" />
          {{ generatingTasks ? 'Generating...' : 'Generate Tasks' }}
        </button>
        <span
          v-else
          class="text-[10px] text-surface-500 bg-surface-100 px-2.5 py-1.5 rounded-md flex items-center gap-1"
        >
          <Icon name="lucide:check" class="w-3 h-3" />
          Tasks Generated
        </span>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="showDeleteConfirm = false">
        <div class="bg-white rounded-xl border border-surface-200 shadow-lg w-full max-w-sm p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Icon name="lucide:alert-triangle" class="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-surface-900">Delete PRD</h3>
              <p class="text-xs text-surface-500 mt-0.5">This action cannot be undone</p>
            </div>
          </div>
          <p class="text-xs text-surface-600 mb-4">
            Are you sure you want to delete "<span class="font-medium">{{ prd.title }}</span>"? This will remove all sections and cannot be recovered.
          </p>
          <div class="flex items-center justify-end gap-2">
            <button
              class="px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors"
              @click="showDeleteConfirm = false"
            >
              Cancel
            </button>
            <button
              class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
              @click="handleDelete"
            >
              Delete PRD
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Prd, PrdSection } from '~/types'

const props = defineProps<{
  prd: Prd
  prds: Prd[]
  generating: boolean
  generatingTasks: boolean
  generationStep: string
  generationProgress: number
}>()

const emit = defineEmits<{
  regenerate: []
  generateTasks: []
  updatePrd: [data: Partial<Prd>]
  updateSection: [sectionId: string, content: string]
  delete: []
}>()

const showStatusDropdown = ref(false)
const isEditing = ref(false)
const editingSectionId = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const statusBadgeClass = computed(() => {
  const classes: Record<string, string> = {
    draft: 'bg-surface-100 text-surface-600',
    review: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    archived: 'bg-surface-100 text-surface-400 line-through',
  }
  return classes[props.prd.status] || classes.draft
})

function handleStatusChange(status: string) {
  showStatusDropdown.value = false
  emit('updatePrd', { status: status as Prd['status'] })
}

function toggleEditMode() {
  isEditing.value = !isEditing.value
  if (!isEditing.value) {
    editingSectionId.value = null
  }
  else {
    // Enable editing for the first section
    if (props.prd.sections && props.prd.sections.length > 0) {
      editingSectionId.value = props.prd.sections[0].id
    }
  }
}

function handleSectionSave(section: PrdSection, content: string) {
  editingSectionId.value = null
  emit('updateSection', section.id, content)
}

function confirmDelete() {
  showDeleteConfirm.value = true
}

function handleDelete() {
  showDeleteConfirm.value = false
  emit('delete')
}

// Close dropdown when clicking outside
function onClickOutside(e: MouseEvent) {
  if (showStatusDropdown.value) {
    showStatusDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>
