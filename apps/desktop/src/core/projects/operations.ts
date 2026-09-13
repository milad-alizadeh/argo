import { projectErrorSchema, projectOpenedSchema, projectOpenRequestSchema } from './contract'
import {
  projectCancelledSchema,
  projectListedSchema,
  projectListRequestSchema,
  projectRegisterRequestSchema,
  projectRelocateRequestSchema,
} from './messages'

// The Project IPC contract has one channel and four named operations. The table is consumed by
// the client and preload bridge, so an operation cannot acquire a second hand-maintained channel.
export const PROJECT_OPERATIONS = {
  open: {
    name: 'project.open',
    channel: 'argo:project',
    request: projectOpenRequestSchema,
    reply: projectOpenedSchema.or(projectErrorSchema),
  },
  list: {
    name: 'project.list',
    channel: 'argo:project',
    request: projectListRequestSchema,
    reply: projectListedSchema.or(projectCancelledSchema).or(projectErrorSchema),
  },
  register: {
    name: 'project.register',
    channel: 'argo:project',
    request: projectRegisterRequestSchema,
    reply: projectListedSchema.or(projectCancelledSchema).or(projectErrorSchema),
  },
  relocate: {
    name: 'project.relocate',
    channel: 'argo:project',
    request: projectRelocateRequestSchema,
    reply: projectListedSchema.or(projectCancelledSchema).or(projectErrorSchema),
  },
} as const
