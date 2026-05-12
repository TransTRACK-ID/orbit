<template>
  <div
    class="min-h-screen flex items-center justify-center px-4 transition-colors duration-500"
    :class="isNeon ? 'bg-[#050508]' : 'bg-gradient-to-br from-surface-50 via-white to-primary-50/30'"
  >
    <!-- Theme Toggle -->
    <button
      type="button"
      class="fixed top-4 right-4 z-50 p-2 rounded-full transition-all duration-300"
      :class="isNeon ? 'bg-[#0a0a12] border border-[#00f3ff] text-[#00f3ff] shadow-[0_0_10px_#00f3ff]' : 'bg-white border border-surface-200 text-surface-600 shadow-sm hover:text-primary-600'"
      @click="toggleTheme"
      aria-label="Toggle theme"
    >
      <svg v-if="!isNeon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>

    <div class="w-full max-w-sm animate-scale-in">
      <!-- Logo / Brand -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-12 h-12 rounded-xl text-white text-xl font-bold mb-4 transition-all duration-500"
          :class="isNeon ? 'bg-[#b026ff] shadow-[0_0_20px_#b026ff]' : 'bg-primary-500'"
        >
          O
        </div>
        <h1
          class="text-2xl font-bold transition-colors duration-500"
          :class="isNeon ? 'text-white drop-shadow-[0_0_8px_#fff]' : 'text-surface-900'"
        >
          Welcome back
        </h1>
        <p
          class="mt-1 text-sm transition-colors duration-500"
          :class="isNeon ? 'text-[#00f3ff]' : 'text-surface-500'"
        >
          Sign in to your workspace
        </p>
      </div>

      <!-- Card -->
      <div
        class="rounded-2xl p-6 transition-all duration-500"
        :class="isNeon
          ? 'bg-[#0a0a12]/80 border border-[#00f3ff]/30 shadow-[0_0_30px_rgba(0,243,255,0.15)] backdrop-blur-sm'
          : 'bg-white border border-surface-200 shadow-sm'"
      >
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label
              class="block text-sm font-medium mb-1.5 transition-colors duration-500"
              :class="isNeon ? 'text-[#c084fc]' : 'text-surface-700'"
            >
              Email
            </label>
            <TextInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :error="errors.email"
              required
            />
          </div>

          <div>
            <label
              class="block text-sm font-medium mb-1.5 transition-colors duration-500"
              :class="isNeon ? 'text-[#c084fc]' : 'text-surface-700'"
            >
              Password
            </label>
            <TextInput
              v-model="password"
              type="password"
              placeholder="Enter your password"
              :error="errors.password"
              required
            />
          </div>

          <Button
            type="submit"
            class="w-full transition-all duration-500"
            :class="isNeon ? 'neon-button' : ''"
            :loading="loading"
          >
            Sign in
          </Button>

          <p
            v-if="authError"
            class="text-sm text-center transition-colors duration-500"
            :class="isNeon ? 'text-[#ff2a6d] drop-shadow-[0_0_6px_#ff2a6d]' : 'text-error-500'"
          >
            {{ authError }}
          </p>
        </form>

        <div
          class="mt-6 pt-4 text-center transition-colors duration-500"
          :class="isNeon ? 'border-t border-[#00f3ff]/20' : 'border-t border-surface-100'"
        >
          <p
            class="text-sm transition-colors duration-500"
            :class="isNeon ? 'text-[#8892b0]' : 'text-surface-500'"
          >
            Don't have an account?
            <NuxtLink
              to="/register"
              class="font-medium transition-colors duration-500"
              :class="isNeon ? 'text-[#00f3ff] hover:text-[#7ee8fa] hover:drop-shadow-[0_0_6px_#00f3ff]' : 'text-primary-600 hover:text-primary-700'"
            >
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

const isNeon = ref(false)

function toggleTheme() {
  isNeon.value = !isNeon.value
}

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

<style scoped>
/* Override inputs globally within this page when neon is active */
:deep(.neon-active input),
:deep(input) {
  transition: all 0.3s ease;
}

/* Neon glow for the default button override via a custom class on the wrapper */
:deep(.neon-button) {
  background: linear-gradient(90deg, #b026ff, #00f3ff) !important;
  box-shadow: 0 0 15px rgba(0, 243, 255, 0.4), 0 0 30px rgba(176, 38, 255, 0.2) !important;
  border: none !important;
  color: #050508 !important;
  font-weight: 700 !important;
}
:deep(.neon-button:hover) {
  box-shadow: 0 0 25px rgba(0, 243, 255, 0.6), 0 0 50px rgba(176, 38, 255, 0.4) !important;
  filter: brightness(1.1);
}

/* Subtle background grid pattern for neon mode */
.bg-\[\#050508\] {
  background-image:
    radial-gradient(circle at 20% 80%, rgba(176, 38, 255, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(0, 243, 255, 0.08) 0%, transparent 50%);
}
</style>
