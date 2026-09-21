import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { Button } from '@/platform/renderer/components/ui/button'

type ApprovalScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function EffectApproval({ command, snapshot }: ApprovalScreenProps) {
  const { t } = useTranslation('projects')
  return (
    <section className="mt-6 grid gap-3" aria-label={t('setup.actor.awaiting-approval.label')}>
      <p className="type-body">{snapshot.pendingApproval?.description}</p>
      <div className="flex gap-3">
        <Button onClick={() => void command({ type: 'approve-effect' })}>
          {t('setup.actor.awaiting-approval.approve')}
        </Button>
        <Button onClick={() => void command({ type: 'reject-effect' })} variant="outline">
          {t('setup.actor.awaiting-approval.reject')}
        </Button>
      </div>
    </section>
  )
}

export function CancelFailed({ command, snapshot }: ApprovalScreenProps) {
  const { t } = useTranslation('projects')
  return (
    <section className="mt-6 grid gap-3" aria-label={t('setup.actor.cancel-failed.label')}>
      <p className="type-body">{snapshot.recoveryMessage}</p>
      <Button onClick={() => void command({ type: 'retry-cancel' })}>
        {t('setup.actor.cancel-failed.action')}
      </Button>
    </section>
  )
}
