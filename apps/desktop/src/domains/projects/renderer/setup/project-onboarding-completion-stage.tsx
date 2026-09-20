import { CheckCircle2, FileJson, FolderOpen, GitBranch, Package, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FileDiffList } from '@/platform/renderer/components/file-diff-list'
import type { OnboardingController } from './project-onboarding'
import { targetCount } from './project-onboarding-copy'
import { setupDiffFiles } from './project-onboarding-diff-files'
import { ProjectOnboardingStageActions as StageActions } from './project-onboarding-layout'
import { OpenProjectButton } from './project-onboarding-open-project-button'
import { SectionCard, SubsectionHeader } from './project-onboarding-primitives'

export function StartingStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  return (
    <div className="flex min-h-96 flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <Play className="size-6" />
      </span>
      <h1 className="onboarding-stage-heading mt-5 type-title" tabIndex={-1}>
        {t('onboarding.flow.starting.title')}
      </h1>
      <p className="project-setup-shimmer mt-2 type-body" role="status">
        {t('onboarding.flow.starting.description', {
          targets: targetCount(controller.state.targets.length),
        })}
      </p>
    </div>
  )
}

export function CompleteStage({ controller }: { controller: OnboardingController }) {
  if (controller.state.skippedSetup) return <SkippedStage />
  if (controller.state.method === 'manual') return <ManualCompleteStage controller={controller} />
  return <RunningCompleteStage controller={controller} />
}

function SkippedStage() {
  const { t } = useTranslation('projects')
  return (
    <div className="flex min-h-96 flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <FolderOpen className="size-6" />
      </span>
      <h1 className="onboarding-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
        {t('onboarding.flow.complete.openTitle')}
      </h1>
      <p className="mt-2 max-w-lg type-body text-muted-foreground">
        {t('onboarding.flow.complete.skippedDescription')}
      </p>
      <StageActions>
        <OpenProjectButton />
      </StageActions>
    </div>
  )
}

function RunningCompleteStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  return (
    <>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-diff-added/10 text-diff-added">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="onboarding-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
          {t('onboarding.flow.complete.runningTitle')}
        </h1>
        <p className="mt-2 type-body text-muted-foreground">
          {t('onboarding.flow.complete.runningDescription')}
        </p>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {state.targets.map((target) => (
          <SectionCard
            collapsible={false}
            icon={<Package />}
            key={target.id}
            subtitle={target.path}
            title={target.name}
          >
            <code className="m-4 block rounded-lg bg-muted px-3 py-2 type-code">
              {target.startCommand}
            </code>
          </SectionCard>
        ))}
      </div>
      <div className="mt-7 space-y-4">
        <SubsectionHeader icon={<GitBranch />} title={t('onboarding.flow.complete.diffTitle')} />
        <FileDiffList
          accessibleName={t('onboarding.flow.complete.diffAccessibleName')}
          className="onboarding-file-diff-list"
          files={setupDiffFiles(state)}
          markViewedLabel={(path) => t('onboarding.flow.complete.markViewed', { path })}
          viewedLabel={t('onboarding.flow.complete.viewed')}
        />
      </div>
      <StageActions>
        <OpenProjectButton />
      </StageActions>
    </>
  )
}

function ManualCompleteStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  return (
    <>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
          <FileJson className="size-7" />
        </span>
        <h1 className="onboarding-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
          {t('onboarding.manual.complete.title')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl type-body text-muted-foreground">
          {t('onboarding.manual.complete.description')}
        </p>
      </div>
      {state.targets.length > 0 ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {state.targets.map((target) => (
            <SectionCard
              collapsible={false}
              icon={<Package />}
              key={target.id}
              subtitle={target.path || t('onboarding.target.noPath')}
              title={target.name}
            >
              <p className="px-4 py-3 type-label text-muted-foreground">
                {t('onboarding.manual.complete.stored')}
              </p>
            </SectionCard>
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-7 max-w-xl rounded-xl border border-dashed p-5 text-center">
          <p className="type-heading">{t('onboarding.manual.complete.noTargets')}</p>
          <p className="mt-1 type-label text-muted-foreground">
            {t('onboarding.manual.complete.noTargetsDescription')}
          </p>
        </div>
      )}
      <StageActions>
        <OpenProjectButton />
      </StageActions>
    </>
  )
}
