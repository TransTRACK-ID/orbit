export interface AdminStats {
  users: number
  workspaces: number
  projects: number
  tasks: number
  comments: number
  activities: number
  recentUsers: number
  recentTasks: number
}

export interface AdminUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
  createdAt: string
  updatedAt: string
  workspaceCount: number
  tasksCreated: number
  tasksAssigned: number
  commentsCount: number
  activitiesCount: number
  loginCount: number
}

export interface AdminProject {
  id: string
  workspaceId: string
  name: string
  description: string | null
  color: string
  icon: string | null
  createdAt: string
  updatedAt: string
  workspace: { id: string; name: string; slug: string }
  members: any[]
  taskCount: number
  doneTaskCount: number
  commentCount: number
  memberCount: number
}
