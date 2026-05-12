import { requireSuperAdmin } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, count, sql, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const allProjects = await db.query.projects.findMany({
    orderBy: desc(schema.projects.createdAt),
    with: {
      workspace: true,
      members: { with: { user: true } },
    },
  })

  const projectsWithStats = await Promise.all(
    allProjects.map(async (project) => {
      const [taskCount] = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(eq(schema.tasks.projectId, project.id))

      const [doneTaskCount] = await db
        .select({ count: count() })
        .from(schema.tasks)
        .where(
          sql`${schema.tasks.projectId} = ${project.id} AND ${schema.tasks.statusId} IN (
            SELECT id FROM statuses WHERE name ILIKE '%done%' OR name ILIKE '%complete%'
          )`
        )

      const [commentCount] = await db
        .select({ count: count() })
        .from(schema.comments)
        .where(
          sql`${schema.comments.taskId} IN (
            SELECT id FROM tasks WHERE project_id = ${project.id}
          )`
        )

      const [memberCount] = await db
        .select({ count: count() })
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.projectId, project.id))

      return {
        ...project,
        taskCount: Number(taskCount.count),
        doneTaskCount: Number(doneTaskCount.count),
        commentCount: Number(commentCount.count),
        memberCount: Number(memberCount.count),
      }
    })
  )

  return projectsWithStats
})
