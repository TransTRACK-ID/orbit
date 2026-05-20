<template>
  <div>
    <!-- Loading state while auth status resolves -->
    <div v-if="status === 'loading'" class="min-h-screen flex items-center justify-center">
      <UiLoadingState />
    </div>

    <!-- Landing page for unauthenticated users -->
    <div v-else-if="status === 'unauthenticated'" class="min-h-screen bg-surface-50">
      <!-- Scroll progress -->
      <div
        class="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-accent origin-left"
        :style="{ transform: `scaleX(${scrollProgress})`, opacity: scrollProgress > 0.02 ? 1 : 0 }"
      />

      <!-- Navigation -->
      <nav
        class="fixed top-0 left-0 right-0 z-50 bg-surface-50 border-b border-surface-200 reveal-nav transition-shadow duration-300"
        :class="{ 'shadow-sm': scrolled }"
      >
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
              Sign in
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
      <section class="relative pt-32 pb-24 lg:pt-44 lg:pb-32 overflow-hidden">
        <!-- Dramatic warm ambient glows -->
        <div
          class="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] rounded-full opacity-40 pointer-events-none"
          style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.18), transparent 65%);"
        />
        <div
          class="absolute bottom-[-15%] left-[-15%] w-[600px] h-[600px] rounded-full opacity-25 pointer-events-none"
          style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.12), transparent 65%);"
        />
        <div
          class="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full opacity-15 pointer-events-none"
          style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.08), transparent 60%);"
        />

        <!-- Floating ambient orbs -->
        <div class="absolute top-[20%] left-[8%] w-3 h-3 rounded-full bg-accent/20 animate-float pointer-events-none" />
        <div class="absolute top-[60%] left-[15%] w-2 h-2 rounded-full bg-accent/15 animate-float-slow pointer-events-none" style="animation-delay: 1s;" />
        <div class="absolute top-[30%] right-[12%] w-2.5 h-2.5 rounded-full bg-accent/10 animate-float pointer-events-none" style="animation-delay: 2s;" />
        <div class="absolute bottom-[25%] right-[20%] w-2 h-2 rounded-full bg-accent/20 animate-float-slow pointer-events-none" style="animation-delay: 0.5s;" />

        <div class="max-w-7xl mx-auto px-6 relative z-10">
          <div class="grid lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
            <!-- Left: Value prop -->
            <div class="lg:col-span-6">
              <div
                class="reveal-hero inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/10 mb-8"
                style="--delay: 0ms;"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span class="text-xs font-semibold text-accent">Now with AI agent orchestration</span>
              </div>

              <h1
                class="reveal-hero text-5xl sm:text-6xl lg:text-7xl font-black text-surface-900 leading-[0.95] tracking-tight mb-6"
                style="--delay: 80ms;"
              >
                Deliver faster.<br>
                <span class="text-accent">Decide bigger.</span>
              </h1>

              <p
                class="reveal-hero text-lg lg:text-xl text-surface-500 leading-relaxed mb-8 max-w-lg font-light"
                style="--delay: 160ms;"
              >
                The only project management tool that puts AI agents to work on your kanban board. Less busywork, more building.
              </p>

              <div class="reveal-hero flex flex-wrap items-center gap-3 mb-8" style="--delay: 240ms;">
                <NuxtLink
                  to="/register"
                  class="inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover transition-all duration-150 hover:shadow-xl hover:shadow-accent/20 hover:-translate-y-0.5 active:scale-[0.98] text-base"
                >
                  Start free
                  <Icon name="lucide:arrow-right" class="w-4 h-4" />
                </NuxtLink>
                <NuxtLink
                  to="/login"
                  class="inline-flex items-center gap-2 px-7 py-3.5 text-surface-600 font-medium hover:text-surface-900 transition-colors duration-150 active:scale-[0.98] text-base"
                >
                  Sign in
                </NuxtLink>
              </div>

              <div class="reveal-hero flex items-center gap-6 text-sm text-surface-400" style="--delay: 320ms;">
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:check-circle" class="w-4 h-4 text-semantic-green" />
                  <span class="text-surface-500">Free forever</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:check-circle" class="w-4 h-4 text-semantic-green" />
                  <span class="text-surface-500">No card required</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:check-circle" class="w-4 h-4 text-semantic-green" />
                  <span class="text-surface-500">2 AI agents included</span>
                </div>
              </div>
            </div>

            <!-- Right: Abstract workflow visualization -->
            <div class="lg:col-span-6 relative lg:pl-4">
              <div
                ref="heroVisualRef"
                class="reveal-hero hero-visual relative"
                style="--delay: 200ms;"
              >
                <div
                  class="relative rounded-2xl border border-surface-200/80 shadow-2xl p-6 lg:p-8 pb-10 lg:pb-12"
                  style="background: linear-gradient(145deg, var(--surface-50) 0%, var(--surface-100) 50%, var(--surface-200) 100%); transform: perspective(1200px) rotateY(-3deg) rotateX(1deg);"
                >
                  <!-- Stylized kanban board preview -->
                  <div class="flex gap-3 overflow-hidden">
                    <!-- Column 1: Backlog -->
                    <div class="reveal-kanban flex-1 min-w-0" style="--kb-delay: 300ms;">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="w-2 h-2 rounded-full bg-surface-400" />
                        <span class="text-xs font-semibold text-surface-600">Backlog</span>
                        <span class="text-xs font-medium text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full">3</span>
                      </div>
                      <div class="space-y-2">
                        <div class="rounded-lg border border-surface-200 p-2.5 bg-surface-50/80">
                          <div class="h-2 rounded w-3/4 mb-1.5 bg-surface-300" />
                          <div class="h-1.5 rounded w-1/2 bg-surface-200" />
                        </div>
                        <div class="rounded-lg border border-surface-200 p-2.5 bg-surface-50/80">
                          <div class="h-2 rounded w-full mb-1.5 bg-surface-300" />
                          <div class="h-1.5 rounded w-2/3 bg-surface-200" />
                        </div>
                        <div class="rounded-lg border border-surface-200 p-2.5 bg-surface-50/80">
                          <div class="h-2 rounded w-4/5 mb-1.5 bg-surface-300" />
                          <div class="h-1.5 rounded w-1/2 bg-surface-200" />
                        </div>
                      </div>
                    </div>

                    <!-- Column 2: In Progress -->
                    <div class="reveal-kanban flex-1 min-w-0" style="--kb-delay: 420ms;">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="w-2 h-2 rounded-full bg-semantic-blue" />
                        <span class="text-xs font-semibold text-surface-600">In Progress</span>
                        <span class="text-xs font-medium text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full">2</span>
                      </div>
                      <div class="space-y-2">
                        <div class="rounded-lg border border-surface-200 p-2.5 shadow-sm bg-surface-50">
                          <div class="flex items-center gap-1.5 mb-1.5">
                            <div class="w-1.5 h-1.5 rounded-full bg-semantic-purple animate-pulse" />
                            <span class="text-xs font-semibold text-semantic-purple">Agent</span>
                          </div>
                          <div class="h-2 rounded w-5/6 mb-1 bg-surface-300" />
                          <div class="h-1.5 rounded w-3/5 bg-surface-200" />
                        </div>
                        <div class="rounded-lg border border-surface-200 p-2.5 shadow-sm bg-surface-50">
                          <div class="h-2 rounded w-full mb-1.5 bg-surface-300" />
                          <div class="h-1.5 rounded w-2/3 bg-surface-200" />
                        </div>
                      </div>
                    </div>

                    <!-- Column 3: Done -->
                    <div class="reveal-kanban flex-1 min-w-0 hidden sm:block" style="--kb-delay: 540ms;">
                      <div class="flex items-center gap-2 mb-3">
                        <div class="w-2 h-2 rounded-full bg-semantic-green" />
                        <span class="text-xs font-semibold text-surface-600">Done</span>
                        <span class="text-xs font-medium text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-full">5</span>
                      </div>
                      <div class="space-y-2">
                        <div class="rounded-lg border border-surface-200/60 p-2.5 opacity-60 bg-surface-50/50">
                          <div class="h-2 rounded w-4/5 mb-1.5 bg-surface-300" />
                          <div class="h-1.5 rounded w-1/2 bg-surface-200" />
                        </div>
                        <div class="rounded-lg border border-surface-200/60 p-2.5 opacity-60 bg-surface-50/50">
                          <div class="h-2 rounded w-3/4 mb-1.5 bg-surface-300" />
                          <div class="h-1.5 rounded w-2/3 bg-surface-200" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Floating agent indicator -->
                  <div
                    class="reveal-agent absolute -bottom-4 -right-4 rounded-xl border border-surface-200/80 shadow-xl p-3.5 flex items-center gap-2.5 bg-surface-50"
                  >
                    <div class="w-9 h-9 rounded-full bg-semantic-purple/10 flex items-center justify-center">
                      <Icon name="lucide:bot" class="w-5 h-5 text-semantic-purple" />
                    </div>
                    <div>
                      <div class="text-xs font-semibold text-surface-900">Orbit Agent</div>
                      <div class="text-xs text-surface-400">Processing 2 tasks</div>
                    </div>
                    <div class="w-2 h-2 rounded-full bg-semantic-green animate-pulse ml-1" />
                  </div>
                </div>

                <!-- Decorative shadow layer behind kanban -->
                <div
                  class="absolute inset-0 rounded-2xl bg-accent/5 -z-10 translate-x-4 translate-y-4"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Problem / Solution Section -->
      <section class="py-20 lg:py-28 bg-surface-50 border-y border-surface-200 reveal-section">
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
            <span class="reveal-item text-xs font-semibold text-accent tracking-wider mb-3 block" style="--delay: 0ms;">Features</span>
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
            <div class="reveal-item reveal-from-left lg:col-span-7 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 0ms;">
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
            <div class="reveal-item reveal-from-right lg:col-span-5 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 80ms;">
              <div class="w-10 h-10 rounded-xl bg-semantic-blue/10 flex items-center justify-center mb-4">
                <Icon name="lucide:kanban" class="w-5 h-5 text-semantic-blue" />
              </div>
              <h3 class="text-lg font-semibold text-surface-900 mb-2">Visual Kanban Boards</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                Drag, drop, and organize with intuitive boards that show status at a glance. Custom columns, priorities, and labels adapt to your process.
              </p>
            </div>

            <!-- Feature 3: Workspaces -->
            <div class="reveal-item reveal-from-left lg:col-span-5 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 160ms;">
              <div class="w-10 h-10 rounded-xl bg-semantic-green/10 flex items-center justify-center mb-4">
                <Icon name="lucide:building-2" class="w-5 h-5 text-semantic-green" />
              </div>
              <h3 class="text-lg font-semibold text-surface-900 mb-2">Workspace Organization</h3>
              <p class="text-sm text-surface-500 leading-relaxed">
                Manage multiple projects across dedicated workspaces. Switch contexts without losing sight of what matters.
              </p>
            </div>

            <!-- Feature 4: Collaboration -->
            <div class="reveal-item reveal-from-right lg:col-span-7 bg-white rounded-2xl border border-surface-200 p-8 lg:p-10 hover:border-accent hover:shadow-lg hover:-translate-y-px transition-all duration-200" style="--delay: 240ms;">
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
                    <div class="w-7 h-7 rounded-full bg-semantic-blue/20 border-2 border-white flex items-center justify-center text-xs font-bold text-semantic-blue">JD</div>
                    <div class="w-7 h-7 rounded-full bg-semantic-purple/20 border-2 border-white flex items-center justify-center text-xs font-bold text-semantic-purple">SK</div>
                    <div class="w-7 h-7 rounded-full bg-accent/20 border-2 border-white flex items-center justify-center text-xs font-bold text-accent">AL</div>
                    <div class="w-7 h-7 rounded-full bg-surface-200 border-2 border-white flex items-center justify-center text-xs font-bold text-surface-500">+5</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Social Proof Section -->
      <section class="py-20 lg:py-24 bg-surface-50 border-y border-surface-200 reveal-section">
        <div class="max-w-7xl mx-auto px-6">
          <div class="grid lg:grid-cols-2 gap-12 items-center">
            <div class="reveal-from-left">
              <span class="reveal-item text-xs font-semibold text-accent tracking-wider mb-4 block" style="--delay: 0ms;">Trusted by teams</span>
              <h2 class="reveal-item text-3xl font-bold text-surface-900 tracking-tight mb-4" style="--delay: 60ms;">
                Built for teams that deliver
              </h2>
              <p class="reveal-item text-surface-500 leading-relaxed mb-8" style="--delay: 120ms;">
                From early-stage startups to established product teams, Orbit helps project managers maintain clarity without sacrificing speed.
              </p>

              <div class="reveal-item bg-accent-soft rounded-xl border border-accent/10 p-6" style="--delay: 180ms;">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Icon name="lucide:trending-down" class="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <div class="text-2xl font-bold text-surface-900">70%</div>
                    <div class="text-sm text-surface-500">fewer status meetings with agent-assisted workflows</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="reveal-item reveal-from-right bg-surface-50 rounded-2xl border border-surface-200 p-8" style="--delay: 120ms;">
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
              Sign in to your workspace
            </NuxtLink>
          </div>
          <p class="reveal-item mt-6 text-xs text-surface-400" style="--delay: 240ms;">
            Free plan includes unlimited tasks, 3 workspaces, and 2 AI agents.
          </p>
        </div>
      </section>

      <!-- Footer -->
      <footer class="border-t border-surface-200 py-12 bg-surface-50 reveal-section">
        <div class="max-w-7xl mx-auto px-6">
          <div class="reveal-item flex flex-col md:flex-row items-center justify-between gap-6" style="--delay: 0ms;">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-accent/10 flex items-center justify-center">
                <Icon name="lucide:orbit" class="w-3.5 h-3.5 text-accent" />
              </div>
              <span class="text-sm font-bold text-surface-900">Orbit</span>
            </div>

            <div class="flex items-center gap-6 text-sm text-surface-500">
              <NuxtLink to="/login" class="hover:text-surface-900 transition-colors duration-150">Sign in</NuxtLink>
              <NuxtLink to="/register" class="hover:text-surface-900 transition-colors duration-150">Get started</NuxtLink>
            </div>

            <p class="text-xs text-surface-400">
              &copy; {{ new Date().getFullYear() }} Orbit. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <!-- Back to top -->
      <button
        class="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-accent text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        :class="{ 'opacity-0 translate-y-4 pointer-events-none': !showBackToTop, 'opacity-100 translate-y-0': showBackToTop }"
        @click="scrollToTop"
        aria-label="Back to top"
      >
        <Icon name="lucide:arrow-up" class="w-5 h-5" />
      </button>
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

