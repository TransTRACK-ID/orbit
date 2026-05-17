<template>
  <div class="min-h-screen flex bg-surface-50">
    <!-- Random GIF Side Panel -->
    <div class="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden">
      <img
        :src="randomGifUrl"
        alt="Fun login illustration"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <div class="absolute bottom-8 left-8 right-8">
        <p class="text-white/90 text-sm font-medium">"{{ randomQuote }}"</p>
      </div>
    </div>

    <!-- Login Form -->
    <div class="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center px-4">
      <div class="w-full max-w-sm animate-scale-in">
        <!-- Brand -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center gap-1.5 mb-3">
            <Icon name="lucide:orbit" class="w-5 h-5 text-accent" />
            <span class="text-sm font-bold tracking-tight text-surface-900">Orbit</span>
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
                :error-message="errors.email"
                required
              />
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Password</label>
              <TextInput
                v-model="password"
                type="password"
                placeholder="Enter your password"
                :error-message="errors.password"
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

// Curated fun developer/productivity GIFs from Giphy
const gifUrls = [
  'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif',
  'https://media.giphy.com/media/qgQUggAC3Pfv687qPC/giphy.gif',
  'https://media.giphy.com/media/L1R1tvI9ctkR8lA1o1/giphy.gif',
  'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif',
  'https://media.giphy.com/media/3o7qE1YN7a7F8g7K6Y/giphy.gif',
]

const quotes = [
  'Code is like humor. When you have to explain it, it\'s bad.',
  'First, solve the problem. Then, write the code.',
  'Make it work, make it right, make it fast.',
  'Simplicity is the soul of efficiency.',
  'The only way to do great work is to love what you do.',
]

// Use refs to avoid SSR hydration mismatch — randomize client-side only
const randomGifUrl = ref(gifUrls[0])
const randomQuote = ref(quotes[0])

// Randomize client-side after mount to avoid SSR hydration mismatch
onMounted(() => {
  randomGifUrl.value = gifUrls[Math.floor(Math.random() * gifUrls.length)]
  randomQuote.value = quotes[Math.floor(Math.random() * quotes.length)]

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
      const { needsOnboarding, ensureWorkspacesLoaded } = useOnboarding()
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
