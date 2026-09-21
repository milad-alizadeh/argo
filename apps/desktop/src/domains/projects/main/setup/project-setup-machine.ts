import { assign, createActor, createMachine, type Snapshot } from 'xstate'

export const PROJECT_SETUP_MACHINE_VERSION = 1

export type ProjectSetupEvent =
  | { type: 'CHOOSE_MANUAL' }
  | { type: 'DEFER' }
  | { type: 'BACK' }
  | { type: 'SAVE_MANUAL'; source: string }
  | { type: 'RESUME_SETUP' }
  | { type: 'START_REPAIR_OR_UPGRADE' }

type ProjectSetupContext = { manualSource: string }

export const projectSetupMachine = createMachine({
  id: 'project-setup',
  initial: 'choosingMethod',
  context: { manualSource: '' } satisfies ProjectSetupContext,
  states: {
    choosingMethod: {
      on: {
        CHOOSE_MANUAL: 'manual',
        DEFER: 'deferred',
      },
    },
    manual: {
      on: {
        BACK: 'choosingMethod',
        DEFER: 'deferred',
        SAVE_MANUAL: {
          target: 'ready',
          actions: assign({ manualSource: ({ event }) => event.source }),
        },
      },
    },
    deferred: { on: { RESUME_SETUP: 'choosingMethod' } },
    ready: { on: { START_REPAIR_OR_UPGRADE: 'choosingMethod' } },
  },
})

export type ProjectSetupActor = ReturnType<typeof createProjectSetupActor>

export function createProjectSetupActor(persistedSnapshot?: Snapshot<unknown>) {
  return createActor(projectSetupMachine, persistedSnapshot ? { snapshot: persistedSnapshot } : {})
}

export function setupScreenOf(actor: ProjectSetupActor) {
  switch (actor.getSnapshot().value) {
    case 'choosingMethod':
      return 'choosing-method' as const
    case 'manual':
    case 'deferred':
    case 'ready':
      return actor.getSnapshot().value
    default:
      throw new Error('ProjectSetup reached an unsupported state.')
  }
}
