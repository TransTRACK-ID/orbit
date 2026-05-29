import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'review', 'approved', 'archived']).optional(),
  projectId: z.string().uuid().nullable().optional(),
  sections: z.array(z.object({
    id: z.string().uuid().optional(),
    sectionType: z.string().min(1).max(50),
    title: z.string().min(1).max(255),
    content: z.string(),
    position: z.number().int().optional(),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, patchSchema.parse)
  const db = getDb()

  // Check PRD exists
  const existing = await db.query.prds.findFirst({
    where: eq(schema.prds.id, id),
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'PRD not found' })
  }

  // Update PRD fields
  const updateData: Record<string, any> = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.content !== undefined) updateData.content = body.content
  if (body.status !== undefined) updateData.status = body.status
  if (body.projectId !== undefined) updateData.projectId = body.projectId

  if (Object.keys(updateData).length > 0) {
    await db.update(schema.prds)
      .set(updateData)
      .where(eq(schema.prds.id, id))
  }

  // Update sections if provided
  if (body.sections && body.sections.length > 0) {
    // Delete existing sections and recreate
    await db.delete(schema.prdSections).where(eq(schema.prdSections.prdId, id))

    const sectionValues = body.sections.map((s, idx) => ({
      prdId: id,
      sectionType: s.sectionType,
      title: s.title,
      content: s.content,
      position: s.position !== undefined ? s.position : idx,
    }))

    await db.insert(schema.prdSections).values(sectionValues)
  }

  // Return updated PRD
  const updated = await db.query.prds.findFirst({
    where: eq(schema.prds.id, id),
    with: { sections: true },
  })

  return updated
})
