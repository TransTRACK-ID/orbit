<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-surface-50 relative overflow-hidden">
    <!-- Ambient warm glow -->
    <div
      class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-40 pointer-events-none dark:opacity-70"
      style="background: radial-gradient(ellipse at center, rgb(207 81 61 / 0.06), transparent 70%);"
    />

    <div class="w-full max-w-sm animate-scale-in relative z-10">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Icon name="lucide:orbit" class="w-5 h-5 text-accent" />
          </div>
          <span class="text-base font-bold tracking-tight text-surface-900">Orbit</span>
        </div>
        <h1 class="text-xl font-semibold text-surface-900">Create your account</h1>
        <p class="text-xs text-surface-500 mt-1.5">Start organizing your projects with your team</p>
      </div>

      <!-- Card -->
      <div class="bg-surface-100 rounded-xl border border-surface-200 shadow-sm p-6">
        <form @submit.prevent="handleRegister" class="space-y-5">
          <div :class="{ 'animate-shake': errors.name }">
            <label class="block text-xs font-medium text-surface-600 mb-1.5">Full name</label>
            <TextInput
              v-model="name"
              type="text"
              placeholder="Jane Smith"
              :error-message="errors.name"
              required
            />
          </div>

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
              placeholder="At least 6 characters"
              :error-message="errors.password"
              required
            />
          </div>

          <Button
            type="submit"
            class="w-full transition-all duration-150 active:scale-[0.98]"
            :loading="loading"
          >
            Create account
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

        <div class="mt-6 pt-5 border-t border-surface-100 text-center">
          <p class="text-xs text-surface-500">
            Already have an account?
            <NuxtLink to="/login" class="text-accent font-semibold hover:text-accent-hover transition-colors duration-150">
              Sign in
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

const { signIn, status } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const authError = ref('')
const errors = ref<{ name?: string; email?: string; password?: string }>({})

// Redirect if already authenticated
onMounted(() => {
  if (status.value === 'authenticated') {
    navigateTo('/workspaces')
  }
})

async function handleRegister() {
  errors.value = {}
  authError.value = ''

  if (!name.value) {
    errors.value.name = 'Name is required'
    return
  }
  if (!email.value) {
    errors.value.email = 'Email is required'
    return
  }
  if (!password.value || password.value.length < 6) {
    errors.value.password = 'Password must be at least 6 characters'
    return
  }

  loading.value = true
  try {
    const res = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value },
    })

    // Auto sign in after registration
    const result = await signIn('credentials', {
      email: email.value,
      password: password.value,
      redirect: false,
    })

    if (result?.error) {
      authError.value = 'Account created but sign in failed. Please try logging in.'
    } else {
      await navigateTo('/onboarding')
    }
  } catch (err: any) {
    if (err?.data?.message) {
      authError.value = err.data.message
    } else {
      authError.value = 'An error occurred during registration'
    }
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
