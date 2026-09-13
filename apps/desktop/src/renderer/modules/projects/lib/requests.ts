// Every Project request the cockpit sends.
import type { ProjectOpenRequest } from '@/core/projects/contract'
import type {
  ProjectListRequest,
  ProjectRegisterRequest,
  ProjectRelocateRequest,
} from '@/core/projects/messages'
import { nextRequestId } from '../../../lib/requests'

export const openRequest = (projectId: string): ProjectOpenRequest => ({
  version: 1,
  type: 'project.open',
  requestId: nextRequestId(),
  projectId,
})

export const listRequest = (): ProjectListRequest => ({
  version: 1,
  type: 'project.list',
  requestId: nextRequestId(),
})

export const registerRequest = (): ProjectRegisterRequest => ({
  version: 1,
  type: 'project.register',
  requestId: nextRequestId(),
})

export const relocateRequest = (projectId: string): ProjectRelocateRequest => ({
  version: 1,
  type: 'project.relocate',
  requestId: nextRequestId(),
  projectId,
})
