import { CheckCircle2, Circle, FileJson, FolderOpen, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'
import { HarnessSelect } from './project-onboarding-harness-stage'
import { ProjectOnboardingStageHeader as StageHeading } from './project-onboarding-layout'
import { SectionCard, SectionCardHeader } from './project-onboarding-primitives'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'

export function FolderStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  return (
    <>
      <StageHeading description={t('onboarding.flow.folder.description')}>
        {t('onboarding.flow.folder.title')}
      </StageHeading>
      <button
        className="onboarding-folder-choice mt-8"
        onClick={actions.chooseFolder}
        type="button"
      >
        <span className="grid size-11 place-items-center rounded-lg bg-muted">
          <FolderOpen className="size-5" />
        </span>
        <span className="min-w-0 text-left">
          <strong className="block type-body font-medium">{t('onboarding.productName')}</strong>
          <span className="block truncate type-label text-muted-foreground">
            {state.projectPath}
          </span>
        </span>
        <span className="ml-auto type-label text-muted-foreground">
          {t('onboarding.flow.folder.choose')}
        </span>
      </button>
    </>
  )
}

export function MethodStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  const defaultHarnessLabel = state.defaultHarness === 'claude' ? 'Claude Code' : 'Codex'
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.method.description')}
        title={t('onboarding.flow.method.title')}
      />
      <div className="onboarding-method-grid mt-8">
        <SectionCard
          className="onboarding-agent-method-card"
          icon={<Sparkles />}
          subtitle={t('onboarding.flow.method.agent.subtitle')}
          title={t('onboarding.flow.method.agent.title')}
        >
          <div className="onboarding-agent-method-card__controls">
            <HarnessSelect
              label={t('onboarding.flow.harness.label')}
              onChange={actions.setHarness}
              value={state.harness}
            />
            <div className="mt-3 flex items-center gap-2">
              {state.defaultHarness ? (
                <>
                  <CheckCircle2 className="size-4 text-diff-added" />
                  <p className="type-label text-muted-foreground">
                    {t('onboarding.flow.method.defaultReady', { harness: defaultHarnessLabel })}
                  </p>
                </>
              ) : (
                <>
                  <Circle className="size-4 text-muted-foreground" />
                  <p className="type-label text-muted-foreground">
                    {t('onboarding.flow.method.defaultRequired')}
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {!state.defaultHarness ? (
                <Button
                  onClick={() => actions.configureDefaultHarness(state.harness)}
                  variant="outline"
                >
                  {t('onboarding.flow.method.useDefault', {
                    harness: state.harness === 'codex' ? 'Codex' : 'Claude Code',
                  })}
                </Button>
              ) : null}
              <Button
                disabled={!state.defaultHarness}
                onClick={() => actions.chooseMethod('agent')}
              >
                {t('onboarding.flow.method.analyze')}
              </Button>
            </div>
          </div>
        </SectionCard>
        <button
          className="onboarding-method-choice onboarding-section-card"
          onClick={() => actions.chooseMethod('manual')}
          type="button"
        >
          <SectionCardHeader
            icon={<FileJson />}
            subtitle={t('onboarding.flow.method.manual.subtitle')}
            title={t('onboarding.flow.method.manual.title')}
          />
        </button>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-dashed px-4 py-3">
        <p className="type-label text-muted-foreground">{t('onboarding.flow.method.skipNote')}</p>
        <Button onClick={actions.skipSetup} variant="ghost">
          {t('onboarding.flow.skip')}
        </Button>
      </div>
    </>
  )
}