// ── Scroll-driven animation state ──
const scrollProgress = ref(0)
const scrolled = ref(false)
const showBackToTop = ref(false)
const heroVisualRef = ref<HTMLElement | null>(null)

function updateScrollState() {
  if (!process.client) return
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  scrollProgress.value = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
  scrolled.value = scrollTop > 20
  showBackToTop.value = scrollTop > window.innerHeight * 0.6

  // Hero parallax: translate the visual slower than scroll
  if (heroVisualRef.value && scrollTop < window.innerHeight) {
    const parallaxY = scrollTop * 0.15
    heroVisualRef.value.style.transform = `translateY(${parallaxY}px)`
  }
}

function scrollToTop() {
  if (process.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  // Scroll-driven state
  updateScrollState()
  window.addEventListener('scroll', updateScrollState, { passive: true })
})

onUnmounted(() => {
  clearTimeout(timeout)
  restoreDarkMode()
  if (process.client) {
    window.removeEventListener('scroll', updateScrollState)
  }
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

  // Scroll-triggered sections and directional elements
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

  // Also observe standalone directional reveal elements
  const directionalEls = document.querySelectorAll('.reveal-from-left, .reveal-from-right')
  directionalEls.forEach((el) => {
    if (!el.closest('.reveal-section')) {
      observer.observe(el)
    }
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

/* ── Floating ambient orbs ── */
@keyframes float {
  0%, 100% {
    transform: translateY(0px) translateX(0px);
  }
  33% {
    transform: translateY(-12px) translateX(6px);
  }
  66% {
    transform: translateY(6px) translateX(-4px);
  }
}

@keyframes float-slow {
  0%, 100% {
    transform: translateY(0px) translateX(0px);
  }
  50% {
    transform: translateY(-16px) translateX(8px);
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-slow {
  animation: float-slow 8s ease-in-out infinite;
}

/* Hero visual subtle hover lift */
.hero-visual {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Directional reveals ── */
.reveal-section .reveal-from-left {
  opacity: 0;
  transform: translateX(-40px);
  transition: opacity 0.8s var(--ease-out-expo), transform 0.8s var(--ease-out-expo);
  transition-delay: var(--delay, 0ms);
}
.reveal-section.is-visible .reveal-from-left {
  opacity: 1;
  transform: translateX(0);
}

.reveal-section .reveal-from-right {
  opacity: 0;
  transform: translateX(40px);
  transition: opacity 0.8s var(--ease-out-expo), transform 0.8s var(--ease-out-expo);
  transition-delay: var(--delay, 0ms);
}
.reveal-section.is-visible .reveal-from-right {
  opacity: 1;
  transform: translateX(0);
}

/* Standalone directional reveals (not inside reveal-section) */
.reveal-from-left {
  opacity: 0;
  transform: translateX(-40px);
  transition: opacity 0.8s var(--ease-out-expo), transform 0.8s var(--ease-out-expo);
}
.reveal-from-left.is-visible {
  opacity: 1;
  transform: translateX(0);
}

.reveal-from-right {
  opacity: 0;
  transform: translateX(40px);
  transition: opacity 0.8s var(--ease-out-expo), transform 0.8s var(--ease-out-expo);
}
.reveal-from-right.is-visible {
  opacity: 1;
  transform: translateX(0);
}

/* Ensure animations respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .reveal-nav,
  .reveal-hero,
  .reveal-kanban,
  .reveal-agent,
  .reveal-section .reveal-item,
  .reveal-section .reveal-from-left,
  .reveal-section .reveal-from-right,
  .reveal-from-left,
  .reveal-from-right,
  .animate-float,
  .animate-float-slow {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }
}
</style>
