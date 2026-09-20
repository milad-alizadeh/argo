import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'
import { runnableTargetCount } from './project-onboarding-copy'
import {
  ProjectOnboardingStageActions as StageActions,
  ProjectOnboardingStageContent as StageContent,
  ProjectOnboardingStageHeader as StageHeading,
} from './project-onboarding-layout'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'
import { TargetSummary } from './project-onboarding-target-summary'

export function RecommendationsStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  if (state.planOutcome !== 'ready') return <PlanBoundary controller={controller} />
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.recommendations.description', {
          targets: runnableTargetCount(state.targets.length),
        })}
        title={t('onboarding.flow.recommendations.title')}
      />
      <StageContent>
        <div className="space-y-4">
          {state.targets.map((target) => (
            <TargetSummary key={target.id} target={target} />
          ))}
        </div>
      </StageContent>
      <StageActions>
        <Button onClick={actions.openCustomization} variant="outline">
          {t('onboarding.flow.customize.action')}
        </Button>
        <Button onClick={actions.openProjectSetup}>
          {t('onboarding.flow.continueToProjectSetup')}
        </Button>
      </StageActions>
    </>
  )
}

function PlanBoundary({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  if (state.planOutcome === 'needs-input')
    return (
      <>
        <StageHeading description={t('onboarding.flow.planInput.description')}>
          {t('onboarding.flow.planInput.title')}
        </StageHeading>
        <div className="mt-7 rounded-xl border bg-card p-5">
          <p className="type-body font-medium">{t('onboarding.flow.planInput.question')}</p>
          <p className="mt-1 type-label text-muted-foreground">
            {t('onboarding.flow.planInput.note')}
          </p>
          <Button className="mt-4" onClick={actions.resolvePlanInput}>
            {t('onboarding.flow.planInput.confirm')}
          </Button>
        </div>
      </>
    )
  if (state.planOutcome === 'cannot-plan')
    return (
      <>
        <StageHeading description={t('onboarding.flow.cannotPlan.description')}>
          {t('onboarding.flow.cannotPlan.title')}
        </StageHeading>
        <div className="mt-6 flex gap-2">
          <Button onClick={actions.retryAnalysis} variant="outline">
            {t('onboarding.flow.cannotPlan.analyzeAgain')}
          </Button>
          <Button onClick={() => actions.chooseMethod('manual')}>
            {t('onboarding.flow.cannotPlan.manual')}
          </Button>
        </div>
      </>
    )
  return (
    <>
      <StageHeading description={t('onboarding.flow.invalidPlan.description')}>
        {t('onboarding.flow.invalidPlan.title')}
      </StageHeading>
      <Button className="mt-6" onClick={actions.retryAnalysis}>
        {t('onboarding.flow.invalidPlan.retry')}
      </Button>
    </>
  )
}
