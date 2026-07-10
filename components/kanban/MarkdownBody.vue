<template>
  <div
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
const html = computed(() => parseMarkdown(props.content, { emptyText: props.emptyText }))

useMermaidRender(root, () => props.content)
</script>
