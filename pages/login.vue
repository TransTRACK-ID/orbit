<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-surface-50 relative overflow-hidden">
    <!-- Ambient warm glow -->
    <div
      class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-40 pointer-events-none"
      :style="`background: radial-gradient(ellipse at center, rgb(207 81 61 / ${isDark ? '0.10' : '0.06'}), transparent 70%);`"
    />

    <!-- Dark mode toggle -->
    <button
      type="button"
      class="absolute top-4 right-4 p-2 rounded-lg bg-white/80 dark:bg-surface-200/80 border border-surface-200 dark:border-surface-300 text-surface-600 dark:text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-300 transition-colors z-20"
      @click="toggle"
      aria-label="Toggle dark mode"
    >
      <Icon :name="isDark ? 'lucide:sun' : 'lucide:moon'" class="w-4 h-4" />
    </button>

    <div class="w-full max-w-sm animate-scale-in relative z-10">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Icon name="lucide:orbit" class="w-5 h-5 text-accent" />
          </div>
          <span class="text-base font-bold tracking-tight text-surface-900">Orbit</span>
        </div>
        <h1 class="text-xl font-semibold text-surface-900">Welcome back</h1>
        <p class="text-xs text-surface-500 mt-1.5">Sign in to your workspace</p>
      </div>

      <!-- Card -->
      <div class="bg-surface-50 dark:bg-surface-100 rounded-xl border border-surface-200 dark:border-surface-300 shadow-sm p-6">
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div :class="{ 'animate-shake': errors.email }">
            <label class="block text-xs font-medium text-surface-600 mb-1.5">Email</label>
            <TextInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :error-message="errors.email"
              required
            />
          </div>

          <div :class="{ 'animate-shake': errors.password }">
            <label class="block text-xs font-medium text-surface-600 mb-1.5">Password</label>
            <TextInput
              v-model="password"
              type="password"
              placeholder="Enter your password"
              :error-message="errors.password"
              required
            />
          </div>

          <Button
            type="submit"
            class="w-full transition-all duration-150 active:scale-[0.98]"
            :loading="loading"
          >
            Sign in
          </Button>

          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="authError"
              class="flex items-start gap-2 p-2.5 rounded-lg bg-error-50 border border-error-100"
            >
              <Icon name="lucide:alert-circle" class="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />
              <p class="text-xs text-error-600">{{ authError }}</p>
            </div>
          </Transition>
        </form>

        <div class="mt-6 pt-5 border-t border-surface-100 dark:border-surface-300 text-center">
          <p class="text-xs text-surface-500">
            Don't have an account?
            <NuxtLink to="/register" class="text-accent font-semibold hover:text-accent-hover transition-colors duration-150">
              Create one
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  auth: false,
})

const { signIn, status, getSession } = useAuth()
const { needsOnboarding, ensureWorkspacesLoaded } = useOnboarding()
const { isDark, toggle } = useDarkMode()

const email = ref('')
const password = ref('')
const loading = ref(false)
const authError = ref('')
const errors = ref<{ email?: string; password?: string }>({})

// Redirect if already authenticated
onMounted(() => {
  if (status.value === 'authenticated') {
    navigateTo('/workspaces')
  }
})

async function handleLogin() {
  errors.value = {}
  authError.value = ''

  if (!email.value) {
    errors.value.email = 'Email is required'
    return
  }
  if (!password.value) {
    errors.value.password = 'Password is required'
    return
  }

  loading.value = true
  try {
    const result = await signIn('credentials', {
      email: email.value,
      password: password.value,
      redirect: false,
    })

    if (result?.error) {
      authError.value = 'Invalid email or password'
    } else {
      await getSession({ force: true })
      await ensureWorkspacesLoaded()
      if (needsOnboarding.value) {
        await navigateTo('/onboarding')
      } else {
        await navigateTo('/workspaces')
      }
    }
  } catch (err: any) {
    authError.value = err?.message || 'An error occurred during sign in'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Ensure animations respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-shake {
    animation: none !important;
  }
}
</style>
