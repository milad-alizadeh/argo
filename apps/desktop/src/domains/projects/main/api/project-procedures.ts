import { projectListProcedure } from './project-list'
import { projectOpenProcedure } from './project-open'
import { type ProjectRegisterContext, projectRegisterProcedure } from './project-register'
import { type ProjectRelocateContext, projectRelocateProcedure } from './project-relocate'

export type ProjectApiContext = ProjectRegisterContext & ProjectRelocateContext

export function projectProcedures(context: ProjectApiContext) {
  return {
    projectList: projectListProcedure(context.database),
    projectOpen: projectOpenProcedure(context.database),
    projectRegister: projectRegisterProcedure(context),
    projectRelocate: projectRelocateProcedure(context),
  }
}
