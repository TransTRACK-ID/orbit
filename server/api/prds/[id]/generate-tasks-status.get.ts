import { jobStore } from './generate-tasks.post'

export default defineEventHandler(async (event) => {
  const { id: prdId } = getRouterParams(event)
  const query = getQuery(event)
  const jobId = query.jobId as string

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing jobId' })
  }

  const job = jobStore.get(jobId)

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  return {
    jobId,
    status: job.status,
    progress: job.progress,
    step: job.step,
    tasks: job.tasks,
    error: job.error,
  }
})
