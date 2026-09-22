import { useState } from 'react'
import type { SessionShellCommand, SessionShellOutput } from '@/domains/sessions/contract/model'
import type { BackgroundWorkLinks } from '../feed'
import type { SessionScreenModel } from './use-session-screen-model'

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

// A second, parallel way to produce the same selection: a Feed inline click on a Subagent or
// Shell call, resolved against whatever the Session actually ran.
export function backgroundWorkLinks(model: SessionScreenModel): BackgroundWorkLinks {
  const { pick, selectedSessionId, session } = model
  return {
    find: ({ callId, name }) => {
      const command = session?.shell.find((entry) => entry.id === callId)
      if (command !== undefined) return { kind: 'shell', command }
      // A realtime delegation's envelope names no call, only the name the agent was sent with.
      const delegation =
        session?.subagents.find((entry) => entry.id === callId) ??
        session?.subagents.findLast((entry) => name !== null && entry.label === name)
      if (delegation === undefined) return null
      const usage = model.subagentUsage[delegation.id] ?? { tokens: null, model: null }
      return { kind: 'delegation', delegation, usage }
    },
    open: (target) =>
      pick(
        target.kind === 'shell'
          ? { sessionId: selectedSessionId, subagentId: null, shellId: target.command.id }
          : { sessionId: selectedSessionId, subagentId: target.delegation.id, shellId: null },
      ),
  }
}
