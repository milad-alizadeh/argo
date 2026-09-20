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

export function ProjectOnboarding() {
  const controller = useOnboardingController()
  return (
    <div className="onboarding-root" data-component="ProjectOnboarding">
      <ProjectOnboardingFlow controller={controller} />
    </div>
  )
}
