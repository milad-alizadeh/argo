import type { ProjectError, ProjectErrorCode } from '@/domains/projects/contract/contract'
import { ContractError } from '@/platform/renderer/contract-error'

export class ProjectContractError extends ContractError<ProjectError> {
  declare code: ProjectErrorCode

  constructor(reply: ProjectError) {
    super(reply)
    this.name = 'ProjectContractError'
  }
}

export function throwProjectContractError(reply: ProjectError): never {
  throw new ProjectContractError(reply)
}
