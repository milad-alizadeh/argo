import { FileCog, Library, Package, Settings2, Sparkles, TerminalSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OnboardingController } from './project-onboarding'
import { onboardingText, recommendationText } from './project-onboarding-copy'
import { OptionRow, SectionCard } from './project-onboarding-primitives'
import { repositoryRecommendationGroups } from './project-onboarding-repository-groups'

export function RecommendationSummary({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  const { dependencies, projectSetup, targetTools } = buildSummary(controller)
  const manual = state.method === 'manual'
  return (
    <SectionCard
      icon={<Settings2 />}
      subtitle={
        state.stage === 'complete'
          ? t('onboarding.summary.applied')
          : t('onboarding.summary.willApply')
      }
      title={t('onboarding.summary.title')}
    >
      <OptionRow
        detail={state.targets.map(({ name }) => name).join(' · ') || t('onboarding.noneYet')}
        icon={<Package />}
        title={t('onboarding.summary.targets')}
      />
      <OptionRow
        detail={manual ? t('onboarding.none') : targetTools.join(' · ') || t('onboarding.none')}
        icon={<Sparkles />}
        title={t('onboarding.summary.targetTools')}
      />
      <OptionRow
        detail={
          manual
            ? t('onboarding.summary.noProjectFileChanges')
            : projectSetup.join(' · ') || t('onboarding.summary.noChanges')
        }
        icon={<FileCog />}
        title={t('onboarding.summary.projectSetup')}
      />
      <OptionRow
        detail={manual ? t('onboarding.none') : dependencies.join(' · ') || t('onboarding.none')}
        icon={<Library />}
        title={t('onboarding.summary.dependencies')}
      />
      <OptionRow
        detail={
          manual
            ? t('onboarding.summary.jsonStructureOnly')
            : state.targets.map(({ testCommand }) => testCommand).join(' · ')
        }
        icon={<TerminalSquare />}
        title={t('onboarding.summary.verification')}
      />
    </SectionCard>
  )
}

function buildSummary(controller: OnboardingController) {
  const { state } = controller
  const recommendations = [
    ...state.repositoryRecommendations,
    ...state.targets.flatMap((target) => target.recommendations),
  ]
  const accepted = recommendations.filter((recommendation) => recommendation.accepted)
  const targetTools = state.targets.flatMap((target) =>
    target.recommendations
      .filter((recommendation) => recommendation.accepted)
      .map((recommendation) => recommendationText(recommendation, 'label')),
  )
  const dependencies = [
    ...new Set(accepted.flatMap((recommendation) => recommendation.bundledDependencies ?? [])),
  ]
  const projectSetup = repositoryRecommendationGroups
    .map((group) => projectSetupSummary(group, state.repositoryRecommendations))
    .filter((summary): summary is string => summary !== null)
  return { dependencies, projectSetup, targetTools }
}

function projectSetupSummary(
  group: (typeof repositoryRecommendationGroups)[number],
  recommendations: OnboardingController['state']['repositoryRecommendations'],
) {
  const count = recommendations.filter(
    (recommendation) => recommendation.accepted && recommendation.group === group.id,
  ).length
  return count
    ? onboardingText(`onboarding.repositoryGroups.${group.copyKey}.summary`, { count })
    : null
}
