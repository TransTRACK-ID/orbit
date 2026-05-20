<template>
  <div>
    <!-- Loading state while auth status resolves -->
    <div v-if="status === 'loading'" class="min-h-screen flex items-center justify-center">
      <UiLoadingState />
    </div>

    <!-- Landing page for unauthenticated users -->
    <div v-else-if="status === 'unauthenticated'" class="min-h-screen bg-surface-50">
      <!-- Navigation -->
      <nav class="fixed top-0 left-0 right-0 z-50 bg-surface-50/80 backdrop-blur-sm border-b border-surface-200 reveal-nav">
        <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Icon name="lucide:orbit" class="w-5 h-5 text-accent" />
            </div>
            <span class="text-base font-bold tracking-tight text-surface-900">Orbit</span>
          </div>
          <div class="flex items-center gap-3">
            <NuxtLink
              to="/login"
              class="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors duration-150"
            >
              Log in
            </NuxtLink>
            <NuxtLink
              to="/register"
              class="text-sm font-medium px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all duration-150 hover:shadow-md active:scale-[0.98]"
            >
              Get started
            </NuxtLink>
          </div>
        </div>
      </nav>

      <!-- Hero Section -->
      <section class="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <!-- Warm ambient glow -->
        <div
          class="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-30 pointer-events-none -translate-y-1/4 translate-x-1/4"
          style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.15), transparent 70%);"
        />
        <div
          class="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none translate-y-1/4 -translate-x-1/4"
          style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.1), transparent 70%);"
        />

        <div class="max-w-7xl mx-auto px-6 relative z-10">
          <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <!-- Left: Value prop -->
            <div class="max-w-xl">
              <div
                class="reveal-hero inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/10 mb-6"
                style="--delay: 0ms;"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span class="text-xs font-medium text-accent">Now with AI agent orchestration</span>
              </div>

              <h1
                class="reveal-hero text-4xl lg:text-5xl font-bold text-surface-900 leading-tight tracking-tight mb-5"
                style="--delay: 80ms;"
              >
                Project management<br>
                <span class="text-accent">that works with you</span>
              </h1>

              <p
                class="reveal-hero text-lg text-surface-500 leading-relaxed mb-8 max-w-md"
                style="--delay: 160ms;"
              >
                Orbit blends traditional kanban tracking with AI agent orchestration. Assign tasks to intelligent agents and watch your team's productivity accelerate.
              </p>

              <div class="reveal-hero flex flex-wrap items-center gap-3" style="--delay: 240ms;">
                <NuxtLink
                  to="/register"
                  class="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-all duration-150 hover:shadow-lg hover:-translate-y-px active:scale-[0.98]"
                >
                  Get started free
                  <Icon name="lucide:arrow-right" class="w-4 h-4" />
                </NuxtLink>
                <NuxtLink
                  to="/login"
                  class="inline-flex items-center gap-2 px-6 py-3 border border-surface-200 text-surface-700 font-medium rounded-lg hover:bg-surface-100 transition-all duration-150 active:scale-[0.98]"
                >
                  See how it works
                </NuxtLink>
              </div>

              <div class="reveal-hero mt-8 flex items-center gap-6 text-xs text-surface-400" style="--delay: 320ms;">
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:check-circle" class="w-3.5 h-3.5 text-semantic-green" />
                  Free forever plan
                </div>
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:check-circle" class="w-3.5 h-3.5 text-semantic-green" />
                  No credit card required
                </div>
              </div>
            </div>

            <!-- Right: Abstract workflow visualization -->
            <div class="relative lg:pl-8">
              <div
                class="reveal-hero relative rounded-2xl border border-surface-200 shadow-lg p-6 lg:p-8"
                style="--delay: 200ms; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);"
              >
                <!-- Stylized kanban board preview -->
                <div class="flex gap-3 overflow-hidden">
                  <!-- Column 1: Backlog -->
                  <div class="reveal-kanban flex-1 min-w-0" style="--kb-delay: 300ms;">
                    <div class="flex items-center gap-2 mb-3">
                      <div class="w-2 h-2 rounded-full bg-slate-400" />
                      <span class="text-xs font-semibold text-slate-600">Backlog</span>
                      <span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">3</span>
                    </div>
                    <div class="space-y-2">
                      <div class="rounded-lg border border-slate-200 p-2.5" style="background: rgba(241, 245, 249, 0.8);">
                        <div class="h-2 rounded w-3/4 mb-1.5" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-1/2" style="background: #e2e8f0;" />
                      </div>
                      <div class="rounded-lg border border-slate-200 p-2.5" style="background: rgba(241, 245, 249, 0.8);">
                        <div class="h-2 rounded w-full mb-1.5" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-2/3" style="background: #e2e8f0;" />
                      </div>
                      <div class="rounded-lg border border-slate-200 p-2.5" style="background: rgba(241, 245, 249, 0.8);">
                        <div class="h-2 rounded w-4/5 mb-1.5" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-1/2" style="background: #e2e8f0;" />
                      </div>
                    </div>
                  </div>

                  <!-- Column 2: In Progress -->
                  <div class="reveal-kanban flex-1 min-w-0" style="--kb-delay: 420ms;">
                    <div class="flex items-center gap-2 mb-3">
                      <div class="w-2 h-2 rounded-full bg-semantic-blue" />
                      <span class="text-xs font-semibold text-slate-600">In Progress</span>
                      <span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">2</span>
                    </div>
                    <div class="space-y-2">
                      <div class="rounded-lg border border-slate-200 p-2.5 shadow-sm" style="background: #ffffff;">
                        <div class="flex items-center gap-1.5 mb-1.5">
                          <div class="w-1.5 h-1.5 rounded-full bg-semantic-purple animate-pulse" />
                          <span class="text-[9px] font-semibold text-semantic-purple uppercase">Agent</span>
                        </div>
                        <div class="h-2 rounded w-5/6 mb-1" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-3/5" style="background: #e2e8f0;" />
                      </div>
                      <div class="rounded-lg border border-slate-200 p-2.5 shadow-sm" style="background: #ffffff;">
                        <div class="h-2 rounded w-full mb-1.5" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-2/3" style="background: #e2e8f0;" />
                      </div>
                    </div>
                  </div>

                  <!-- Column 3: Done -->
                  <div class="reveal-kanban flex-1 min-w-0 hidden sm:block" style="--kb-delay: 540ms;">
                    <div class="flex items-center gap-2 mb-3">
                      <div class="w-2 h-2 rounded-full bg-semantic-green" />
                      <span class="text-xs font-semibold text-slate-600">Done</span>
                      <span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">5</span>
                    </div>
                    <div class="space-y-2">
                      <div class="rounded-lg border border-slate-200/60 p-2.5 opacity-60" style="background: rgba(241, 245, 249, 0.5);">
                        <div class="h-2 rounded w-4/5 mb-1.5" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-1/2" style="background: #e2e8f0;" />
                      </div>
                      <div class="rounded-lg border border-slate-200/60 p-2.5 opacity-60" style="background: rgba(241, 245, 249, 0.5);">
                        <div class="h-2 rounded w-3/4 mb-1.5" style="background: #cbd5e1;" />
                        <div class="h-1.5 rounded w-2/3" style="background: #e2e8f0;" />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Floating agent indicator -->
                <div
                  class="reveal-agent absolute -bottom-3 -right-3 rounded-xl border border-slate-200 shadow-lg p-3 flex items-center gap-2.5"
                  style="background: #ffffff;"
                >
                  <div class="w-8 h-8 rounded-full bg-semantic-purple/10 flex items-center justify-center">
                    <Icon name="lucide:bot" class="w-4 h-4 text-semantic-purple" />
                  </div>
                  <div>
                    <div class="text-xs font-semibold text-slate-900">Orbit Agent</div>
                    <div class="text-[10px] text-slate-400">Processing 2 tasks</div>
                  </div>
                  <div class="w-1.5 h-1.5 rounded-full bg-semantic-green animate-pulse ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Problem / Solution Section -->
      <section class="py-20 lg:py-28 bg-white border-y border-surface-200 reveal-section">
        <div class="max-w-7xl mx-auto px-6">
          <div class="max-w-2xl mx-auto text-center mb-16">
            <h2 class="reveal-item text-3xl lg:text-4xl font-bold text-surface-900 tracking-tight mb-4" style="--delay: 0ms;">
              Your work is dynamic.<br>Your tools should be too.
            </h2>
            <p class="reveal-item text-lg text-surface-500 leading-relaxed" style="--delay: 80ms;">
              Traditional project management treats tasks as static items on a board. But real work moves, shifts, and evolves. Orbit brings your tasks to life with intelligent agents that adapt to your workflow.
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div class="reveal-item text-center" style="--delay: 0ms;">
              <div class="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <Icon name="lucide:clipboard-list" class="w-6 h-6 text-surface-500" />
              </div>
              <h3 class="text-base font-semibold text-surface-900 mb-2">Static boards</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                Tasks sit idle until someone manually moves them. Status updates require constant attention.
              </p>
            </div>
            <div class="reveal-item text-center" style="--delay: 100ms;">
              <div class="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
                <Icon name="lucide:arrow-right" class="w-6 h-6 text-accent" />
              </div>
              <h3 class="text-base font-semibold text-surface-900 mb-2">Becomes</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                A living workflow where agents monitor, process, and advance tasks automatically.
              </p>
            </div>
            <div class="reveal-item text-center" style="--delay: 200ms;">
              <div class="w-12 h-12 rounded-xl bg-semantic-purple/10 flex items-center justify-center mx-auto mb-4">
                <Icon name="lucide:bot" class="w-6 h-6 text-semantic-purple" />
              </div>
              <h3 class="text-base font-semibold text-surface-900 mb-2">Agent-driven</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                AI agents handle routine processing, alerts, and handoffs so you focus on decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="py-20 lg:py-28 reveal-section">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center mb-16">
            <span class="reveal-item text-xs font-semibold text-accent uppercase tracking-wider mb-3 block" style="--delay: 0ms;">Features</span>
            <h2 class="reveal-item text-3xl lg:text-4xl font-bold text-surface-900 tracking-tight mb-4" style="--delay: 60ms;">
              Everything you need to move fast
            </h2>
            <p class="reveal-item text-lg text-surface-500 max-w-2xl mx-auto" style="--delay: 120ms;">
              From visual kanban boards to AI-powered automation, Orbit gives project managers the clarity and control they need.
            </p>
          </div>

          <!-- Asymmetric feature grid -->
          <div class="grid lg:grid-cols-12 gap-6 lg:gap-8">
            <!-- Feature 1: AI Agents -->
            <div class="reveal-item lg:col-span-7 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 0ms;">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-semantic-purple/10 flex items-center justify-center flex-shrink-0">
                  <Icon name="lucide:bot" class="w-5 h-5 text-semantic-purple" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-surface-900 mb-2">AI Agent Orchestration</h3>
                  <p class="text-sm text-surface-500 leading-relaxed mb-4">
                    Assign tasks to intelligent agents that process them automatically. Agents monitor queues, execute routines, and hand off to humans only when judgment is needed.
                  </p>
                  <div class="flex items-center gap-2 text-xs text-semantic-purple font-medium">
                    <Icon name="lucide:sparkles" class="w-3.5 h-3.5" />
                    Reduce manual status updates by 70%
                  </div>
                </div>
              </div>
            </div>

            <!-- Feature 2: Kanban -->
            <div class="reveal-item lg:col-span-5 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 80ms;">
              <div class="w-10 h-10 rounded-xl bg-semantic-blue/10 flex items-center justify-center mb-4">
                <Icon name="lucide:kanban" class="w-5 h-5 text-semantic-blue" />
              </div>
              <h3 class="text-lg font-semibold text-surface-900 mb-2">Visual Kanban Boards</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                Drag, drop, and organize with intuitive boards that show status at a glance. Custom columns, priorities, and labels adapt to your process.
              </p>
            </div>

            <!-- Feature 3: Workspaces -->
            <div class="reveal-item lg:col-span-5 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 160ms;">
              <div class="w-10 h-10 rounded-xl bg-semantic-green/10 flex items-center justify-center mb-4">
                <Icon name="lucide:building-2" class="w-5 h-5 text-semantic-green" />
              </div>
              <h3 class="text-lg font-semibold text-surface-900 mb-2">Workspace Organization</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                Manage multiple projects across dedicated workspaces. Switch contexts without losing sight of what matters.
              </p>
            </div>

            <!-- Feature 4: Collaboration -->
            <div class="reveal-item lg:col-span-7 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 240ms;">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center flex-shrink-0">
                  <Icon name="lucide:users" class="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-surface-900 mb-2">Team Collaboration</h3>
                  <p class="text-sm text-surface-500 leading-relaxed mb-4">
                    Comments, mentions, and real-time updates keep everyone aligned. Notifications that respect your focus, not interrupt it.
                  </p>
                  <div class="flex -space-x-2">
                    <div class="w-7 h-7 rounded-full bg-semantic-blue/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-semantic-blue">JD</div>
                    <div class="w-7 h-7 rounded-full bg-semantic-purple/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-semantic-purple">SK</div>
                    <div class="w-7 h-7 rounded-full bg-accent/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-accent">AL</div>
                    <div class="w-7 h-7 rounded-full bg-surface-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-surface-500">+5</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Social Proof Section -->
      <section class="py-20 lg:py-24 bg-white border-y border-surface-200 reveal-section">
        <div class="max-w-7xl mx-auto px-6">
          <div class="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span class="reveal-item text-xs font-semibold text-accent uppercase tracking-wider mb-4 block" style="--delay: 0ms;">Trusted by teams</span>
              <h2 class="reveal-item text-3xl font-bold text-surface-900 tracking-tight mb-4" style="--delay: 60ms;">
                Built for teams that ship
              </h2>
              <p class="reveal-item text-surface-500 leading-relaxed mb-8" style="--delay: 120ms;">
                From early-stage startups to established product teams, Orbit helps project managers maintain clarity without sacrificing speed.
              </p>

              <div class="grid grid-cols-3 gap-6">
                <div class="reveal-item" style="--delay: 180ms;">
                  <div class="text-2xl font-bold text-surface-900 mb-1">10k+</div>
                  <div class="text-xs text-surface-400">Tasks processed</div>
                </div>
                <div class="reveal-item" style="--delay: 260ms;">
                  <div class="text-2xl font-bold text-surface-900 mb-1">500+</div>
                  <div class="text-xs text-surface-400">Active workspaces</div>
                </div>
                <div class="reveal-item" style="--delay: 340ms;">
                  <div class="text-2xl font-bold text-surface-900 mb-1">99.9%</div>
                  <div class="text-xs text-surface-400">Uptime</div>
                </div>
              </div>
            </div>

            <div class="reveal-item bg-surface-50 rounded-2xl border border-surface-200 p-8" style="--delay: 120ms;">
              <div class="flex items-center gap-1 mb-4">
                <Icon v-for="i in 5" :key="i" name="lucide:star" class="w-4 h-4 text-amber-400 fill-amber-400" />
              </div>
              <blockquote class="text-base text-surface-700 leading-relaxed mb-6">
                "Orbit changed how our team thinks about project management. The agent integration isn't a gimmick; it actually handles our routine workflows and lets us focus on strategy."
              </blockquote>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">SM</div>
                <div>
                  <div class="text-sm font-semibold text-surface-900">Sarah Mitchell</div>
                  <div class="text-xs text-surface-400">Product Lead, TechFlow</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Final CTA Section -->
      <section class="py-20 lg:py-28 relative overflow-hidden reveal-section">
        <div
          class="absolute inset-0 opacity-40"
          style="background: radial-gradient(ellipse at 50% 100%, rgb(207 81 61 / 0.08), transparent 60%);"
        />
        <div class="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 class="reveal-item text-3xl lg:text-4xl font-bold text-surface-900 tracking-tight mb-4" style="--delay: 0ms;">
            Ready to accelerate your workflow?
          </h2>
          <p class="reveal-item text-lg text-surface-500 mb-8 max-w-xl mx-auto" style="--delay: 80ms;">
            Join teams using Orbit to blend human judgment with AI efficiency. Start free, scale as you grow.
          </p>
          <div class="reveal-item flex flex-wrap items-center justify-center gap-3" style="--delay: 160ms;">
            <NuxtLink
              to="/register"
              class="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-all duration-150 hover:shadow-lg hover:-translate-y-px active:scale-[0.98] text-base"
            >
              Get started free
              <Icon name="lucide:arrow-right" class="w-4 h-4" />
            </NuxtLink>
            <NuxtLink
              to="/login"
              class="inline-flex items-center gap-2 px-8 py-3.5 border border-surface-200 text-surface-700 font-medium rounded-lg hover:bg-surface-100 transition-all duration-150 active:scale-[0.98] text-base"
            >
              Log in to your workspace
            </NuxtLink>
          </div>
          <p class="reveal-item mt-6 text-xs text-surface-400" style="--delay: 240ms;">
            Free plan includes unlimited tasks, 3 workspaces, and 2 AI agents.
          </p>
        </div>
      </section>

      <!-- Footer -->
      <footer class="border-t border-surface-200 py-12 bg-white reveal-section">
        <div class="max-w-7xl mx-auto px-6">
          <div class="reveal-item flex flex-col md:flex-row items-center justify-between gap-6" style="--delay: 0ms;">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-accent/10 flex items-center justify-center">
                <Icon name="lucide:orbit" class="w-3.5 h-3.5 text-accent" />
              </div>
              <span class="text-sm font-bold text-surface-900">Orbit</span>
            </div>

            <div class="flex items-center gap-6 text-sm text-surface-500">
              <NuxtLink to="/login" class="hover:text-surface-900 transition-colors duration-150">Log in</NuxtLink>
              <NuxtLink to="/register" class="hover:text-surface-900 transition-colors duration-150">Sign up</NuxtLink>
            </div>

            <p class="text-xs text-surface-400">
              &copy; {{ new Date().getFullYear() }} Orbit. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: false,
  layout: 'auth',
})

