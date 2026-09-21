import { createActor, type Snapshot } from 'xstate'
import { projectSetupMachine } from './project-setup-machine'

export type ProjectSetupActor = ReturnType<typeof createProjectSetupActor>

export function createProjectSetupActor(persistedSnapshot?: Snapshot<unknown>) {
  return createActor(projectSetupMachine, persistedSnapshot ? { snapshot: persistedSnapshot } : {})
}
