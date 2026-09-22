import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { focusAfterLeaving, useExitPresence } from './exit-presence'
import { Icon } from './icon'
import { AllowButton, type PermissionAnswer, type SessionHarness } from './permission-allow-button'

type Permission = { description: string; id: string }

type PermissionLabels = { allow: string; deny: string; title: string }

export type PermissionPromptProps = {
  presentation?: 'composer' | 'stage'
  harness?: SessionHarness
  // The composer tray has no page heading above it, so the title defaults to `h3`. A caller that
  // nests this under its own `h1` (Project setup's Approval screen) passes 2 to keep the document
  // outline unbroken.
  headingLevel?: 2 | 3
  labels?: PermissionLabels
  permission: Pick<Permission, 'description' | 'id'> | null
  onDecide: (decision: PermissionAnswer) => Promise<boolean>
}

// The top card in the composer's attachment tray, above the queue.
export function PermissionPrompt({
  headingLevel = 3,
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
      headingLevel={headingLevel}
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
  headingLevel,
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
          <Icon
            name="shield-question"
            className="size-(--size-icon-inline) shrink-0 text-muted-foreground"
          />
          {headingLevel === 2 ? (
            <h2 id={titleId} className="min-w-0 flex-1 type-heading">
              {labels.title}
            </h2>
          ) : (
            <h3 id={titleId} className="min-w-0 flex-1 type-heading">
              {labels.title}
            </h3>
          )}
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