const { status } = useAuth()
const { needsOnboarding, ensureWorkspacesLoaded } = useOnboarding()

// Force light mode for landing page — dark mode clashes with warm workshop aesthetic
let savedDarkMode = false

function forceLightMode() {
  if (process.client) {
    savedDarkMode = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')
  }
}

function restoreDarkMode() {
  if (process.client && savedDarkMode) {
    document.documentElement.classList.add('dark')
  }
}

// Only run auth navigation on client to avoid SSR cookie forwarding issues
if (process.client) {
  watch(status, async (newStatus) => {
    if (newStatus === 'authenticated') {
      await ensureWorkspacesLoaded()
      if (needsOnboarding.value) {
        await navigateTo('/onboarding')
      } else {
        await navigateTo('/workspaces')
      }
    }
    // Note: unauthenticated users now see the landing page instead of being redirected
  }, { immediate: true })
}

// Fallback: prevent infinite loading if auth requests fail (e.g. wrong AUTH_ORIGIN)
let timeout: ReturnType<typeof setTimeout>

onMounted(() => {
  forceLightMode()
  timeout = setTimeout(() => {
    if (status.value === 'loading') {
      console.warn('[auth] Status still loading after timeout — showing landing page')
    }
  }, 3000)

  // Initialize scroll-triggered animations
  initScrollReveals()
})

