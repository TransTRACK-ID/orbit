<template>
  <div class="min-h-screen bg-surface-50">
    <!-- Sidebar (fixed) -->
    <LayoutAppSidebar />

    <!-- Main wrapper (offset for fixed sidebar) -->
    <div class="ml-60 flex flex-col min-h-screen">
      <!-- Topbar (sticky) -->
      <div class="sticky top-0 z-20">
        <LayoutAppTopbar />
      </div>

      <!-- Page content -->
      <main class="flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>
