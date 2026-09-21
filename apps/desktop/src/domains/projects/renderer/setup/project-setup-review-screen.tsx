import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { FileDiffList } from '@/platform/renderer/components/file-diff-list'
import { Icon } from '@/platform/renderer/components/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { Textarea } from '@/platform/renderer/components/ui/textarea'
import { projectSetupDiffFiles } from './project-setup-diff-files'
import { ProjectSetupPlanConfiguration, ProjectSetupPlanReview } from './project-setup-plan-review'
import { projectSetupRecoveryText } from './project-setup-recovery-text'

type ReviewScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function ReviewScreen({ command, snapshot }: ReviewScreenProps) {
  switch (snapshot.screen) {
    case 'reviewing-plan':
      return <ReviewingPlan command={command} snapshot={snapshot} />
    case 'customizing-project-setup':
      return <CustomizingProjectSetup command={command} snapshot={snapshot} />
    case 'reviewing-diff':
      return <ReviewingDiff command={command} snapshot={snapshot} />
    default:
      return null
  }
}

function ReviewingPlan({ command, snapshot }: ReviewScreenProps) {
  const { t } = useTranslation('projects')
  const [customizing, setCustomizing] = useState(false)
  const [feedback, setFeedback] = useState('')
  if (!snapshot.plan) return null
  return (
    <section className="mt-7 grid gap-5" aria-label={t('setup.actor.reviewing-plan.planLabel')}>
      <ProjectSetupPlanReview plan={snapshot.plan} />
      {customizing ? (
        <Textarea
          aria-label={t('setup.actor.reviewing-plan.feedbackLabel')}
          className="min-h-24 type-body"
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={t('setup.actor.reviewing-plan.feedbackPlaceholder')}
          value={feedback}
        />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {customizing ? (
          <Button
            disabled={feedback.trim().length === 0}
            onClick={() => void command({ type: 'request-plan-change', feedback })}
            variant="outline"
          >
            {t('setup.actor.reviewing-plan.requestChangeAction')}
          </Button>
        ) : (
          <Button onClick={() => setCustomizing(true)} variant="outline">
            {t('setup.actor.reviewing-plan.changeAction')}
          </Button>
        )}
        <Button onClick={() => void command({ type: 'continue-plan-review' })}>
          {t('setup.actor.reviewing-plan.continueAction')}
        </Button>
      </div>
    </section>
  )
}

function CustomizingProjectSetup({ command, snapshot }: ReviewScreenProps) {
  const { t } = useTranslation('projects')
  const [selectedIds, setSelectedIds] = useState(() => selectableIds(snapshot))
  if (!snapshot.plan) return null
  const toggle = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <section
      className="mt-7 grid gap-5"
      aria-label={t('setup.actor.customizing-project-setup.planLabel')}
    >
      <ProjectSetupPlanConfiguration
        onToggle={toggle}
        plan={snapshot.plan}
        selectedIds={selectedIds}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          onClick={() =>
            void command({
              type: 'accept-plan',
              acceptedPlan: planFor(snapshot, selectedIds),
            })
          }
        >
          {t('setup.actor.customizing-project-setup.acceptAction')}
        </Button>
      </div>
    </section>
  )
}

function ReviewingDiff({ command, snapshot }: ReviewScreenProps) {
  const { t } = useTranslation('projects')
  const [feedback, setFeedback] = useState('')
  const targets = snapshot.acceptedPlan?.targets ?? []
  return (
    <section aria-label={t('setup.actor.reviewing-diff.diffLabel')}>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-diff-added/10 text-diff-added">
          <Icon name="success" className="size-7" />
        </span>
        <h1 className="onboarding-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
          {t('setup.actor.reviewing-diff.title')}
        </h1>
        <p className="mt-2 type-body text-muted-foreground">
          {t('setup.actor.reviewing-diff.description')}
        </p>
      </div>
      {snapshot.recoveryMessage ? (
        <p className="mt-7 type-body" role="status">
          {projectSetupRecoveryText(t, snapshot.recoveryMessage)}
        </p>
      ) : null}
      {targets.length > 0 ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {targets.map((target) => (
            <section className="overflow-hidden rounded-xl border" key={target.id}>
              <header className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <Icon name="target-repository" size="control" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate type-body">{target.name}</strong>
                  <span className="block truncate type-label text-muted-foreground">
                    {target.path}
                  </span>
                </span>
              </header>
              <code className="m-4 block rounded-lg bg-muted px-3 py-2 type-code">
                {target.commands.run}
              </code>
            </section>
          ))}
        </div>
      ) : null}
      <div className="mt-7 space-y-4">
        <h2 className="flex items-center gap-2 type-heading">
          <Icon name="branch" className="text-muted-foreground" size="control" />
          {t('setup.actor.reviewing-diff.diffTitle')}
        </h2>
        <FileDiffList
          accessibleName={t('setup.actor.reviewing-diff.diffLabel')}
          className="max-h-144"
          files={projectSetupDiffFiles(snapshot.finalDiff)}
          markViewedLabel={(path) => t('setup.actor.reviewing-diff.markViewed', { path })}
          viewedLabel={t('setup.actor.reviewing-diff.viewed')}
        />
      </div>
      <div className="mt-6 grid gap-3">
        <Textarea
          aria-label={t('setup.actor.reviewing-diff.feedbackLabel')}
          className="min-h-24 type-body"
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={t('setup.actor.reviewing-diff.feedbackPlaceholder')}
          value={feedback}
        />
        <footer className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={feedback.trim().length === 0}
            onClick={() =>
              void command({ type: 'request-application-change', feedback: feedback.trim() })
            }
            variant="outline"
          >
            {t('setup.actor.reviewing-diff.changeAction')}
          </Button>
          <Button onClick={() => void command({ type: 'approve-final-diff' })}>
            {t('setup.actor.reviewing-diff.approveAction')}
          </Button>
        </footer>
      </div>
    </section>
  )
}

function planFor(snapshot: ProjectSetupSnapshot, selectedIds?: Set<string>) {
  const plan = snapshot.plan
  if (plan === null) throw new Error('A reviewed ProjectSetup plan is required before acceptance.')
  const selected = (id: string) => selectedIds?.has(id) ?? true
  return {
    sourceRevision: plan.source.planRevision,
    projectRoot: plan.source.projectRoot,
    fingerprints: plan.source.fingerprints,
    targets: plan.targets,
    capabilities: plan.capabilities
      .filter(({ id }) => selected(id))
      .map(({ disposition: _disposition, ...capability }) => capability),
    toolRecommendations: plan.toolRecommendations.filter(({ id, scope }) =>
      scope === 'target' ? true : selected(id),
    ),
    repositoryActions: plan.repositoryActions.filter(({ id }) => selected(id)),
    targetActions: plan.targetActions.filter(({ id }) => selected(id)),
    verification: plan.verification,
    handoff: { ...plan.handoff, acceptanceState: 'accepted' as const },
  }
}

function selectableIds(snapshot: ProjectSetupSnapshot) {
  const plan = snapshot.plan
  if (!plan) return new Set<string>()
  return new Set([
    ...plan.capabilities
      .filter(({ disposition }) => disposition !== 'not-applicable')
      .map(({ id }) => id),
    ...plan.toolRecommendations.filter(({ scope }) => scope === 'repository').map(({ id }) => id),
    ...plan.repositoryActions.map(({ id }) => id),
    ...plan.targetActions.map(({ id }) => id),
  ])
}
