import type { SessionStatus as SessionStatusValue } from '../../../../core/sessions/models'

// The four inks a state is drawn in (`cockpit-roster-row.html` · SessionMarker). The eight words
// are the domain's and the four inks are the design's, so this table is the one place the two
// meet. Typed over every status, so a ninth word is a typecheck error here rather than a row
// drawn in no ink. `unknown` is an outline and never a colour: the design holds no ink for "Argo
// cannot say", and inventing one would be the claim itself (ADR-0008).
const INK = {
  starting: 'running',
  running: 'running',
  permission: 'attention',
  asking: 'attention',
  idle: 'idle',
  stopped: 'idle',
  ended: 'idle',
  unknown: 'unknown',
} as const satisfies Record<SessionStatusValue, string>

// The state's own mark: the leading column's dot on a row, and the running dot on a rail chip.
export function SessionStateDot({ status }: { status: SessionStatusValue }) {
  return (
    <span
      aria-hidden="true"
      className="size-(--size-state-dot) flex-none rounded-full data-[ink=attention]:bg-warn data-[ink=idle]:bg-idle data-[ink=running]:bg-active data-[ink=running]:shadow-state-glow data-[ink=unknown]:shadow-state-outline"
      data-component="SessionStateDot"
      data-ink={INK[status]}
    />
  )
}

// The word Argo has for what a Session is doing. The design spends it on the row only where the
// reader has to stop scanning, so a Session waiting on the reader carries its word in the
// attention ink and every other Session carries it for a screen reader alone: the dot already
// says the state, and a word on every row is a column nobody reads. These eight words are the
// domain's, not the interface's, so there is no locale string for them (CONTEXT.md L2 · Session
// status).
export function SessionStatus({ status }: { status: SessionStatusValue }) {
  const attention = INK[status] === 'attention'
  return (
    <span
      className={`roster__status flex-none text-badge font-semibold uppercase tracking-[0.6px] text-warn ${attention ? '' : 'sr-only'}`}
      data-status={status}
    >
      {status}
    </span>
  )
}
