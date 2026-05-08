<template>
  <div class="flex-1 overflow-y-auto py-7 px-8">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold text-surface-900 mb-8">Settings</h1>

      <!-- Profile -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Profile</h2>
        <form @submit.prevent="handleUpdateProfile" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Name</label>
            <TextInput v-model="profileForm.name" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Email</label>
            <TextInput v-model="profileForm.email" type="email" required />
          </div>
          <p v-if="profileError" class="text-sm text-error-500">{{ profileError }}</p>
          <div class="flex items-center gap-3">
            <Button type="submit" :loading="profileSaving">Save</Button>
            <TextButton v-if="profileSaved" class="text-success-500">
              <Check class="w-4 h-4" />
              Saved
            </TextButton>
          </div>
        </form>
      </div>

      <!-- Change Password -->
      <div class="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-surface-900 mb-4">Change Password</h2>
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Current Password</label>
            <TextInput v-model="passwordForm.currentPassword" type="password" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">New Password</label>
            <TextInput v-model="passwordForm.newPassword" type="password" required />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-700 mb-1.5">Confirm New Password</label>
            <TextInput v-model="passwordForm.confirmPassword" type="password" required />
          </div>
          <p v-if="passwordError" class="text-sm text-error-500">{{ passwordError }}</p>
          <div class="flex items-center gap-3">
            <Button type="submit" :loading="passwordSaving">Change Password</Button>
            <TextButton v-if="passwordSaved" class="text-success-500">
              <Check class="w-4 h-4" />
              Updated
            </TextButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const { data: session, getSession } = useAuth()
const user = computed(() => (session.value?.user as any) || {})

// Profile form
const profileForm = reactive({
  name: '',
  email: '',
})
const profileSaving = ref(false)
const profileSaved = ref(false)
const profileError = ref('')

// Password form
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const passwordSaving = ref(false)
const passwordSaved = ref(false)
const passwordError = ref('')

watch(() => session.value?.user, (userData) => {
  if (userData) {
    profileForm.name = (userData as any).name || ''
    profileForm.email = (userData as any).email || ''
  }
}, { immediate: true })

async function handleUpdateProfile() {
  profileError.value = ''
  profileSaved.value = false

  if (!profileForm.name) {
    profileError.value = 'Name is required'
    return
  }
  if (!profileForm.email) {
    profileError.value = 'Email is required'
    return
  }

  profileSaving.value = true
  try {
    const data: any = {}
    if (profileForm.name !== user.value.name) data.name = profileForm.name
    if (profileForm.email !== user.value.email) data.email = profileForm.email

    if (Object.keys(data).length === 0) {
      profileSaved.value = true
      setTimeout(() => { profileSaved.value = false }, 2000)
      return
    }

    await $fetch('/api/user', {
      method: 'PATCH',
      body: data,
    })

    // Refresh session from server to pick up changes
    await getSession()

    profileSaved.value = true
    setTimeout(() => { profileSaved.value = false }, 2000)
  } catch (err: any) {
    profileError.value = err?.data?.statusMessage || err?.message || 'Failed to update profile'
  } finally {
    profileSaving.value = false
  }
}

async function handleChangePassword() {
  passwordError.value = ''
  passwordSaved.value = false

  if (!passwordForm.currentPassword) {
    passwordError.value = 'Current password is required'
    return
  }
  if (!passwordForm.newPassword) {
    passwordError.value = 'New password is required'
    return
  }
  if (passwordForm.newPassword.length < 6) {
    passwordError.value = 'New password must be at least 6 characters'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Passwords do not match'
    return
  }

  passwordSaving.value = true
  try {
    await $fetch('/api/user/password', {
      method: 'PATCH',
      body: {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      },
    })

    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''

    passwordSaved.value = true
    setTimeout(() => { passwordSaved.value = false }, 2000)
  } catch (err: any) {
    passwordError.value = err?.data?.statusMessage || err?.message || 'Failed to change password'
  } finally {
    passwordSaving.value = false
  }
}
</script>
