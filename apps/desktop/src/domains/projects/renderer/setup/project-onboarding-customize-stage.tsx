import { Package, Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import { Input } from '@/platform/renderer/components/ui/input'
import type { OnboardingController, OnboardingTarget } from './project-onboarding'
import {
  ProjectOnboardingStageActions as StageActions,
  ProjectOnboardingStageContent as StageContent,
} from './project-onboarding-layout'
import { SectionCard } from './project-onboarding-primitives'
import { RecommendationEditor } from './project-onboarding-recommendation-editor'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'

export function CustomizeStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.customize.description')}
        title={t('onboarding.flow.customize.title')}
      />
      <StageContent>
        <div className="space-y-5">
          {state.targets.map((target) => (
            <TargetEditor controller={controller} key={target.id} target={target} />
          ))}
          <Button onClick={actions.addTarget} variant="outline">
            <Plus />
            {t('onboarding.flow.customize.addTarget')}
          </Button>
        </div>
      </StageContent>
      <StageActions>
        <Button onClick={actions.openProjectSetup}>
          {t('onboarding.flow.continueToProjectSetup')}
        </Button>
      </StageActions>
    </>
  )
}

function TargetEditor({
  controller,
  target,
}: {
  controller: OnboardingController
  target: OnboardingTarget
}) {
  const { t } = useTranslation('projects')
  const { actions } = controller
  return (
    <SectionCard
      action={
        <Button
          aria-label={t('onboarding.target.remove', { target: target.name })}
          onClick={() => actions.removeTarget(target.id)}
          size="icon-xs"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      }
      className="onboarding-setting-section"
      icon={<Package />}
      subtitle={target.path}
      title={target.name}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <TargetField
          label={t('onboarding.target.name')}
          onChange={(name) => actions.updateTarget(target.id, { name })}
          value={target.name}
        />
        <TargetField
          label={t('onboarding.target.path')}
          onChange={(path) => actions.updateTarget(target.id, { path })}
          value={target.path}
        />
      </div>
      <div className="grid gap-4 border-t border-border/70 p-5 sm:grid-cols-3">
        <h3 className="type-heading sm:col-span-3">{t('onboarding.target.commands')}</h3>
        <TargetField
          label={t('onboarding.target.startCommand')}
          mono
          onChange={(startCommand) => actions.updateTarget(target.id, { startCommand })}
          value={target.startCommand}
        />
        <TargetField
          label={t('onboarding.target.buildCommand')}
          mono
          onChange={(buildCommand) => actions.updateTarget(target.id, { buildCommand })}
          value={target.buildCommand}
        />
        <TargetField
          label={t('onboarding.target.testCommand')}
          mono
          onChange={(testCommand) => actions.updateTarget(target.id, { testCommand })}
          value={target.testCommand}
        />
      </div>
      {target.recommendations.length ? (
        <RecommendationEditor
          onToggle={(recommendationId) =>
            actions.toggleTargetRecommendation(target.id, recommendationId)
          }
          recommendations={target.recommendations}
          subtitle={t('onboarding.target.suggestedToolsDescription')}
          title={t('onboarding.target.suggestedTools')}
        />
      ) : null}
    </SectionCard>
  )
}

function TargetField({
  label,
  mono = false,
  onChange,
  value,
}: {
  label: string
  mono?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const inputId = useId()
  return (
    <div className="space-y-1.5 type-body font-medium">
      <label className="block" htmlFor={inputId}>
        {label}
      </label>
      <Input
        className={mono ? 'font-mono' : undefined}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  )
}
