import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'
import {
  ProjectOnboardingStageActions as StageActions,
  ProjectOnboardingStageContent as StageContent,
} from './project-onboarding-layout'
import { RepositoryRecommendationGroups } from './project-onboarding-repository-groups'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'

export function ProjectSetupStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.projectSetup.description')}
        title={t('onboarding.flow.projectSetup.title')}
      />
      <StageContent>
        <div className="space-y-5">
          <RepositoryRecommendationGroups
            onToggle={actions.toggleRepositoryRecommendation}
            recommendations={state.repositoryRecommendations}
          />
        </div>
      </StageContent>
      <StageActions>
        <Button onClick={actions.apply}>{t('onboarding.flow.projectSetup.apply')}</Button>
      </StageActions>
    </>
  )
}
