import { fromCallback } from 'xstate'
import { defaultProjectSetupHarnesses } from '@/domains/projects/contract/setup/project-setup-harness'
import type { SetupDocument } from '@/domains/projects/contract/setup/setup-document'
import type { ProjectStore } from '../../sqlite-store'
import type { OnboardingAgentDriver } from '../onboarding-agent/runtime/run-onboarding-agent'
import type { ProjectSetupEvent } from '../project-setup-machine-types'
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
import {
  type ProjectSetupRestartInput,
  projectSetupRestartActor,
} from './project-setup-restart-actor'

export const inactiveProjectSetupActors = {
  cancellation: fromCallback<ProjectSetupEvent, ProjectSetupCancellationInput, ProjectSetupEvent>(
    () => undefined,
  ),
  restart: fromCallback<ProjectSetupEvent, ProjectSetupRestartInput, ProjectSetupEvent>(
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
  archiveSession: (sessionId: string) => Promise<boolean>
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
      restart: projectSetupRestartActor(services),
      finalization: projectSetupFinalizationActor(services, projectId),
      onboardingApplication: projectSetupApplicationActor(services, projectId),
      onboardingPlanning: projectSetupPlanningActor(services, projectId),
    }),
  }
}
