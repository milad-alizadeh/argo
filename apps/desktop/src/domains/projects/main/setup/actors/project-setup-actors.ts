import { fromCallback } from 'xstate'
import {
  defaultProjectSetupHarnesses,
  type SetupDocument,
} from '@/domains/projects/contract/setup'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/runtime/run-onboarding-agent'
import type { ProjectSetupEvent } from '@/domains/projects/main/setup/project-setup-machine-types'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import {
  type ProjectSetupApplicationInput,
  projectSetupApplicationActor,
} from './project-setup-application-actor'
import {
  type ProjectSetupCancellationInput,
  projectSetupCancellationActor,
} from './project-setup-cancellation-actor'
import { projectSetupFinalizationActor } from './project-setup-finalization-actor'
import {
  type ProjectSetupPlanningInput,
  projectSetupPlanningActor,
} from './project-setup-planning-actor'

export const inactiveProjectSetupActors = {
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
  actors: (projectId: string) => typeof inactiveProjectSetupActors
  harnesses: typeof defaultProjectSetupHarnesses
}

export const inactiveProjectSetupRuntime: ProjectSetupRuntime = {
  actors: () => inactiveProjectSetupActors,
  harnesses: defaultProjectSetupHarnesses,
}

export function projectSetupRuntime(services: ProjectSetupServices): ProjectSetupRuntime {
  return {
    harnesses: defaultProjectSetupHarnesses,
    actors: (projectId) => ({
      cancellation: projectSetupCancellationActor(services),
      finalization: projectSetupFinalizationActor(services, projectId),
      onboardingApplication: projectSetupApplicationActor(services, projectId),
      onboardingPlanning: projectSetupPlanningActor(services, projectId),
    }),
  }
}
