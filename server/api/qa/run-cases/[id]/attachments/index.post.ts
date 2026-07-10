import { requireProjectAccess } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { attachQaEvidenceFromPath } from '~/server/utils/qa-results'
import { eq } from 'drizzle-orm'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { ATTACHMENTS_DIR } from '~/server/utils/task-attachment-files'

export default defineEventHandler(async (event) => {
  const { id: runCaseId } = getRouterParams(event)
  const db = getDb()

  const runCase = await db.query.qaRunCases.findFirst({
    where: eq(schema.qaRunCases.id, runCaseId),
    with: { run: true },
  })
  if (!runCase || !runCase.run) {
    throw createError({ statusCode: 404, statusMessage: 'Run case not found' })
  }

  await requireProjectAccess(event, runCase.run.projectId)

  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const file = form.find((p) => p.name === 'file' && p.data)
  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'file field is required' })
  }

  const originalName = file.filename || 'evidence.png'
  const tmpDir = path.join(ATTACHMENTS_DIR, 'tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmpPath = path.join(tmpDir, `${randomUUID()}-${originalName}`)
  writeFileSync(tmpPath, file.data)

  return attachQaEvidenceFromPath({
    runCaseId,
    sourcePath: tmpPath,
    originalName,
  })
})
