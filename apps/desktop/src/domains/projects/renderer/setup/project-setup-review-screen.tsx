import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { Button } from '@/platform/renderer/components/ui/button'

type ReviewScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function ReviewScreen({ command, snapshot }: ReviewScreenProps) {
  switch (snapshot.screen) {
    case 'reviewing-plan':
      return <ReviewingPlan command={command} snapshot={snapshot} />
    case 'reviewing-diff':
      return <ReviewingDiff command={command} snapshot={snapshot} />
    default:
      return null
  }
}

function ReviewingPlan({ command, snapshot }: ReviewScreenProps) {
  const { t } = useTranslation('projects')
  const [feedback, setFeedback] = useState('')
  if (!snapshot.plan) return null
  return (
    <section className="mt-6 grid gap-4" aria-label={t('setup.actor.reviewing-plan.planLabel')}>
      <ul className="grid gap-2">
        {snapshot.plan.targets.map((target) => (
          <li className="rounded-md border p-3 type-body" key={target.id}>
            {target.name}
          </li>
        ))}
      </ul>
      <textarea
        aria-label={t('setup.actor.reviewing-plan.feedbackLabel')}
        className="min-h-24 rounded-md border p-3 type-body"
        onChange={(event) => setFeedback(event.target.value)}
        value={feedback}
      />
      <div className="flex gap-3">
        <Button
          disabled={feedback.trim().length === 0}
          onClick={() => void command({ type: 'request-plan-change', feedback })}
          variant="outline"
        >
          {t('setup.actor.reviewing-plan.changeAction')}
        </Button>
        <Button
          onClick={() =>
            void command({
              type: 'accept-plan',
              acceptedPlan: snapshot.acceptedPlan ?? planFor(snapshot),
            })
          }
        >
          {t('setup.actor.reviewing-plan.acceptAction')}
        </Button>
      </div>
    </section>
  )
}

function ReviewingDiff({ command, snapshot }: ReviewScreenProps) {
  const { t } = useTranslation('projects')
  return (
    <section className="mt-6 grid gap-4" aria-label={t('setup.actor.reviewing-diff.diffLabel')}>
      {snapshot.recoveryMessage ? (
        <p className="type-body" role="status">
          {snapshot.recoveryMessage}
        </p>
      ) : null}
      <pre className="max-h-96 overflow-auto rounded-md border p-3 type-body">
        {snapshot.finalDiff}
      </pre>
      <div className="flex gap-3">
        <Button onClick={() => void command({ type: 'approve-final-diff' })}>
          {t('setup.actor.reviewing-diff.approveAction')}
        </Button>
        <Button onClick={() => void command({ type: 'reject-final-diff' })} variant="outline">
          {t('setup.actor.reviewing-diff.rejectAction')}
        </Button>
      </div>
    </section>
  )
}

function planFor(snapshot: ProjectSetupSnapshot) {
  const plan = snapshot.plan
  if (plan === null) throw new Error('A reviewed ProjectSetup plan is required before acceptance.')
  return {
    sourceRevision: plan.source.planRevision,
    projectRoot: plan.source.projectRoot,
    fingerprints: plan.source.fingerprints,
    targets: plan.targets,
    capabilities: plan.capabilities.map(
      ({ disposition: _disposition, ...capability }) => capability,
    ),
    toolRecommendations: plan.toolRecommendations,
    repositoryActions: plan.repositoryActions,
    targetActions: plan.targetActions,
    verification: plan.verification,
    handoff: { ...plan.handoff, acceptanceState: 'accepted' as const },
  }
}
