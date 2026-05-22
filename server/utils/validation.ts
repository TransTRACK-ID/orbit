import { z } from 'zod'
import { isValidBranchName } from '~/utils/branch-validation'

// ─── Auth ───
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

// ─── Workspace ───
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
})

// ─── Project ───
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color hex').optional(),
  icon: z.string().max(50).optional(),
})

export const createProjectFromTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  templateId: z.string().min(1),
  repositoryName: z.string().min(1).max(255),
  repositoryUrl: z.string().url().optional(),
  platform: z.enum(['github', 'gitlab', 'gitlab-self-hosted']).default('github'),
  gitlabHost: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  token: z.string().optional(),
  createRemoteRepo: z.boolean().default(true),
  isPrivate: z.boolean().default(true),
  variables: z.record(z.string(), z.string()).default({}),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
})

// ─── Status ───
export const createStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export const updateStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().optional(),
})

export const reorderStatusesSchema = z.object({
  statuses: z.array(z.object({
    id: z.string().uuid(),
    position: z.number().int(),
  })),
})

// ─── Label ───
export const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// ─── Task ───
const validBranchName = z.string()
  .max(100)
  .nullable()
  .optional()
  .refine(isValidBranchName, {
    message: 'Invalid branch name. Cannot start with ., -, or /, end with / or .lock, contain .., spaces, or special characters.'
  })

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  statusId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  assigneeType: z.enum(['user', 'agent']).nullable().optional(),
  observerId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']).optional(),
  repositoryId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimate: z.number().int().positive().nullable().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  branchName: validBranchName,
  agentEnabled: z.boolean().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  assigneeType: z.enum(['user', 'agent']).nullable().optional(),
  description: z.string().nullable().optional(),
  position: z.number().optional(),
  priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']).optional(),
  repositoryId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimate: z.number().int().positive().nullable().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  branchName: validBranchName,
  agentEnabled: z.boolean().optional(),
  observerId: z.string().uuid().nullable().optional(),
})

// ─── Agent ───
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  role: z.string().min(1, 'Role is required').max(255),
  runtime: z.string().min(1).max(50),
  purpose: z.string().max(2000).optional(),
  status: z.enum(['idle', 'busy', 'offline']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color hex').optional(),
  headed: z.boolean().optional(),
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.string().min(1).max(255).optional(),
  runtime: z.string().min(1).max(50).optional(),
  purpose: z.string().max(2000).optional(),
  status: z.enum(['idle', 'busy', 'offline']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  tasks: z.number().int().min(0).optional(),
  headed: z.boolean().optional(),
})

// ─── Repository ───
export const createRepositorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().min(1, 'URL is required').max(1000),
  defaultBranch: z.string().min(1).max(255).default('main'),
  createBranch: z.boolean().default(true),
  platform: z.enum(['github', 'gitlab', 'gitlab-self-hosted']).default('github'),
  token: z.string().max(2000).optional(),
})

export const updateRepositorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().min(1).max(1000).optional(),
  defaultBranch: z.string().min(1).max(255).optional(),
  createBranch: z.boolean().optional(),
  platform: z.enum(['github', 'gitlab', 'gitlab-self-hosted']).optional(),
  token: z.string().max(2000).optional(),
})

export const checkRepositoryConnectionSchema = z.object({
  url: z.string().min(1, 'URL is required').max(1000),
  platform: z.enum(['github', 'gitlab', 'gitlab-self-hosted']),
  token: z.string().max(2000).optional(),
})

// ─── User ───
export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  email: z.string().email('Invalid email address').optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
})

// ─── Comment ───
export const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty'),
})
