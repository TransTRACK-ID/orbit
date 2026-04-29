import { NuxtAuthHandler } from '#auth'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb, schema } from '~/server/database'

// Inline credentials provider to avoid CJS/ESM interop issues
function CredentialsProvider(options: {
  name: string
  credentials: Record<string, { label: string; type: string }>
  authorize: (credentials: Record<string, string> | undefined) => Promise<any>
}) {
  return {
    id: 'credentials',
    name: options.name || 'Credentials',
    type: 'credentials',
    credentials: options.credentials,
    authorize: options.authorize,
    options,
  }
}

export default NuxtAuthHandler({
  secret: process.env.NUXT_AUTH_SECRET || 'super-secret-key-change-in-production',
  pages: {
    signIn: '/login',
  },
  providers: [
    // @ts-expect-error - NuxtAuthHandler types
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, string> | undefined) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const db = getDb()
        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, credentials.email.toLowerCase()),
        })

        if (!user) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.avatarUrl || null
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
        session.user.avatarUrl = token.picture || null
      }
      return session
    },
  },
})
