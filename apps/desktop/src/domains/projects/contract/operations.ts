import {
  projectErrorSchema,
  projectOpenedSchema,
  projectOpenRequestSchema,
  projectSetupCommandRequestSchema,
  projectSetupRequiredSchema,
  projectSetupSnapshotRequestSchema,
  projectSetupSnapshotSchema,
} from './contract'
import {
  projectCancelledSchema,
  projectListedSchema,
  projectListRequestSchema,
  projectRegisterRequestSchema,
  projectRelocateRequestSchema,
  projectSelectRequestSchema,
} from './messages'
import {
  projectWorkspaceCreateManagedRequestSchema,
  projectWorkspaceListedSchema,
  projectWorkspaceListRequestSchema,
  projectWorkspaceSelectRequestSchema,
} from './workspace-messages'

const projectListReplySchema = projectListedSchema.or(projectCancelledSchema).or(projectErrorSchema)
const projectWorkspaceReplySchema = projectWorkspaceListedSchema.or(projectErrorSchema)

// The Project IPC contract's named operations, each on its own channel. The table is consumed by
// the client, the preload bridge and the main-process registration, so an operation cannot
// acquire a second hand-maintained channel.
export const PROJECT_OPERATIONS = {
  open: {
    name: 'project.open',
    channel: 'argo:project:open',
    request: projectOpenRequestSchema,
    reply: projectOpenedSchema.or(projectSetupRequiredSchema).or(projectErrorSchema),
  },
  setupCommand: {
    name: 'project.setup.command',
    channel: 'argo:project:setup:command',
    request: projectSetupCommandRequestSchema,
    reply: projectSetupSnapshotSchema.or(projectErrorSchema),
  },
  setupSnapshot: {
    name: 'project.setup.snapshot',
    channel: 'argo:project:setup:snapshot',
    request: projectSetupSnapshotRequestSchema,
    reply: projectSetupSnapshotSchema.or(projectErrorSchema),
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
  workspaceList: {
    name: 'project.workspace.list',
    channel: 'argo:project:workspace:list',
    request: projectWorkspaceListRequestSchema,
    reply: projectWorkspaceReplySchema,
  },
  workspaceSelect: {
    name: 'project.workspace.select',
    channel: 'argo:project:workspace:select',
    request: projectWorkspaceSelectRequestSchema,
    reply: projectWorkspaceReplySchema,
  },
  workspaceCreateManaged: {
    name: 'project.workspace.createManaged',
    channel: 'argo:project:workspace:create-managed',
    request: projectWorkspaceCreateManagedRequestSchema,
    reply: projectWorkspaceReplySchema,
  },
} as const
