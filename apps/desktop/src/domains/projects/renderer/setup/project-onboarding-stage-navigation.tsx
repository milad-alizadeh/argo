import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'
import { ProjectOnboardingStageHeader } from './project-onboarding-layout'

function BackAction({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  return (
    <Button
      aria-label={t('onboarding.back')}
      className="-ml-2 mb-3 size-9"
      onClick={controller.actions.back}
      size="icon-sm"
      variant="ghost"
    >
      <ArrowLeft />
    </Button>
  )
}

export function StageHeadingWithBack({
  controller,
  description,
  title,
}: {
  controller: OnboardingController
  description: string
  title: string
}) {
  return (
    <ProjectOnboardingStageHeader
      back={<BackAction controller={controller} />}
      description={description}
    >
      {title}
    </ProjectOnboardingStageHeader>
  )
}
