import { ChevronDown, ShieldQuestion } from 'lucide-react'
import { type RefObject, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Permission } from '@/domains/sessions/contract/contract'
import {
  focusAfterLeaving,
  useExitPresence,
} from '@/domains/sessions/renderer/composer/tray/use-exit-presence'
import type { PermissionAnswer } from '@/domains/sessions/renderer/composer/use-session-permission'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'
import { Button } from '@/platform/renderer/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/platform/renderer/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'

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

// An answer disables the buttons, which drops focus to the page; the leaving card hands it on.
function useFocusAfterLeaving(cardRef: RefObject<HTMLElement | null>, exiting: boolean) {
  useEffect(() => {
    const card = cardRef.current
    if (!exiting || card === null) return
    const focus = document.activeElement
    if (focus === document.body || card.contains(focus)) focusAfterLeaving(card)
  }, [cardRef, exiting])
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
  const cardRef = useRef<HTMLElement>(null)
  useFocusAfterLeaving(cardRef, exiting)
  const decide = async (decision: PermissionAnswer) => {
    setDeciding(true)
    if (!(await onDecide(decision))) setDeciding(false)
  }
  const locked = deciding || exiting
  return (
    <section
      aria-labelledby={titleId}
      ref={cardRef}
      className={`session-page__composer-permission${exiting ? ' session-page__composer-permission--exit' : ''}`}
      inert={exiting}
    >
      <div className="session-page__composer-permission-body">
        <div className="flex items-center gap-2">
          <ShieldQuestion
            aria-hidden="true"
            className="size-(--size-icon-inline) shrink-0 text-muted-foreground"
          />
          <h3 id={titleId} className="min-w-0 flex-1 type-heading">
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
