import { type DelegationReading, readDelegation } from '../../../../core/sessions/delegation'
import type { Session } from '../types'

import { SessionStateDot } from './SessionStatus'

// Five is where a stack of dots stops being countable. Past it the column says how many it is not
// drawing, and the figure is exact where a longer stack would be texture.
const CEILING = 5

const PIP = 'size-(--size-subagent-dot) flex-none'

// One dot per Subagent running under the Session, read the way the Agents rail reads it
// (`readDelegation`), so the two never disagree (#1269).
function SubagentDots({ reading }: { reading: DelegationReading }) {
  // A Session whose own state Argo cannot place cannot be claimed to be delegating either, and an
  // outline under the state's outline reads as a second dot.
  if (!reading.known) return null
  const running = reading.running.length
  if (running > 0) {
    return (
      <>
        {reading.running.slice(0, CEILING).map((delegation) => (
          <span className={`${PIP} rounded-[1px] bg-active`} key={delegation.id} />
        ))}
        {/* Out of the flow and centred on the column, so the figure costs the title not one
            point of its width: the count is the rarest thing on the row and the title the widest. */}
        {running > CEILING ? (
          <span className="absolute top-full left-1/2 mt-hair -translate-x-1/2 font-mono text-[9px] whitespace-nowrap text-faint">
            +{running - CEILING}
          </span>
        ) : null}
      </>
    )
  }
  // An open delegation Argo cannot resolve (#1076): an outline, and never a number.
  if (reading.unresolved > 0) {
    return <span className={`${PIP} rounded-full shadow-[inset_0_0_0_1px_var(--color-off)]`} />
  }
  // Delegated, and every one is home. A dash, because an outline is already spoken for by the
  // unknown state. Delegated nothing draws nothing.
  if (reading.finished > 0) return <span className="h-px w-[5px] flex-none bg-off" />
  return null
}

// The leading column: the Session's state, and under it what runs beneath the Session. It is
// the machinery's column, and nothing else on the row claims it.
export function SessionMarker({ session }: { session: Session }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex w-(--size-state-dot) flex-none flex-col items-center gap-[3px] pt-dot-inset"
    >
      <SessionStateDot status={session.status} />
      <SubagentDots reading={readDelegation(session.status, session.delegations)} />
    </span>
  )
}