onUnmounted(() => {
  clearTimeout(timeout)
  restoreDarkMode()
})

/**
 * Initialize IntersectionObserver-based scroll reveals.
 * Hero elements reveal immediately; sections below the fold reveal on scroll.
 */
function initScrollReveals() {
  if (!process.client) return

  // Hero elements: reveal immediately with stagger
  const heroEls = document.querySelectorAll('.reveal-hero')
  heroEls.forEach((el) => {
    el.classList.add('is-visible')
  })

  // Kanban columns: reveal immediately with extra stagger
  const kanbanEls = document.querySelectorAll('.reveal-kanban')
  kanbanEls.forEach((el) => {
    el.classList.add('is-visible')
  })

  // Floating agent indicator: reveal after a beat
  const agentEl = document.querySelector('.reveal-agent')
  if (agentEl) {
    setTimeout(() => {
      agentEl.classList.add('is-visible')
    }, 600)
  }

  // Navigation: reveal immediately
  const navEl = document.querySelector('.reveal-nav')
  if (navEl) {
    navEl.classList.add('is-visible')
  }

  // Scroll-triggered sections
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          // Stop observing once revealed (one-shot)
          observer.unobserve(entry.target)
        }
      })
    },
    {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.1,
    }
  )

  const sections = document.querySelectorAll('.reveal-section')
  sections.forEach((section) => {
    observer.observe(section)
  })
}
</script>

