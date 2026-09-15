import { ChevronDown, ShieldQuestion } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Permission } from '@/core/sessions/contract'
import { Button } from '../../../components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '../../../components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import type { SessionCli } from '../harness/harnesses'
import type { PermissionAnswer } from '../hooks/useSessionPermission'
import { useExitPresence } from './use-exit-presence'

// What each CLI's standing allow covers: Claude's gate remembers similar calls, Codex the Session.
const STANDING_ALLOW = {
  claude: 'permission.allowSimilar',
  codex: 'permission.allowAll',
} as const satisfies Record<SessionCli, string>

type PermissionPromptProps = {
  cli: SessionCli
  permission: Permission | null
  onDecide: (decision: PermissionAnswer) => Promise<boolean>
}

// The top card in the composer's attachment tray, above the queue.
export function PermissionPrompt({ permission, ...props }: PermissionPromptProps) {
  const { exiting, shown } = useExitPresence(permission)
  if (shown === null) return null
  return <PermissionCard key={shown.id} exiting={exiting} permission={shown} {...props} />
}

function PermissionCard({
  cli,
  exiting,
  permission,
  onDecide,
}: PermissionPromptProps & { exiting: boolean; permission: Permission }) {
  const { t } = useTranslation('sessions')
  const titleId = useId()
  const [deciding, setDeciding] = useState(false)
  const decide = async (decision: PermissionAnswer) => {
    setDeciding(true)
    if (!(await onDecide(decision))) setDeciding(false)
  }
  const locked = deciding || exiting
  return (
    <section
      aria-labelledby={titleId}
      className={`session-page__composer-permission${exiting ? ' session-page__composer-permission--exit' : ''}`}
      inert={exiting}
    >
      <div className="session-page__composer-permission-body">
        <div className="flex items-center gap-2">
          <ShieldQuestion
            aria-hidden="true"
            className="size-(--size-icon-inline) shrink-0 text-muted-foreground"
          />
          <h3 id={titleId} className="min-w-0 flex-1 type-heading font-medium">
            {t('permission.title')}
          </h3>
          <Button disabled={locked} size="sm" variant="outline" onClick={() => void decide('deny')}>
            {t('permission.deny')}
          </Button>
          <AllowButton cli={cli} disabled={locked} onDecide={decide} />
        </div>
        <pre className="session-page__composer-permission-call type-code">
          {permission.description}
        </pre>
      </div>
    </section>
  )
}

function AllowButton({
  cli,
  disabled,
  onDecide,
}: {
  cli: SessionCli
  disabled: boolean
  onDecide: (decision: PermissionAnswer) => Promise<void>
}) {
  const { t } = useTranslation('sessions')
  return (
    <ButtonGroup>
      <Button disabled={disabled} size="sm" onClick={() => void onDecide('allow')}>
        {t('permission.allow')}
      </Button>
      <ButtonGroupSeparator className="bg-primary-foreground/25" />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={<Button aria-label={t('permission.more')} size="icon-sm" />}
        >
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-auto">
          <DropdownMenuItem onClick={() => void onDecide('allowForSession')}>
            {t(STANDING_ALLOW[cli])}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
