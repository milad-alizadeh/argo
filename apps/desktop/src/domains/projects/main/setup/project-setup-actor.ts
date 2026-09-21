import { createActor, type Snapshot } from 'xstate'
import type { inactiveProjectSetupActors } from '@/domains/projects/main/setup/actors/project-setup-actors'
import { projectSetupMachine } from './project-setup-machine'

export type ProjectSetupActor = ReturnType<typeof createProjectSetupActor>

export function createProjectSetupActor(
  persistedSnapshot?: Snapshot<unknown>,
  actors?: typeof inactiveProjectSetupActors,
) {
  const machine = actors ? projectSetupMachine.provide({ actors }) : projectSetupMachine
  return createActor(machine, persistedSnapshot ? { snapshot: persistedSnapshot } : {})
}
