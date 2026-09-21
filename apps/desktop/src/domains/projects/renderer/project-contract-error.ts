import type { ProjectError, ProjectErrorCode } from '@/domains/projects/contract/contract'
export class ProjectContractError extends Error {
  readonly version = 1
  readonly type = 'project.error'
  readonly requestId: string | null
  readonly code: ProjectErrorCode

  constructor(reply: ProjectError) {
    super(reply.code)
    this.name = 'ProjectContractError'
    this.requestId = reply.requestId
    this.code = reply.code
  }
}

export function throwProjectContractError(reply: ProjectError): never {
  throw new ProjectContractError(reply)
}
