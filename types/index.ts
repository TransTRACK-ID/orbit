// ─── Auth ───
export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  role?: string | null
  onboardingCompleted?: boolean | null
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
  membership?: {
    dismissedPrompts?: string[]
  }
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
  templateId: string | null
  stack: string | null
  defaultView: 'kanban' | 'table' | 'list'
  createdAt: string
  updatedAt: string
  _count?: { tasks: number; doneTasks: number; members: number }
}

export interface TemplateConfig {
  id: string
  name: string
  description: string
  category: string
  stack: string
  sourceType: 'local_path' | 'git' | 'npx' | 'command'
  sourcePath: string
  branch?: string
  variables: Array<{
    key: string
    label: string
    required: boolean
    default?: string
    autoGenerate?: boolean
    length?: number
  }>
  fileSubstitutions: Array<{
    path: string
    replacements: Record<string, string>
  }>
  renameFiles?: Array<{ from: string; to: string }>
  postInitCommands: Array<{
    command: string
    timeout?: number
    description: string
  }>
  gitInit: boolean
  initialCommitMessage: string
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
  agentEnabled: boolean
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

// ─── Attachment ───
export interface Attachment {
  id: string
  taskId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  createdAt: string
}

export interface BrainstormAttachment {
  id: string
  brainstormId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
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
  headed?: boolean
  projectName?: string
  wsName?: string
  currentTasks?: AgentCurrentTask[]
}

export interface AgentCurrentTask {
  taskId: string
  taskTitle: string
  status: 'running' | 'completed' | 'error'
  branchName: string | null
  filesChanged: string[]
  summary: string | null
  startedAt: string
  completedAt: string | null
}

// ─── Agent Task Context ───
export interface AgentTaskContext {
  id: string
  taskId: string
  agentId: string
  projectId: string
  status: 'running' | 'completed' | 'error'
  branchName: string | null
  summary: string | null
  filesChanged: string[]
  startedAt: string
  completedAt: string | null
  updatedAt: string
}

export interface RuntimeInfo {
  name: string
  icon: string
  color: string
  desc: string
}

// ─── Pull Request ───
export interface PullRequest {
  id: string
  taskId: string
  repositoryId: string | null
  githubNumber: number
  title: string
  url: string
  status: 'open' | 'closed' | 'merged'
  draft: boolean
  reviewState: 'pending' | 'approved' | 'changes_requested' | 'commented'
  mergeableState: string | null
  headBranch: string | null
  baseBranch: string | null
  agentFixStatus: 'none' | 'pending' | 'in_progress' | 'done'
  createdAt: string
  updatedAt: string
  lastSyncedAt: string
  task?: Task
  repository?: Repository
  comments?: PrComment[]
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
  reviewState?: string | null
  resolved?: boolean
  agentFixAppliedAt?: string | null
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

// ─── Brainstorm ───
export interface Brainstorm {
  id: string
  workspaceId: string
  repositoryId: string | null
  title: string
  archived: boolean
  createdAt: string
  updatedAt: string
  repository?: Repository | null
  _prdCount?: number
}

export interface BrainstormMessage {
  id: string
  brainstormId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// ─── PRD ───
export type PrdStatus = 'draft' | 'review' | 'approved' | 'archived'

export interface Prd {
  id: string
  brainstormId: string
  workspaceId: string
  projectId: string | null
  title: string
  content: string
  status: PrdStatus
  version: number
  tasksGenerated: boolean
  createdAt: string
  updatedAt: string
  sections?: PrdSection[]
  brainstorm?: Brainstorm
}

export type PrdSectionType =
  | 'overview'
  | 'goals'
  | 'user_stories'
  | 'requirements'
  | 'technical_spec'
  | 'acceptance_criteria'
  | 'milestones'
  | 'risks'

export interface PrdSection {
  id: string
  prdId: string
  sectionType: PrdSectionType
  title: string
  content: string
  position: number
  createdAt: string
}

// ─── Generated Task (preview before commit) ───
export interface GeneratedTask {
  title: string
  description: string
  priority: TaskPriority
  estimateHours: number | null
  labels: string[]
  parentIndex: number | null
  sectionSource: PrdSectionType
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
