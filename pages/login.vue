<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-white to-primary-50/30 px-4">
    <div class="w-full max-w-sm animate-scale-in">
      <!-- Logo / Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500 text-white text-xl font-bold mb-4">
          O
        </div>
        <h1 class="text-2xl font-bold text-surface-900">Welcome back</h1>
        <p class="text-surface-500 mt-1 text-sm">Sign in to your workspace</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Email</label>
            <TextInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :error="errors.email"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Password</label>
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

          <p v-if="authError" class="text-error-500 text-sm text-center">{{ authError }}</p>
        </form>

        <div class="mt-6 pt-4 border-t border-surface-100 text-center">
          <p class="text-sm text-surface-500">
            Don't have an account?
            <NuxtLink to="/register" class="text-primary-600 font-medium hover:text-primary-700 transition-colors">
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

const { signIn, status } = useAuth()

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
      await navigateTo('/workspaces')
    }
  } catch (err: any) {
    authError.value = err?.message || 'An error occurred during sign in'
  } finally {
    loading.value = false
  }
}
</script>
