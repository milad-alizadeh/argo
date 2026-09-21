import { assign, type MachineConfig } from 'xstate'
import type { ProjectSetupContext, ProjectSetupEvent } from './project-setup-machine-types'

type ProjectSetupStates = NonNullable<
  MachineConfig<ProjectSetupContext, ProjectSetupEvent>['states']
>

export const projectSetupTerminalStates = {
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
} satisfies ProjectSetupStates
