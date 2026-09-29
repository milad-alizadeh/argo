import {
  type WorkspaceListContext,
  workspaceChooseProcedure,
  workspaceListProcedure,
} from './workspace-list'

export type WorkspaceApiContext = WorkspaceListContext

export function workspaceProcedures(context: WorkspaceApiContext) {
  return {
    workspaceList: workspaceListProcedure(context),
    workspaceChoose: workspaceChooseProcedure(context),
  }
}
