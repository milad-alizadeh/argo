import { createActor, type Snapshot } from 'xstate'
import type { inactiveProjectSetupLogic } from '@/domains/projects/main/setup/project-setup-logic'
import { projectSetupMachine } from './project-setup-machine'

export type ProjectSetupActor = ReturnType<typeof createProjectSetupActor>

export function createProjectSetupActor(
  persistedSnapshot?: Snapshot<unknown>,
  actors?: typeof inactiveProjectSetupLogic,
) {
  const machine = actors ? projectSetupMachine.provide({ actors }) : projectSetupMachine
  return createActor(machine, persistedSnapshot ? { snapshot: persistedSnapshot } : {})
}
