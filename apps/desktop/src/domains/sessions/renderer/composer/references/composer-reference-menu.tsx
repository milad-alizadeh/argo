import { useTranslation } from 'react-i18next'
import type { ComposerCommandListing } from '@/domains/sessions/api/composer-commands'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { SessionHarness } from '../../harness/harnesses'
import {
  referenceHarnessLabel,
  referenceSuggestions,
  referenceSupportsHarness,
  referencesFromCommands,
  type SessionReference,
  SessionReferenceIcon,
} from './session-reference'

export type ReferenceSuggestion = SessionReference
export type ReferenceMenu =
  | { kind: 'choices'; choices: readonly ReferenceSuggestion[] }
  | { kind: 'note'; note: 'empty' | 'pending' | 'unavailable' }

type ActiveReference = {
  leading: string
  query: string
  source: string
  trigger: '/' | '@'
}

function referenceTrigger(value: string | undefined): '/' | '@' | null {
  return value === '/' || value === '@' ? value : null
}

export function activeReference(text: string): ActiveReference | null {
  const match = text.match(/(^|\s)(\/|@)([^\s]*)$/)
  if (match === null) return null
  const trigger = referenceTrigger(match[2])
  if (trigger === null) return null
  return {
    leading: match[1] ?? '',
    query: match[3] ?? '',
    source: match[0],
    trigger,
  }
}

export function referenceMenu(
  draft: string,
  listing: ComposerCommandListing,
): ReferenceMenu | null {
  const active = activeReference(draft)
  if (active?.trigger !== '/') return null
  switch (listing.availability) {
    case 'pending':
      return { kind: 'note', note: 'pending' }
    case 'unavailable':
      return { kind: 'note', note: 'unavailable' }
    case 'listed': {
      const choices = referenceSuggestions(referencesFromCommands(listing.commands), active.query)
      if (choices.length === 0) return { kind: 'note', note: 'empty' }
      return { kind: 'choices', choices }
    }
  }
}

export function referenceMenuKey({
  choices,
  event,
  onChoose,
  onDismiss,
  onMove,
  selected,
}: {
  choices: readonly ReferenceSuggestion[]
  event: KeyboardEvent
  onChoose: (choice: ReferenceSuggestion) => void
  onDismiss: () => void
  onMove: (direction: 1 | -1) => void
  selected: number
}) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    onMove(event.key === 'ArrowDown' ? 1 : -1)
    return true
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    onDismiss()
    return true
  }
  if (event.key !== 'Enter' || event.shiftKey) return false
  const choice = choices[selected] ?? choices[0]
  if (choice === undefined) return false
  event.preventDefault()
  onChoose(choice)
  return true
}

function ReferenceNote({
  harness,
  note,
}: {
  harness: SessionHarness | null
  note: 'empty' | 'pending' | 'unavailable'
}) {
  const { t } = useTranslation('sessions')
  const text =
    note === 'unavailable'
      ? t('composer.references.unavailable', { harness: referenceHarnessLabel(harness) })
      : t(`composer.references.${note}`)
  return (
    <div
      aria-disabled="true"
      aria-selected="false"
      className="px-3 py-2 type-body text-muted-foreground"
      role="option"
      tabIndex={-1}
    >
      {text}
    </div>
  )
}

export function ComposerReferenceMenu({
  harness = null,
  menu,
  onChoose,
  selected,
}: {
  harness?: SessionHarness | null
  menu: ReferenceMenu
  onChoose: (choice: ReferenceSuggestion) => void
  selected: number
}) {
  const { t } = useTranslation('sessions')
  return (
    <div
      aria-label={t('composer.references.label')}
      className="absolute bottom-full -inset-x-px z-40 mb-2 overflow-hidden rounded-xl border bg-card p-1 shadow-xl"
      id="composer-references"
      role="listbox"
    >
      {menu.kind === 'note' ? (
        <ReferenceNote harness={harness} note={menu.note} />
      ) : (
        menu.choices.map((choice, index) => {
          const unsupported = !referenceSupportsHarness(choice, harness)
          return (
            <button
              aria-selected={index === selected}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left type-body ${index === selected ? 'bg-muted' : 'hover:bg-muted'}`}
              data-reference-kind={choice.kind}
              key={choice.source}
              id={`composer-reference-${choice.source.slice(1)}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChoose(choice)}
              role="option"
              type="button"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card">
                {unsupported ? (
                  <Icon name="triangle-alert" className="size-3.5" />
                ) : (
                  <SessionReferenceIcon kind={choice.kind} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block type-control">
                  {choice.label}
                  {choice.argumentHint ? (
                    <span className="type-meta text-muted-foreground"> {choice.argumentHint}</span>
                  ) : null}
                </span>
                <span className="block type-meta text-muted-foreground">
                  {unsupported
                    ? t('composer.references.unavailable', {
                        harness: referenceHarnessLabel(harness),
                      })
                    : choice.detail}
                </span>
              </span>
              <span className="type-meta capitalize text-muted-foreground">{choice.kind}</span>
            </button>
          )
        })
      )}
    </div>
  )
}
