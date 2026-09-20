import type { OnboardingState } from './onboarding-model'
import { ProjectOnboardingFlow } from './project-onboarding-flow'
import { useOnboardingController } from './use-onboarding-controller'
import './project-setup.css'
import './project-onboarding.css'

export { ANALYSIS_TASKS, applyTasksFor, targetsFromManualSource } from './onboarding-data'
export type {
  OnboardingApplyTask,
  OnboardingController,
  OnboardingHarness,
  OnboardingMethod,
  OnboardingPlanOutcome,
  OnboardingRecommendation,
  OnboardingStage,
  OnboardingState,
  OnboardingTarget,
} from './onboarding-model'

export type ProjectOnboardingProps = {
  initialState?: Partial<OnboardingState>
  pauseProgress?: boolean
}

export function ProjectOnboarding({ initialState, pauseProgress }: ProjectOnboardingProps) {
  const controller = useOnboardingController({ initialState, pauseProgress })
  return (
    <div
      className="onboarding-root"
      data-component="ProjectOnboarding"
      data-state={controller.state.stage}
    >
      <ProjectOnboardingFlow controller={controller} />
    </div>
  )
}