<style scoped>
/* Animation easing tokens */
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Navigation ── */
.reveal-nav {
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 0.5s var(--ease-out-expo), transform 0.5s var(--ease-out-expo);
}
.reveal-nav.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Hero items (staggered page-load) ── */
.reveal-hero {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.8s var(--ease-out-expo), transform 0.8s var(--ease-out-expo);
  transition-delay: var(--delay, 0ms);
}
.reveal-hero.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Kanban columns ── */
.reveal-kanban {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
  transition: opacity 0.7s var(--ease-out-expo), transform 0.7s var(--ease-out-expo);
  transition-delay: var(--kb-delay, 0ms);
}
.reveal-kanban.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* ── Floating agent indicator ── */
.reveal-agent {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
  transition: opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-out-expo);
}
.reveal-agent.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* ── Scroll-revealed sections ── */
.reveal-section .reveal-item {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s var(--ease-out-expo), transform 0.7s var(--ease-out-expo);
  transition-delay: var(--delay, 0ms);
}
.reveal-section.is-visible .reveal-item {
  opacity: 1;
  transform: translateY(0);
}

/* Ensure animations respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .reveal-nav,
  .reveal-hero,
  .reveal-kanban,
  .reveal-agent,
  .reveal-section .reveal-item {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
</style>
