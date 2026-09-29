import { createContext } from 'react'
import type { SessionWork } from '../../work/session-work'

export type BackgroundWorkLinks = {
  // By the id a row names: a Shell's call, or the Subagent main reported.
  find: (id: string) => SessionWork | null
  open: (target: SessionWork) => void
}

// Set by the Session screen, so a Subagent row can open its own feed. A row with no link, or
// outside a Session, still draws the same height with no chevron.
export const BackgroundWork = createContext<BackgroundWorkLinks | null>(null)
