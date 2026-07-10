import { taskAttachmentPublicPath } from '~/server/utils/task-attachment-files'

export type AgentReplyScreenshot = {
  id: string
  originalName: string
  url: string
}

export function parseAgentReplyMessage(newValue: unknown): string {
  if (!newValue) return ''
  if (typeof newValue === 'string') return newValue
  if (typeof newValue === 'object' && newValue !== null && 'message' in newValue) {
    return String((newValue as { message: unknown }).message || '')
  }
  return ''
}

export function parseAgentReplyScreenshots(taskId: string, newValue: unknown): AgentReplyScreenshot[] {
  if (!newValue || typeof newValue !== 'object' || newValue === null) return []

  const screenshots = (newValue as { screenshots?: unknown }).screenshots
  if (!Array.isArray(screenshots)) return []

  return screenshots
    .filter((shot): shot is { id: string; originalName: string } => {
      return !!shot
        && typeof shot === 'object'
        && typeof (shot as { id?: unknown }).id === 'string'
        && typeof (shot as { originalName?: unknown }).originalName === 'string'
    })
    .map(shot => ({
      id: shot.id,
      originalName: shot.originalName,
      url: taskAttachmentPublicPath(taskId, shot.id),
    }))
}
