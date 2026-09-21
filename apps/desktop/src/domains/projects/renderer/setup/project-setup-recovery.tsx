import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { FileDiffList } from '@/platform/renderer/components/file-diff-list'
import { Button } from '@/platform/renderer/components/ui/button'
import { projectSetupDiffFiles } from './project-setup-diff-files'
import { projectSetupRecoveryText } from './project-setup-recovery-text'

export function Recovery({
  command,
  review,
  snapshot,
}: {
  command: (command: ProjectSetupCommand) => Promise<void>
  review: boolean
  snapshot: ProjectSetupSnapshot
}) {
  const { t } = useTranslation('projects')
  if (review) return <ReviewRequired command={command} snapshot={snapshot} />
  const action = {
    type: snapshot.attempt?.applicationSessionId
      ? ('resume-application' as const)
      : ('resume-planning' as const),
  }
  const recoveryText = projectSetupRecoveryText(t, snapshot.recoveryMessage)
  return (
    <section className="mt-6 grid gap-3" aria-label={t('setup.actor.interrupted.label')}>
      {recoveryText ? <p className="type-body">{recoveryText}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <SetupCommandButton command={command} value={action}>
          {t('setup.actor.interrupted.resume')}
        </SetupCommandButton>
        <SetupCommandButton command={command} value={{ type: 'restart-attempt' }} variant="outline">
          {t('setup.actor.interrupted.restart')}
        </SetupCommandButton>
      </div>
    </section>
  )
}

function ReviewRequired({ command, snapshot }: Omit<Parameters<typeof Recovery>[0], 'review'>) {
  const { t } = useTranslation('projects')
  return (
    <section className="mt-6 grid gap-4" aria-label={t('setup.actor.review-required.label')}>
      <p className="type-body">{projectSetupRecoveryText(t, snapshot.recoveryMessage)}</p>
      <FileDiffList
        accessibleName={t('setup.actor.review-required.diffLabel')}
        className="max-h-144"
        files={projectSetupDiffFiles(snapshot.finalDiff)}
        markViewedLabel={(path) => t('setup.actor.reviewing-diff.markViewed', { path })}
        viewedLabel={t('setup.actor.reviewing-diff.viewed')}
      />
      <div className="flex justify-end">
        <SetupCommandButton
          command={command}
          value={{
            type: 'request-plan-change',
            feedback: t('setup.actor.review-required.feedback'),
          }}
        >
          {t('setup.actor.review-required.action')}
        </SetupCommandButton>
      </div>
    </section>
  )
}

function SetupCommandButton({
  children,
  command,
  value,
  variant,
}: {
  children: ReactNode
  command: (command: ProjectSetupCommand) => Promise<void>
  value: ProjectSetupCommand
  variant?: 'default' | 'outline'
}) {
  return (
    <Button onClick={() => void command(value)} variant={variant}>
      {children}
    </Button>
  )
}
