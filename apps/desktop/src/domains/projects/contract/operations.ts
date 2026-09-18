import { projectErrorSchema, projectOpenedSchema, projectOpenRequestSchema } from './contract'
import {
  projectCancelledSchema,
  projectListedSchema,
  projectListRequestSchema,
  projectRegisterRequestSchema,
  projectRelocateRequestSchema,
  projectSelectRequestSchema,
} from './messages'

const projectListReplySchema = projectListedSchema.or(projectCancelledSchema).or(projectErrorSchema)

// The Project IPC contract has five named operations, each on its own channel. The table is
// consumed by the client, the preload bridge and the main-process registration, so an operation
// cannot acquire a second hand-maintained channel.
export const PROJECT_OPERATIONS = {
  open: {
    name: 'project.open',
    channel: 'argo:project:open',
    request: projectOpenRequestSchema,
    reply: projectOpenedSchema.or(projectErrorSchema),
  },
  list: {
    name: 'project.list',
    channel: 'argo:project:list',
    request: projectListRequestSchema,
    reply: projectListReplySchema,
  },
  register: {
    name: 'project.register',
    channel: 'argo:project:register',
    request: projectRegisterRequestSchema,
    reply: projectListReplySchema,
  },
  relocate: {
    name: 'project.relocate',
    channel: 'argo:project:relocate',
    request: projectRelocateRequestSchema,
    reply: projectListReplySchema,
  },
  select: {
    name: 'project.select',
    channel: 'argo:project:select',
    request: projectSelectRequestSchema,
    reply: projectListedSchema.or(projectErrorSchema),
  },
} as const
