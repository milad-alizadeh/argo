import {
  projectErrorSchema,
  projectOpenedSchema,
  projectOpenRequestSchema,
  projectSetupBeginRequestSchema,
  projectSetupCancelledSchema,
  projectSetupCancelRequestSchema,
  projectSetupEditingSchema,
  projectSetupRequiredSchema,
  projectSetupSaveRequestSchema,
  projectSetupValidatedSchema,
  projectSetupValidateRequestSchema,
} from '@/domains/projects/contract/contract'
import {
  projectCancelledSchema,
  projectListedSchema,
  projectListRequestSchema,
  projectRegisterRequestSchema,
  projectRelocateRequestSchema,
  projectSelectRequestSchema,
} from '@/domains/projects/contract/messages'

const projectListReplySchema = projectListedSchema.or(projectCancelledSchema).or(projectErrorSchema)

// The Project IPC contract has five named operations, each on its own channel. The table is
// consumed by the client, the preload bridge and the main-process registration, so an operation
// cannot acquire a second hand-maintained channel.
export const PROJECT_OPERATIONS = {
  open: {
    name: 'project.open',
    channel: 'argo:project:open',
    request: projectOpenRequestSchema,
    reply: projectOpenedSchema.or(projectSetupRequiredSchema).or(projectErrorSchema),
  },
  setupBegin: {
    name: 'project.setup.begin',
    channel: 'argo:project:setup:begin',
    request: projectSetupBeginRequestSchema,
    reply: projectSetupEditingSchema.or(projectErrorSchema),
  },
  setupSave: {
    name: 'project.setup.save',
    channel: 'argo:project:setup:save',
    request: projectSetupSaveRequestSchema,
    reply: projectSetupEditingSchema.or(projectErrorSchema),
  },
  setupValidate: {
    name: 'project.setup.validate',
    channel: 'argo:project:setup:validate',
    request: projectSetupValidateRequestSchema,
    reply: projectSetupValidatedSchema.or(projectErrorSchema),
  },
  setupCancel: {
    name: 'project.setup.cancel',
    channel: 'argo:project:setup:cancel',
    request: projectSetupCancelRequestSchema,
    reply: projectSetupCancelledSchema.or(projectErrorSchema),
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
