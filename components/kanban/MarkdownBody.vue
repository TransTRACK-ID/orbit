<template>
  <p
    v-if="!content?.trim() && emptyText"
    class="markdown-body-empty"
  >
    {{ emptyText }}
  </p>
  <div
    v-else
    ref="root"
    class="markdown-body"
    :class="wrapperClass"
    v-html="html"
  />
</template>

<script setup lang="ts">
import { parseMarkdown } from '~/utils/markdown'
import { useMermaidRender } from '~/composables/useMermaid'

const props = defineProps<{
  content: string
  emptyText?: string
  wrapperClass?: string
}>()

const root = ref<HTMLElement | null>(null)
const html = computed(() => {
  if (!props.content?.trim()) return ''
  return parseMarkdown(props.content)
})

useMermaidRender(root, () => props.content)
</script>
