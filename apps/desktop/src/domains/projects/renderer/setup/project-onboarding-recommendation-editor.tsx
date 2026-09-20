import { Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { Switch } from '@/platform/renderer/components/ui/switch'
import type { OnboardingRecommendation } from './project-onboarding'
import { onboardingText, recommendationText } from './project-onboarding-copy'
import { OptionRow, SectionCard } from './project-onboarding-primitives'
import {
  RecommendationDetail,
  RecommendationIcon,
  RecommendationLink,
} from './project-onboarding-recommendation-fact'

export function RecommendationEditor({
  icon = <Wrench />,
  onToggle,
  recommendations,
  subtitle,
  title,
}: {
  icon?: ReactNode
  onToggle: (recommendationId: string) => void
  recommendations: OnboardingRecommendation[]
  subtitle: string
  title: string
}) {
  return (
    <SectionCard
      className="onboarding-recommendation-editor"
      icon={icon}
      subtitle={subtitle}
      title={title}
    >
      <div>
        {recommendations.map((recommendation) => (
          <OptionRow
            action={
              <Switch
                aria-label={onboardingText('action.acceptRecommendation', {
                  label: recommendationText(recommendation, 'label'),
                })}
                checked={recommendation.accepted}
                onCheckedChange={() => onToggle(recommendation.id)}
              />
            }
            detail={<RecommendationDetail recommendation={recommendation} />}
            icon={<RecommendationIcon recommendation={recommendation} />}
            key={recommendation.id}
            title={<RecommendationLink recommendation={recommendation} />}
          />
        ))}
      </div>
    </SectionCard>
  )
}
