<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 px-4">
    <div class="w-full max-w-sm animate-scale-in">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center gap-1.5 mb-3">
          <Icon name="lucide:bolt" class="w-5 h-5 text-accent" />
          <span class="text-sm font-bold tracking-tight text-surface-900">Kanvas</span>
        </div>
        <h1 class="text-lg font-semibold text-surface-900">Create account</h1>
        <p class="text-[11px] text-surface-500 mt-1">Start organizing your projects</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-xl border border-surface-200 p-5">
        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Full name</label>
            <TextInput
              v-model="name"
              type="text"
              placeholder="John Doe"
              :error="errors.name"
              required
            />
          </div>

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
              placeholder="At least 6 characters"
              :error="errors.password"
              required
            />
          </div>

          <Button type="submit" class="w-full" :loading="loading">
            Create account
          </Button>

          <p v-if="authError" class="text-error-500 text-xs text-center">{{ authError }}</p>
        </form>

        <div class="mt-5 pt-4 border-t border-surface-100 text-center">
          <p class="text-[11px] text-surface-500">
            Already have an account?
            <NuxtLink to="/login" class="text-accent font-semibold hover:text-accent-hover transition-colors">
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
