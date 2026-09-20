import { FileJson } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import { Textarea } from '@/platform/renderer/components/ui/textarea'
import {
  type OnboardingController,
  type OnboardingTarget,
  targetsFromManualSource,
} from './project-onboarding'
import { onboardingText, targetCount } from './project-onboarding-copy'
import { ProjectOnboardingStageActions as StageActions } from './project-onboarding-layout'
import { SectionCard } from './project-onboarding-primitives'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'
import { CommandFact } from './project-onboarding-target-summary'

export function ManualStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  const parsedTargets = targetsFromManualSource(state.manualSource)
  const statusId = useId()
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.manual.description')}
        title={t('onboarding.manual.title')}
      />
      <SectionCard
        className="mt-7"
        icon={<FileJson />}
        subtitle={t('onboarding.manual.cardDescription')}
        title={t('onboarding.manual.cardTitle')}
      >
        <div className="p-4">
          <Textarea
            aria-invalid={parsedTargets === null}
            aria-label={t('onboarding.manual.inputLabel')}
            aria-describedby={parsedTargets === null ? statusId : undefined}
            className="onboarding-manual-source font-mono"
            onChange={(event) => actions.setManualSource(event.target.value)}
            value={state.manualSource}
          />
        </div>
      </SectionCard>
      <StageActions
        note={
          <p
            className={`type-label ${parsedTargets ? 'text-muted-foreground' : 'text-destructive'}`}
            id={statusId}
            role="status"
          >
            {manualStatus(parsedTargets, state.manualValidated)}
          </p>
        }
      >
        <Button
          disabled={parsedTargets === null}
          onClick={actions.validateManualSource}
          variant="outline"
        >
          {t('onboarding.manual.validate')}
        </Button>
        <Button disabled={!state.manualValidated} onClick={actions.apply}>
          {t('onboarding.manual.saveAndOpen')}
        </Button>
      </StageActions>
      {state.manualValidated && state.targets.length > 0 ? (
        <div className="mt-7 space-y-3">
          {state.targets.map((target) => (
            <ManualTargetSummary key={target.id} target={target} />
          ))}
        </div>
      ) : null}
    </>
  )
}

function ManualTargetSummary({ target }: { target: OnboardingTarget }) {
  const { t } = useTranslation('projects')
  return (
    <SectionCard
      className="onboarding-target-card onboarding-manual-target-card"
      icon={<FileJson />}
      subtitle={target.path || t('onboarding.target.noPath')}
      title={target.name}
    >
      <div className="onboarding-target-card__commands">
        <CommandFact label={t('onboarding.target.startCommand')} value={target.startCommand} />
        <CommandFact label={t('onboarding.target.buildCommand')} value={target.buildCommand} />
        <CommandFact label={t('onboarding.target.testCommand')} value={target.testCommand} />
      </div>
      <p className="onboarding-manual-target-card__note">{t('onboarding.manual.targetNote')}</p>
    </SectionCard>
  )
}
function manualStatus(targets: OnboardingTarget[] | null, validated: boolean) {
  if (!targets) return onboardingText('manual.status.invalid')
  if (validated) return onboardingText('manual.status.valid')
  return onboardingText('manual.status.found', { targets: targetCount(targets.length) })
}
