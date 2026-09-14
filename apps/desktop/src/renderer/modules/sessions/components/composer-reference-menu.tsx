import { TriangleAlert } from 'lucide-react'
import type { SessionCli } from '../harness/harnesses'
import {
  cliLabel,
  referenceSuggestions,
  referenceSupportsCli,
  type SessionReference,
  SessionReferenceIcon,
} from './SessionReference'

export type ReferenceSuggestion = SessionReference
type ActiveReference = {
  leading: string
  query: string
  source: string
  trigger: '/' | '@'
}

export const composerPlaceholder = (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute px-4 py-3 type-body text-muted-foreground"
  >
    Direct the next move…
  </span>
)

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

export function referenceMenu(draft: string) {
  const active = activeReference(draft)
  if (active === null) return null
  const choices = referenceSuggestions(active.trigger, active.query)
  return choices.length === 0 ? null : choices
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

export function ComposerReferenceMenu({
  choices,
  cli = null,
  onChoose,
  selected,
}: {
  choices: readonly ReferenceSuggestion[]
  cli?: SessionCli | null
  onChoose: (choice: ReferenceSuggestion) => void
  selected: number
}) {
  return (
    <div
      aria-label="References"
      className="absolute bottom-full -inset-x-px z-40 mb-2 overflow-hidden rounded-xl border bg-card p-1 shadow-xl"
      id="composer-references"
      role="listbox"
    >
      {choices.map((choice, index) => {
        const unsupported = !referenceSupportsCli(choice, cli)
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
                <TriangleAlert aria-hidden="true" className="size-3.5" />
              ) : (
                <SessionReferenceIcon kind={choice.kind} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block type-label font-medium">{choice.label}</span>
              <span className="block text-meta text-muted-foreground">
                {unsupported ? `Not available for ${cliLabel(cli)}` : choice.detail}
              </span>
            </span>
            <span className="text-meta capitalize text-muted-foreground">{choice.kind}</span>
          </button>
        )
      })}
    </div>
  )
}
