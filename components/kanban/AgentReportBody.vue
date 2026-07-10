<template>
  <div class="agent-report-body">
    <section
      v-for="(section, index) in sections"
      :key="`${section.title}-${index}`"
      class="agent-report-body__section"
    >
      <h3 class="agent-report-body__heading">
        {{ section.title }}
      </h3>

      <p
        v-for="(paragraph, pIndex) in section.paragraphs"
        :key="`p-${index}-${pIndex}`"
        class="agent-report-body__paragraph"
        v-html="linkify(paragraph)"
      />

      <ul
        v-if="section.items.length > 0"
        class="agent-report-body__list"
      >
        <li
          v-for="(item, iIndex) in section.items"
          :key="`i-${index}-${iIndex}`"
          class="agent-report-body__list-item"
        >
          <template v-if="item.label">
            <span class="agent-report-body__label">{{ item.label }}:</span>
            <span v-html="linkify(item.value)" />
          </template>
          <span v-else v-html="linkify(item.value)" />
        </li>
      </ul>

      <div
        v-if="section.images.length > 0"
        class="agent-report-body__images"
      >
        <button
          v-for="(image, imageIndex) in section.images"
          :key="`img-${index}-${image.attachmentId}-${imageIndex}`"
          type="button"
          class="agent-report-body__image-button"
          :title="image.originalName"
          @click="previewImage(image)"
        >
          <img
            :src="image.url"
            :alt="image.originalName"
            class="agent-report-body__image"
            loading="lazy"
            @error="hideBrokenImage"
          />
          <span class="agent-report-body__image-caption">{{ image.originalName }}</span>
        </button>
      </div>

      <pre
        v-if="section.code"
        class="agent-report-body__code"
      ><code>{{ section.code }}</code></pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  attachScreenshotsToSections,
  hasAgentReportStructure,
  linkifyAgentText,
  parseAgentReportSections,
  type AgentReportScreenshot,
  type AgentReportSection,
} from '~/utils/agent-report'

export type AgentReplyScreenshot = {
  id: string
  originalName: string
  url: string
}

const props = defineProps<{
  content: string
  screenshots?: AgentReplyScreenshot[]
}>()

const emit = defineEmits<{
  previewScreenshot: [shot: { id: string; originalName: string }]
}>()

const screenshotMeta = computed<AgentReportScreenshot[]>(() => {
  return (props.screenshots ?? []).map(shot => ({
    attachmentId: shot.id,
    originalName: shot.originalName,
    url: shot.url,
  }))
})

const sections = computed<AgentReportSection[]>(() => {
  if (!props.content?.trim()) return []

  let parsed: AgentReportSection[]
  if (!hasAgentReportStructure(props.content)) {
    parsed = [{
      title: 'Report',
      paragraphs: [props.content.trim()],
      items: [],
      images: [],
    }]
  } else {
    parsed = parseAgentReportSections(props.content)
  }

  return attachScreenshotsToSections(parsed, screenshotMeta.value)
})

function linkify(text: string): string {
  return linkifyAgentText(text)
}

function previewImage(image: AgentReportScreenshot) {
  emit('previewScreenshot', {
    id: image.attachmentId,
    originalName: image.originalName,
  })
}

function hideBrokenImage(event: Event) {
  const target = event.target as HTMLImageElement | null
  if (target) target.style.display = 'none'
}
</script>

<style scoped>
.agent-report-body {
  max-width: 65ch;
  font-size: 0.875rem;
  line-height: 1.55;
}

.agent-report-body__section + .agent-report-body__section {
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid theme('colors.surface.200');
}

.agent-report-body__section:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.agent-report-body__heading {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme('colors.surface.500');
}

.agent-report-body__paragraph {
  margin: 0 0 0.55rem;
  color: theme('colors.surface.700');
}

.agent-report-body__paragraph:last-child {
  margin-bottom: 0;
}

.agent-report-body__list {
  margin: 0.15rem 0 0;
  padding-left: 1.2rem;
  list-style: disc;
}

.agent-report-body__list-item {
  margin: 0.2rem 0;
  color: theme('colors.surface.700');
}

.agent-report-body__list-item::marker {
  color: theme('colors.semantic.purple');
}

.agent-report-body__label {
  font-weight: 600;
  color: theme('colors.surface.800');
  margin-right: 0.25rem;
}

.agent-report-body__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.65rem;
  margin-top: 0.55rem;
}

.agent-report-body__image-button {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0;
  border: 1px solid theme('colors.surface.200');
  border-radius: 8px;
  background: theme('colors.surface.50');
  overflow: hidden;
  cursor: zoom-in;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.agent-report-body__image-button:hover {
  border-color: theme('colors.semantic.purple');
  box-shadow: 0 0 0 1px theme('colors.semantic.purple/20');
}

.agent-report-body__image {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
  background: theme('colors.surface.100');
}

.agent-report-body__image-caption {
  padding: 0 0.45rem 0.45rem;
  font-size: 0.6875rem;
  color: theme('colors.surface.500');
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-report-body__code {
  margin: 0.45rem 0 0;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  border: 1px solid theme('colors.surface.200');
  background: theme('colors.surface.50');
  color: theme('colors.surface.800');
  font-family: theme('fontFamily.mono');
  font-size: 0.8125rem;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-report-body :deep(a) {
  color: theme('colors.semantic.blue');
  text-decoration: underline;
  word-break: break-all;
}

.agent-report-body :deep(a:hover) {
  color: #1d4ed8;
}

:global(.dark) .agent-report-body__section + .agent-report-body__section {
  border-top-color: theme('colors.surface.700');
}

:global(.dark) .agent-report-body__heading {
  color: theme('colors.surface.400');
}

:global(.dark) .agent-report-body__paragraph,
:global(.dark) .agent-report-body__list-item {
  color: theme('colors.surface.300');
}

:global(.dark) .agent-report-body__label {
  color: theme('colors.surface.200');
}

:global(.dark) .agent-report-body__image-button {
  background: theme('colors.surface.800');
  border-color: theme('colors.surface.700');
}

:global(.dark) .agent-report-body__image {
  background: theme('colors.surface.900');
}

:global(.dark) .agent-report-body__image-caption {
  color: theme('colors.surface.400');
}

:global(.dark) .agent-report-body__code {
  background: theme('colors.surface.800');
  border-color: theme('colors.surface.700');
  color: theme('colors.surface.100');
}

:global(.dark) .agent-report-body :deep(a) {
  color: #93c5fd;
}
</style>
