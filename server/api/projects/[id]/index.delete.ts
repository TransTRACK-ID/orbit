import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { removeProjectDirectory } from '~/server/utils/project-templates'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  await requireProjectAccess(event, id)
  const db = getDb()

  // Fetch project to check for linked repository
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, id),
  })

  if (project?.repositoryId) {
    const repository = await db.query.repositories.findFirst({
      where: eq(schema.repositories.id, project.repositoryId),
    })
    if (repository) {
      // Clean up local directory
      try {
        await removeProjectDirectory(repository.name)
      } catch (cleanupErr) {
        console.error(`[project-delete] Failed to clean up directory for ${repository.name}:`, cleanupErr)
      }
      // Delete linked repository
      await db.delete(schema.repositories)
        .where(eq(schema.repositories.id, repository.id))
    }
  }

  await db.delete(schema.projects).where(eq(schema.projects.id, id))

  return { success: true }
})
