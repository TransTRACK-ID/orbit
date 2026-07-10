export function unifyAssignee(task: any) {
  if (!task) return task
  const { agentAssignee, assignee, ...rest } = task
  const unified = task.assigneeType === 'agent' && agentAssignee
    ? {
        id: agentAssignee.id,
        name: agentAssignee.name,
        initials: agentAssignee.initials,
        color: agentAssignee.color,
        repositoryRequired: agentAssignee.repositoryRequired,
        browserEnabled: agentAssignee.browserEnabled,
      }
    : task.assigneeType === 'user' ? assignee : null
  return { ...rest, assignee: unified }
}
