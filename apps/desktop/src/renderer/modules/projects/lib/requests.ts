// Every request the cockpit sends. The identifier is minted here and nowhere else, so a reply that
// answers a different request is caught by the client rather than by a component.
import type { ProjectOpenRequest } from '@/core/projects/contract'
import {
  PROJECT_IMPORT_ACTION,
  type ProjectImportRequest,
  type ProjectListRequest,
  type ProjectRegisterRequest,
  type ProjectRelocateRequest,
} from '@/core/projects/messages'

const nextId = (): string => `request-${crypto.randomUUID()}`

export const openRequest = (projectId: string): ProjectOpenRequest => ({
  version: 1,
  type: 'project.open',
  requestId: nextId(),
  projectId,
})

export const listRequest = (): ProjectListRequest => ({
  version: 1,
  type: 'project.list',
  requestId: nextId(),
})

export const registerRequest = (): ProjectRegisterRequest => ({
  version: 1,
  type: 'project.register',
  requestId: nextId(),
})

export const relocateRequest = (projectId: string): ProjectRelocateRequest => ({
  version: 1,
  type: 'project.relocate',
  requestId: nextId(),
  projectId,
})

export const importRequest = (): ProjectImportRequest => ({
  version: 1,
  type: PROJECT_IMPORT_ACTION,
  requestId: nextId(),
})
