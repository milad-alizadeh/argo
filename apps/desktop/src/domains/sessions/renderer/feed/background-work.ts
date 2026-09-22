import { createContext } from 'react'
import type { SessionWork } from '@/domains/sessions/renderer/work/session-work'

export type BackgroundWorkLinks = {
  // By the call a notification names, or else by the name an agent was given when it was sent.
  find: (work: { callId: string | null; name: string | null }) => SessionWork | null
  open: (target: SessionWork) => void
}

// Set by the Session screen, so a Subagent row can open its own feed. A row with no link, or
// outside a Session, still draws the same height with no chevron.
export const BackgroundWork = createContext<BackgroundWorkLinks | null>(null)
