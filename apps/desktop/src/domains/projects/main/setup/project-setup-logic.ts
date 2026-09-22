import { fromCallback } from 'xstate'
import { defaultProjectSetupHarnesses } from '@/domains/projects/contract/project-setup-harness'
import type { SetupDocument } from '@/domains/projects/contract/setup-document'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/runtime/run-onboarding-agent'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import {
  type ProjectSetupApplicationInput,
  projectSetupApplicationLogic,
} from './project-setup-application-logic'
import {
  type ProjectSetupCancellationInput,
  projectSetupCancellationLogic,
} from './project-setup-cancellation-logic'
import { projectSetupFinalizationLogic } from './project-setup-finalization-logic'
import type { ProjectSetupEvent } from './project-setup-machine-types'
import {
  type ProjectSetupPlanningInput,
  projectSetupPlanningLogic,
} from './project-setup-planning-logic'

export const inactiveProjectSetupLogic = {
  cancellation: fromCallback<ProjectSetupEvent, ProjectSetupCancellationInput, ProjectSetupEvent>(
    () => undefined,
  ),
  finalization: fromCallback<ProjectSetupEvent, undefined, ProjectSetupEvent>(() => undefined),
  onboardingApplication: fromCallback<
    ProjectSetupEvent,
    ProjectSetupApplicationInput,
    ProjectSetupEvent
  >(() => undefined),
  onboardingPlanning: fromCallback<ProjectSetupEvent, ProjectSetupPlanningInput, ProjectSetupEvent>(
    () => undefined,
  ),
}

export type ProjectSetupServices = {
  driver: OnboardingAgentDriver
  loadSetupDocument: () => Promise<SetupDocument>
  projects: ProjectStore
}

export type ProjectSetupRuntime = {
  actors: (projectId: string) => typeof inactiveProjectSetupLogic
  harnesses: typeof defaultProjectSetupHarnesses
}

export const inactiveProjectSetupRuntime: ProjectSetupRuntime = {
  actors: () => inactiveProjectSetupLogic,
  harnesses: defaultProjectSetupHarnesses,
}

export function projectSetupRuntime(services: ProjectSetupServices): ProjectSetupRuntime {
  return {
    harnesses: defaultProjectSetupHarnesses,
    actors: (projectId) => ({
      cancellation: projectSetupCancellationLogic(services),
      finalization: projectSetupFinalizationLogic(services, projectId),
      onboardingApplication: projectSetupApplicationLogic(services, projectId),
      onboardingPlanning: projectSetupPlanningLogic(services, projectId),
    }),
  }
}
