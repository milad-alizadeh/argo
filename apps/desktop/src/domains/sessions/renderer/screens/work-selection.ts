import { useState } from 'react'
import type { SessionShellCommand } from '@/domains/sessions/contract/model/models'
import type { SessionShellOutput } from '@/domains/sessions/contract/model/wire/background-work-contract'

// What the reader picked out of the header's work buttons, held against the Session it was picked
// in: a selection made in one Session says nothing about the next, and keying it this way retires
// it without an effect that fires a frame late (#1582).
export type WorkSelection = {
  sessionId: string | null
  subagentId: string | null
  shellId: string | null
}

const NOTHING_PICKED: WorkSelection = { sessionId: null, subagentId: null, shellId: null }

function pickedIn(selection: WorkSelection, sessionId: string | null): WorkSelection {
  return selection.sessionId === sessionId ? selection : { ...NOTHING_PICKED, sessionId }
}

// Each pick counts, so picking the same row again reopens an inspector the reader collapsed.
export function useWorkPick(sessionId: string | null, onPick: () => void) {
  const [picked, setPicked] = useState({ selection: NOTHING_PICKED, count: 0 })
  const work = pickedIn(picked.selection, sessionId)
  const pickedId = work.subagentId ?? work.shellId
  return {
    work,
    pick: (selection: WorkSelection) => {
      onPick()
      setPicked(({ count }) => ({ selection, count: count + 1 }))
    },
    workReveal: pickedId === null ? null : `${pickedId}#${picked.count}`,
  }
}

// A Shell selection is meaningful only once its adapter supplied a terminal to reveal (#2530).
export function workInspectorReveal(
  reveal: string | null,
  shell: SessionShellCommand | null,
  shellOutput: SessionShellOutput | null,
) {
  if (shell === null) return reveal
  return shellOutput?.state === 'available' ? reveal : null
}
