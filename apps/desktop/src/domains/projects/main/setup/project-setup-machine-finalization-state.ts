import { assign, type MachineConfig } from 'xstate'
import type { ProjectSetupContext, ProjectSetupEvent } from './project-setup-machine-types'

type ProjectSetupStates = NonNullable<
  MachineConfig<ProjectSetupContext, ProjectSetupEvent>['states']
>

export const projectSetupFinalizationState = {
  finalizing: {
    on: {
      FINALIZATION_COMPLETED: {
        target: 'ready',
        actions: assign({ pendingFinalization: false }),
      },
      FINALIZATION_FAILED: {
        target: 'reviewingDiff',
        actions: assign({
          pendingFinalization: false,
          recoveryMessage: ({ event }) => event.reason,
        }),
      },
    },
  },
} satisfies ProjectSetupStates
