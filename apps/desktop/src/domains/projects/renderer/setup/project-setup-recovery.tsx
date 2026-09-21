import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { Button } from '@/platform/renderer/components/ui/button'

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
  const action = review
    ? { type: 'request-plan-change' as const, feedback: 'Review drift' }
    : {
        type: snapshot.attempt?.applicationSessionId
          ? ('resume-application' as const)
          : ('resume-planning' as const),
      }
  return (
    <section
      className="mt-6 grid gap-3"
      aria-label={t(review ? 'setup.actor.review-required.label' : 'setup.actor.interrupted.label')}
    >
      <p className="type-body">{snapshot.recoveryMessage}</p>
      <SetupCommandButton command={command} value={action}>
        {t(review ? 'setup.actor.review-required.action' : 'setup.actor.interrupted.resume')}
      </SetupCommandButton>
      {!review ? (
        <SetupCommandButton command={command} value={{ type: 'restart-attempt' }} variant="outline">
          {t('setup.actor.interrupted.restart')}
        </SetupCommandButton>
      ) : null}
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
