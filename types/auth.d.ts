import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      avatarUrl?: string | null
      role?: string | null
      onboardingCompleted?: boolean | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    avatarUrl?: string | null
    role?: string | null
    onboardingCompleted?: boolean | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    email?: string
    name?: string
    picture?: string | null
    role?: string | null
    onboardingCompleted?: boolean | null
  }
}
