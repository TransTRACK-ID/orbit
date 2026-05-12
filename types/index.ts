// ─── Auth ───
export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
}

// ─── Workspace ───
export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
  _count?: { members: number; projects: number }
  repositories?: Repository[]
}

export interface Repository {
  id: string
  workspaceId: string
  name: string
  url: string
  defaultBranch: string
  createBranch: boolean
  platform: 'github' | 'gitlab' | 'gitlab-self-hosted'
  token: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
  user?: AuthUser
}

// ─── Project ───
export interface Project {
  id: string
  workspaceId: string
  name: string
  description: string | null
  color: string
  icon: string | null
  createdAt: string
  updatedAt: string
  _count?: { tasks: number; doneTasks: number; members: number }
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
  user?: AuthUser
}

// ─── Status ───
export interface Status {
  id: string
  projectId: string
  name: string
  position: number
  color: string
  isDefault: boolean
  createdAt: string
  _count?: { tasks: number }
}

// ─── Label ───
export interface Label {
  id: string
  projectId: string
  name: string
  color: string
  createdAt: string
}

// ─── Task ───
export type TaskPriority = 'none' | 'urgent' | 'high' | 'medium' | 'low'

export interface Task {
  id: string
  projectId: string
  statusId: string
  assigneeId: string | null
  assigneeType: 'user' | 'agent' | null
  observerId: string | null
  reporterId: string
  title: string
  description: string | null
  position: number
  priority: TaskPriority
  repositoryId: string | null
  parentTaskId: string | null
  dueDate: string | null
  estimate: number | null
  branchName: string | null
  createdAt: string
  updatedAt: string
  assignee?: TaskAssignee | null
  observer?: AuthUser | null
  reporter?: AuthUser
  status?: Status
  labels?: Label[]
  subtasks?: Task[]
  _count?: { comments: number; subtasks: number }
}

export interface TaskAssignee {
  id: string
  name: string
  initials?: string
  color?: string
  avatarUrl?: string | null
}

// ─── Comment ───
export interface Comment {
  id: string
  taskId: string
  userId: string
  body: string
  createdAt: string
  updatedAt: string
  user?: AuthUser
}

// ─── Activity Log ───
export interface ActivityLog {
  id: string
  taskId: string
  userId: string
  action: string
  oldValue: any
  newValue: any
  createdAt: string
  user?: AuthUser
}

// ─── Kanban ───
export interface KanbanColumn {
  status: Status
  tasks: Task[]
}

// ─── Agent ───
export type AgentStatus = 'idle' | 'busy' | 'offline'

export interface Agent {
  id: string
  name: string
  initials: string
  role: string
  color: string
  status: AgentStatus
  runtime: string
  purpose: string
  tasks: number
  projectName?: string
  wsName?: string
}

export interface RuntimeInfo {
  name: string
  icon: string
  color: string
  desc: string
}

// ─── PR Comment (from GitHub) ───
export interface PrComment {
  id: number
  author: string
  body: string
  path: string | null
  line: number | null
  createdAt: string
  isReview: boolean
}

// ─── Activity Log Entry (local) ───
export interface ActivityLogEntry {
  time: number
  agent: string
  msg: string
  taskId?: string
}

// ─── Activity Feed (persisted) ───
export interface ActivityFeedItem {
  id: string
  workspaceId: string
  userId: string
  entityType: string
  entityId: string | null
  entityName: string | null
  action: string
  message: string
  oldValue: any
  newValue: any
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    avatarUrl?: string | null
  }
}

// ─── Queue Item (unassigned tasks) ───
export interface QueueItem {
  id: string
  title: string
  type: string
  priority: string
}

// ─── API Response ───
export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
