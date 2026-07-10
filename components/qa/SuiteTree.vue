<script setup lang="ts">
import type { QaSuite } from '~/types'

const props = defineProps<{
  suites: QaSuite[]
  selectedId: string | null
  creating?: boolean
  deletingId?: string | null
}>()

const emit = defineEmits<{
  select: [id: string | null]
  create: [name: string]
  remove: [id: string]
}>()

const newName = ref('')

const roots = computed(() => props.suites.filter((s) => !s.parentId))

function childrenOf(parentId: string) {
  return props.suites.filter((s) => s.parentId === parentId)
}

function submitCreate() {
  const name = newName.value.trim()
  if (!name) return
  emit('create', name)
  newName.value = ''
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex items-center justify-between px-1 mb-2">
      <span class="text-xs font-medium text-surface-600">Suites</span>
    </div>

    <button
      type="button"
      class="text-left px-2 py-1.5 rounded-lg text-xs mb-1"
      :class="selectedId === null ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-surface-600 hover:bg-surface-50'"
      @click="emit('select', null)"
    >
      All cases
    </button>

    <div class="flex-1 overflow-y-auto space-y-0.5">
      <div v-for="suite in roots" :key="suite.id">
        <div
          class="group flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer"
          :class="selectedId === suite.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-surface-700 hover:bg-surface-50'"
          @click="emit('select', suite.id)"
        >
          <Icon name="lucide:folder" class="w-3 h-3 flex-shrink-0" />
          <span class="truncate flex-1">{{ suite.name }}</span>
          <span class="text-[10px] text-surface-400">{{ suite._caseCount || 0 }}</span>
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500 disabled:opacity-100"
            :disabled="deletingId === suite.id"
            @click.stop="emit('remove', suite.id)"
          >
            <Icon
              :name="deletingId === suite.id ? 'lucide:loader-2' : 'lucide:trash-2'"
              class="w-3 h-3"
              :class="deletingId === suite.id ? 'animate-spin' : ''"
            />
          </button>
        </div>
        <div
          v-for="child in childrenOf(suite.id)"
          :key="child.id"
          class="group flex items-center gap-1 pl-6 pr-2 py-1.5 rounded-lg text-xs cursor-pointer"
          :class="selectedId === child.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-surface-600 hover:bg-surface-50'"
          @click="emit('select', child.id)"
        >
          <Icon name="lucide:folder" class="w-3 h-3 flex-shrink-0" />
          <span class="truncate flex-1">{{ child.name }}</span>
          <span class="text-[10px] text-surface-400">{{ child._caseCount || 0 }}</span>
        </div>
      </div>
    </div>

    <form class="mt-2 flex gap-1" @submit.prevent="submitCreate">
      <input
        v-model="newName"
        type="text"
        placeholder="New suite"
        class="field-input flex-1 text-xs rounded-lg px-2 py-1.5"
        :disabled="creating"
      />
      <button
        type="submit"
        class="px-2 py-1.5 rounded-lg bg-surface-900 text-white dark:bg-black text-xs disabled:opacity-50"
        :disabled="creating || !newName.trim()"
      >
        <Icon :name="creating ? 'lucide:loader-2' : 'lucide:plus'" class="w-3 h-3" :class="creating ? 'animate-spin' : ''" />
      </button>
    </form>
  </div>
</template>
