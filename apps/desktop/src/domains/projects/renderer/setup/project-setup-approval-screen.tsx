import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { PermissionPrompt } from '@/platform/renderer/components/permission-prompt'
import { Button } from '@/platform/renderer/components/ui/button'

type ApprovalScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function Approval({ command, snapshot }: ApprovalScreenProps) {
  const { t } = useTranslation('projects')
  const approval = snapshot.pendingApproval
  if (approval === null) return null
  return (
    <section className="mt-6" aria-label={t('setup.actor.awaiting-approval.label')}>
      <PermissionPrompt
        harness={snapshot.attempt?.applicationHarness ?? snapshot.attempt?.planningHarness}
        headingLevel={2}
        permission={{ description: approval.description, id: approval.permissionId }}
        onDecide={async (decision) => {
          await command({ type: decision === 'allow' ? 'approve-effect' : 'reject-effect' })
          return true
        }}
      />
    </section>
  )
}

export function CancelFailed({ command }: ApprovalScreenProps) {
  const { t } = useTranslation('projects')
  return (
    <section className="mt-6" aria-label={t('setup.actor.cancel-failed.label')}>
      <div className="flex justify-end">
        <Button onClick={() => void command({ type: 'retry-cancel' })}>
          {t('setup.actor.cancel-failed.action')}
        </Button>
      </div>
    </section>
  )
}
