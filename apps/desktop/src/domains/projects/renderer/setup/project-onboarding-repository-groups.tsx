import { FileCog, Library, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OnboardingRecommendation } from './project-onboarding'
import { RecommendationEditor } from './project-onboarding-recommendation-editor'

export const repositoryRecommendationGroups = [
  {
    id: 'project-files',
    icon: <FileCog />,
    copyKey: 'projectFiles',
  },
  {
    id: 'agent-skills',
    icon: <Library />,
    copyKey: 'agentSkills',
  },
  {
    id: 'harness-settings',
    icon: <Settings2 />,
    copyKey: 'harnessSettings',
  },
] as const

export function RepositoryRecommendationGroups({
  onToggle,
  recommendations,
}: {
  onToggle: (recommendationId: string) => void
  recommendations: OnboardingRecommendation[]
}) {
  const { t } = useTranslation('projects')
  return repositoryRecommendationGroups.map((group) => (
    <RecommendationEditor
      icon={group.icon}
      key={group.id}
      onToggle={onToggle}
      recommendations={recommendations.filter(
        (recommendation) => recommendation.group === group.id,
      )}
      subtitle={t(`onboarding.repositoryGroups.${group.copyKey}.subtitle`)}
      title={t(`onboarding.repositoryGroups.${group.copyKey}.title`)}
    />
  ))
}
