import { Bot, Folder, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { OnboardingController } from './project-onboarding'
import { ProjectOnboardingShell } from './project-onboarding-layout'
import { AgentTimeline, RecommendationSummary, SetupStageContent } from './project-onboarding-parts'

export function ProjectOnboardingFlow({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const conversationRef = useRef<HTMLElement>(null)
  const previousStageRef = useRef(controller.state.stage)

  useEffect(() => {
    if (previousStageRef.current === controller.state.stage) return
    previousStageRef.current = controller.state.stage
    const conversation = conversationRef.current
    if (!conversation) return
    conversation.scrollTop = 0
    const animationFrame = window.requestAnimationFrame(() => {
      conversation.querySelector<HTMLElement>('.onboarding-stage-heading')?.focus({
        preventScroll: true,
      })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [controller.state.stage])

  return (
    <ProjectOnboardingShell
      accessibleName={t('onboarding.label')}
      contentRef={conversationRef}
      event={
        <>
          <span className="onboarding-briefing__avatar">
            <Folder className="size-4" />
          </span>
          <p>
            {t(`onboarding.event.${controller.state.event}`, {
              defaultValue: controller.state.event,
            })}
          </p>
        </>
      }
      header={
        <div className="no-drag-region flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </span>
          <div>
            <p className="type-heading">{t('onboarding.agent.title')}</p>
            <p className="type-meta text-muted-foreground">{t('onboarding.agent.subtitle')}</p>
          </div>
        </div>
      }
      introduction={
        <>
          <span className="onboarding-briefing__avatar">
            <Sparkles className="size-4" />
          </span>
          <p>{t('onboarding.agent.introduction')}</p>
        </>
      }
      sidebar={<SetupReview controller={controller} />}
      sidebarDisclosureLabel={t('onboarding.review.disclosure')}
    >
      <SetupStageContent controller={controller} presentation="briefing" />
    </ProjectOnboardingShell>
  )
}

function SetupReview({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  return (
    <>
      <h2 className="type-heading">{t('onboarding.review.title')}</h2>
      <div className="mt-5">
        <RecommendationSummary controller={controller} />
      </div>
      <div className="mt-7 border-t border-border/60 pt-5">
        <AgentTimeline controller={controller} />
      </div>
    </>
  )
}
