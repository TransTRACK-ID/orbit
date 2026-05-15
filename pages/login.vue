<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 px-4">
    <div class="w-full max-w-sm animate-scale-in">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-1.5 mb-3">
          <Icon name="lucide:bolt" class="w-5 h-5 text-accent" />
          <span class="text-sm font-bold tracking-tight text-surface-900">Kanvas</span>
        </div>
        <h1 class="text-lg font-semibold text-surface-900">Welcome back</h1>
        <p class="text-[11px] text-surface-500 mt-1">Sign in to your workspace</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl border border-surface-200 p-5">
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Email</label>
            <TextInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :error="errors.email"
              required
            />
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Password</label>
            <TextInput
              v-model="password"
              type="password"
              placeholder="Enter your password"
              :error="errors.password"
              required
            />
          </div>

          <Button type="submit" class="w-full" :loading="loading">
            Sign in
          </Button>

          <p v-if="authError" class="text-error-500 text-xs text-center">{{ authError }}</p>
        </form>

        <div class="mt-5 pt-4 border-t border-surface-100 text-center">
          <p class="text-[11px] text-surface-500">
            Don't have an account?
            <NuxtLink to="/register" class="text-accent font-semibold hover:text-accent-hover transition-colors">
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
      const { needsOnboarding } = useOnboarding()
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
