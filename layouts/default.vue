<template>
  <div class="h-screen bg-surface-50 flex flex-col overflow-hidden">
    <!-- Mobile sidebar backdrop -->
    <div
      v-if="sidebarIsOpen"
      class="fixed inset-0 bg-black/25 z-30 lg:hidden"
      @click="closeSidebar"
    />

    <!-- Topbar -->
    <LayoutAppTopbar />

    <!-- Main layout: sidebar + content + agent panel -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <LayoutAppSidebar />

      <!-- Main content area -->
      <main class="flex-1 flex flex-col overflow-hidden min-w-0">
        <slot />
      </main>

      <!-- Agent Panel (right) -->
      <LayoutAgentPanel />
    </div>

    <!-- Log Panel (bottom, fixed) -->
    <LayoutLogPanel />

    <!-- Task Drawer (right, fixed) -->
    <LayoutTaskDrawer />
  </div>
</template>

<script setup lang="ts">
const { isOpen: sidebarIsOpen, close: closeSidebar } = useSidebar()

// Global keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  // Ctrl+K or Cmd+K: Toggle agent panel
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    const { toggleAgentPanel } = useAgent()
    toggleAgentPanel()
  }
  // Ctrl+L or Cmd+L: Toggle log panel
  if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
    e.preventDefault()
    const logPanel = document.querySelector('.log-panel-fixed') as HTMLElement
    if (logPanel) {
      logPanel.classList.toggle('open')
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>
