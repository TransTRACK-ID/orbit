<template>
  <div class="comment-collapse" :class="{ 'is-collapsed': isCollapsed }">
    <div
      ref="bodyRef"
      class="comment-collapse__inner"
      :style="innerStyle"
    >
      <KanbanMarkdownBody
        :content="content"
        :empty-text="emptyText"
        :wrapper-class="wrapperClass"
      />
    </div>

    <!-- Reveal toggle: only when content genuinely overflows -->
    <div v-if="isCollapsible" class="comment-collapse__toggle">
      <span class="comment-collapse__fade" aria-hidden="true" />
      <button
        type="button"
        class="comment-collapse__button"
        :aria-expanded="!isCollapsed"
        @click="isCollapsed = !isCollapsed"
      >
        {{ isCollapsed ? `Show more` : 'Show less' }}
        <svg
          class="comment-collapse__chevron"
          xmlns="http://www.w3.org/2000/svg"
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

/**
 * Renders a comment's markdown body and collapses tall content
 * (debug logs, stack traces, long dumps) to a capped height with a
 * "Show more" reveal. Collapse is purely height-based so it works
 * regardless of how the user pasted the log (fenced or plain).
 *
 * Composes with the existing `.comment-body` markdown styles defined
 * in TaskSidePanel — this wrapper only owns the collapse behaviour.
 */
const props = withDefaults(defineProps<{
  content: string
  wrapperClass?: string
  emptyText?: string
  /** Max height in px before the body collapses. */
  collapseThreshold?: number
}>(), {
  collapseThreshold: 120,
})

const bodyRef = ref<HTMLElement | null>(null)

/** True natural (scroll) height of the rendered body, tracked live. */
const naturalHeight = ref(0)

/** Whether the user has collapsed it. Defaults to collapsed when overlong. */
const isCollapsed = ref(true)

useResizeObserver(bodyRef, ([entry]) => {
  // scrollHeight captures the full unclipped content height, including
  // content beyond a max-height. Recomputed on any content/size change.
  const el = entry.target as HTMLElement
  naturalHeight.value = el.scrollHeight
})

/** Content is tall enough to warrant collapsing. */
const isCollapsible = computed(() => naturalHeight.value > props.collapseThreshold + 8)

/** When collapsed, clamp the inner element so overflow is hidden. */
const innerStyle = computed(() => {
  if (!isCollapsed.value || !isCollapsible.value) return undefined
  return { maxHeight: `${props.collapseThreshold}px` }
})
</script>

<style scoped>
.comment-collapse {
  position: relative;
}

.comment-collapse__inner {
  overflow: hidden;
  transition: max-height 0.2s ease-out;
}

/* When collapsed, fade the bottom edge toward the surface so the
   truncation reads as intentional rather than clipped. */
.comment-collapse.is-collapsed .comment-collapse__inner {
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
}

.comment-collapse__toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
}

/* Gradient fade sits behind the button so prose doesn't crash into it. */
.comment-collapse__fade {
  position: absolute;
  inset: 0;
  bottom: auto;
  height: 28px;
  top: -22px;
  background: linear-gradient(to bottom, transparent, theme('colors.surface.50'));
  pointer-events: none;
}

/* Agent replies render on a purple-tinted card; match that surface so the
   fade blends. The parent opts in via the `on-agent` class. */
.comment-collapse.on-agent .comment-collapse__fade {
  background: linear-gradient(to bottom, transparent, rgba(238, 242, 255, 0.9));
}

.comment-collapse__button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  color: theme('colors.surface.500');
  background: theme('colors.surface.100');
  border: 1px solid theme('colors.surface.200');
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.comment-collapse__button:hover {
  color: theme('colors.surface.700');
  background: theme('colors.surface.50');
  border-color: theme('colors.surface.300');
}

.comment-collapse__button:focus-visible {
  outline: 2px solid theme('colors.accent.DEFAULT');
  outline-offset: 1px;
}

.comment-collapse__chevron {
  transition: transform 0.2s ease-out;
}

.comment-collapse:not(.is-collapsed) .comment-collapse__chevron {
  transform: rotate(180deg);
}

/* Dark mode: fade and toggle read against the inverted surface scale. */
:global(.dark) .comment-collapse__fade {
  background: linear-gradient(to bottom, transparent, theme('colors.surface.800'));
}
:global(.dark) .comment-collapse.on-agent .comment-collapse__fade {
  background: linear-gradient(to bottom, transparent, rgba(49, 46, 64, 0.9));
}
:global(.dark) .comment-collapse__button {
  color: theme('colors.surface.400');
  background: theme('colors.surface.800');
  border-color: theme('colors.surface.700');
}
:global(.dark) .comment-collapse__button:hover {
  color: theme('colors.surface.200');
  background: theme('colors.surface.700');
  border-color: theme('colors.surface.600');
}
</style>
