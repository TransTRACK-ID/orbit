import bcrypt from 'bcryptjs'
import { eq, count } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'
import { registerSchema } from '~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, registerSchema.parse)

  const db = getDb()

  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, body.email.toLowerCase()),
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists',
    })
  }

  // Hash password
  const passwordHash = await bcrypt.hash(body.password, 12)

  // First user becomes super_admin automatically
  const [userCountResult] = await db.select({ value: count() }).from(schema.users)
  const isFirstUser = userCountResult.value === 0

  // Create user
  const [user] = await db
    .insert(schema.users)
    .values({
      email: body.email.toLowerCase(),
      name: body.name,
      passwordHash,
      role: isFirstUser ? 'super_admin' : 'user',
    })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
      role: schema.users.role,
    })

  return { user }
})
