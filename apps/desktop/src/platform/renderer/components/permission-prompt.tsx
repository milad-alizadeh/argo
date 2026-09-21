import { ChevronDown, ShieldQuestion } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { focusAfterLeaving, useExitPresence } from '@/platform/renderer/components/exit-presence'
import { Button } from '@/platform/renderer/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/platform/renderer/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'

// What each Harness's standing allow covers: Claude's gate remembers similar calls, Codex the Session.
const STANDING_ALLOW = { claude: 'permission.allowSimilar', codex: 'permission.allowAll' } as const

type PermissionAnswer = 'allow' | 'allowForSession' | 'deny'
type SessionHarness = keyof typeof STANDING_ALLOW
type Permission = { description: string; id: string }

type PermissionLabels = { allow: string; deny: string; title: string }

export type PermissionPromptProps = {
  presentation?: 'composer' | 'stage'
  harness?: SessionHarness
  labels?: PermissionLabels
  permission: Pick<Permission, 'description' | 'id'> | null
  onDecide: (decision: PermissionAnswer) => Promise<boolean>
}

// The top card in the composer's attachment tray, above the queue.
export function PermissionPrompt({
  labels,
  permission,
  presentation = 'composer',
  ...props
}: PermissionPromptProps) {
  const { t } = useTranslation('sessions')
  const { exiting, shown } = useExitPresence(permission)
  if (shown === null) return null
  return (
    <PermissionCard
      key={shown.id}
      exiting={exiting}
      labels={
        labels ?? {
          allow: t('permission.allow'),
          deny: t('permission.deny'),
          title: t('permission.title'),
        }
      }
      permission={shown}
      presentation={presentation}
      {...props}
    />
  )
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
  harness,
  exiting,
  labels,
  permission,
  presentation,
  onDecide,
}: Omit<PermissionPromptProps, 'permission'> & {
  exiting: boolean
  labels: PermissionLabels
  permission: Pick<Permission, 'description' | 'id'>
}) {
  const titleId = useId()
  const [deciding, setDeciding] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  useFocusAfterLeaving(cardRef, exiting)
  const decide = async (decision: PermissionAnswer) => {
    setDeciding(true)
    if (!(await onDecide(decision))) setDeciding(false)
  }
  const locked = deciding || exiting
  const actions = (
    <AllowButton allowLabel={labels.allow} disabled={locked} harness={harness} onDecide={decide} />
  )
  return (
    <section
      aria-labelledby={titleId}
      ref={cardRef}
      className={`session-page__composer-permission overflow-hidden [interpolate-size:allow-keywords]${exiting ? ' session-page__composer-permission--exit' : ''}`}
      inert={exiting}
    >
      <div
        className={
          presentation === 'stage'
            ? 'grid grid-cols-[var(--size-icon-inline)_minmax(0,1fr)] gap-x-(--spacing-shell-item) gap-y-(--spacing-shell-item) p-0'
            : 'grid gap-(--spacing-shell-item) py-(--spacing-shell-item) pr-(--spacing-shell-item) pl-(--spacing-shell-inset)'
        }
      >
        <div className={presentation === 'stage' ? 'contents' : 'flex items-center gap-2'}>
          <ShieldQuestion
            aria-hidden="true"
            className="size-(--size-icon-inline) shrink-0 text-muted-foreground"
          />
          <h3 id={titleId} className="min-w-0 flex-1 type-heading">
            {labels.title}
          </h3>
          {presentation === 'composer' ? (
            <PermissionActions denyLabel={labels.deny} locked={locked} onDecide={decide}>
              {actions}
            </PermissionActions>
          ) : null}
        </div>
        <pre
          className={`max-h-[calc(var(--size-queue-row)*3)] overflow-auto rounded-md bg-muted px-(--spacing-shell-item) py-(--spacing-tight) whitespace-pre-wrap [overflow-wrap:anywhere] type-code${presentation === 'stage' ? ' col-start-2' : ''}`}
        >
          {permission.description}
        </pre>
        {presentation === 'stage' ? (
          <div className="col-start-2">
            <PermissionActions denyLabel={labels.deny} locked={locked} onDecide={decide}>
              {actions}
            </PermissionActions>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function PermissionActions({
  children,
  denyLabel,
  locked,
  onDecide,
}: {
  children: ReactNode
  denyLabel: string
  locked: boolean
  onDecide: (decision: PermissionAnswer) => Promise<void>
}) {
  return (
    <div className="ml-auto flex flex-wrap justify-end gap-2">
      <Button disabled={locked} size="sm" variant="outline" onClick={() => void onDecide('deny')}>
        {denyLabel}
      </Button>
      {children}
    </div>
  )
}

function AllowButton({
  allowLabel,
  harness,
  disabled,
  onDecide,
}: {
  allowLabel: string
  harness: SessionHarness | undefined
  disabled: boolean
  onDecide: (decision: PermissionAnswer) => Promise<void>
}) {
  const { t } = useTranslation('sessions')
  if (harness === undefined) {
    return (
      <Button disabled={disabled} size="sm" onClick={() => void onDecide('allow')}>
        {allowLabel}
      </Button>
    )
  }
  return (
    <ButtonGroup>
      <Button disabled={disabled} size="sm" onClick={() => void onDecide('allow')}>
        {allowLabel}
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
            {t(STANDING_ALLOW[harness])}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
