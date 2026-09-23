import { CLAUDE_TURN_SETUP } from '../composer/turn-setup/claude-turn-setup'
import type { TurnSetupChoices } from '../composer/turn-setup/turn-setup'

export const SESSION_HARNESSES = ['claude', 'codex'] as const
export type SessionHarness = (typeof SESSION_HARNESSES)[number]

// What each harness is called, and what it lets a person set for its next Turn.
export const HARNESSES: Record<SessionHarness, { label: string; setup: TurnSetupChoices | null }> =
  {
    claude: { label: CLAUDE_TURN_SETUP.label, setup: CLAUDE_TURN_SETUP },
    codex: { label: 'Codex', setup: null },
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
