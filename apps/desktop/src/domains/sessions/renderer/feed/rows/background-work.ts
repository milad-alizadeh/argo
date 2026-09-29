import { createContext } from 'react'

export type BackgroundWorkLinks = {
  // By the id a row names: a Shell's call, or a Subagent, known to the Session or not.
  open: (id: string) => void
}

// Set by the Session screen, so every Subagent row opens its own feed. A row outside a Session
// draws the same title as plain text.
export const BackgroundWork = createContext<BackgroundWorkLinks | null>(null)
