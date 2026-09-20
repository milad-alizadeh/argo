import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'
import { AnalyzingStage } from './project-onboarding-analysis-stage'
import { ApplyFailedStage, ApplyStage } from './project-onboarding-apply-stage'
import { CompleteStage, StartingStage } from './project-onboarding-completion-stage'
import { CustomizeStage } from './project-onboarding-customize-stage'
import { HarnessStage, NoDefaultHarnessStage } from './project-onboarding-harness-stage'
import { ManualStage } from './project-onboarding-manual-stage'
import { FolderStage, MethodStage } from './project-onboarding-method-stage'
import { ProjectSetupStage } from './project-onboarding-project-setup-stage'
import { RecommendationsStage } from './project-onboarding-recommendations-stage'

export type OnboardingPresentation = 'briefing'

export function SetupStageContent({
  controller,
  presentation,
}: {
  controller: OnboardingController
  presentation: OnboardingPresentation
}) {
  const { t } = useTranslation('projects')
  return (
    <div
      className="onboarding-stage"
      data-presentation={presentation}
      data-stage={controller.state.stage}
    >
      {stageContent(controller)}
      {shouldOfferSkip(controller) ? (
        <div className="onboarding-persistent-skip">
          <Button onClick={controller.actions.skipSetup} variant="ghost">
            {t('onboarding.flow.skip')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function shouldOfferSkip(controller: OnboardingController) {
  return controller.state.method === 'manual'
    ? controller.state.stage === 'manual'
    : ['analyzing', 'recommendations', 'customize', 'project-setup'].includes(
        controller.state.stage,
      )
}
function stageContent(controller: OnboardingController) {
  switch (controller.state.stage) {
    case 'folder':
      return <FolderStage controller={controller} />
    case 'method':
      return <MethodStage controller={controller} />
    case 'no-default':
      return <NoDefaultHarnessStage controller={controller} />
    case 'harness':
      return <HarnessStage controller={controller} />
    case 'analyzing':
      return <AnalyzingStage controller={controller} />
    case 'recommendations':
      return <RecommendationsStage controller={controller} />
    case 'customize':
      return <CustomizeStage controller={controller} />
    case 'project-setup':
      return <ProjectSetupStage controller={controller} />
    case 'manual':
      return <ManualStage controller={controller} />
    case 'applying':
      return <ApplyStage controller={controller} />
    case 'apply-failed':
      return <ApplyFailedStage controller={controller} />
    case 'starting':
      return <StartingStage controller={controller} />
    case 'complete':
      return <CompleteStage controller={controller} />
  }
}
