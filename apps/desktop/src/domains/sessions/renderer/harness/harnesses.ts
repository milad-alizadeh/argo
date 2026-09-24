import { harnessSchema } from '@/harnesses/harness'

export const SESSION_HARNESSES = harnessSchema.options
export type SessionHarness = (typeof SESSION_HARNESSES)[number]

// What each harness is called.
export const HARNESSES: Record<SessionHarness, { label: string }> = {
  claude: { label: 'Claude Code' },
  codex: { label: 'Codex' },
}

// Only a Session not yet started can change the harness it runs on.
export type HarnessControl = {
  harness: SessionHarness
  onChange?: (harness: SessionHarness) => void
}

// The Roster stores an open `harness` string (ADR-0021: an adapter registers, shared code doesn't
// enumerate); this is the one seam that narrows it back to the closed `SessionHarness` union.
export function sessionHarnessOf(session: { harness: string } | null): SessionHarness {
  return session?.harness === 'codex' ? 'codex' : 'claude'
}
