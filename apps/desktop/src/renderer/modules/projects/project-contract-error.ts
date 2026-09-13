import type { ProjectError, ProjectErrorCode } from '@/core/projects/contract'
import { ContractError } from '../../contract-error'

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
