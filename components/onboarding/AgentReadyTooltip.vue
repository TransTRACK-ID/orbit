<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="visible"
      class="fixed z-50 w-64 p-3 rounded-xl text-white shadow-xl"
      style="background: #0f172a;"
      :style="positionStyle"
    >
      <!-- Arrow -->
      <div
        class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
        style="background: #0f172a;"
      />

      <div class="relative">
        <div class="flex items-start gap-2.5 mb-2">
          <div
            class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
            :style="{ background: agentColor }"
          >
            {{ agentName?.charAt(0) }}
          </div>
          <div>
            <p class="text-xs font-semibold leading-tight">
              {{ agentName }} is ready
            </p>
            <p class="text-[11px] leading-snug mt-0.5" style="color: #cbd5e1;">
              When you <strong class="text-white">create</strong> or <strong class="text-white">open</strong> a task,
              you can assign {{ agentName }} to handle it automatically.
            </p>
          </div>
        </div>

        <div
          class="flex items-center justify-between mt-2.5 pt-2"
          style="border-top: 1px solid rgba(148, 163, 184, 0.2);"
        >
          <span class="text-[9px]" style="color: #94a3b8;">Tip 1 of 1</span>
          <button
            class="text-[10px] font-semibold text-accent hover:text-accent-hover transition-colors px-2 py-1 rounded hover:bg-white/5"
            @click="dismiss"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const props = defineProps<{
  targetRef?: HTMLElement | null
  agentName: string
  agentColor: string
}>()

const emit = defineEmits(['dismiss'])

const visible = ref(false)

const LS_KEY = 'orbit_agent_ready_tooltip_dismissed'

const positionStyle = computed(() => {
  if (!props.targetRef) {
    return { top: '80px', left: '50%', transform: 'translateX(-50%)' }
  }

  const rect = props.targetRef.getBoundingClientRect()

  return {
    top: `${rect.bottom + 12}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translateX(-50%)',
  }
})

onMounted(() => {
  const alreadyDismissed = localStorage.getItem(LS_KEY)
  if (alreadyDismissed) return

  // Small delay to ensure targetRef has rendered and is positioned
  setTimeout(() => {
    visible.value = true
  }, 600)
})

function dismiss() {
  visible.value = false
  localStorage.setItem(LS_KEY, 'true')
  emit('dismiss')
}
</script>
