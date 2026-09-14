import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import type { TurnSetupChoices } from '../turn-setup/turn-setup'

export const SESSION_CLIS = ['claude', 'codex'] as const
export type SessionCli = (typeof SESSION_CLIS)[number]

// What each harness is called, and what it lets a person set for its next Turn; Codex declares
// nothing yet (#1885), so it draws no Model, Effort or Mode.
export const HARNESSES: Record<SessionCli, { label: string; setup: TurnSetupChoices | null }> = {
  claude: { label: CLAUDE_TURN_SETUP.label, setup: CLAUDE_TURN_SETUP },
  codex: { label: 'Codex', setup: null },
}

// Only a Session not yet started can change the harness it runs on.
export type HarnessControl = { cli: SessionCli; onChange?: (cli: SessionCli) => void }

// The Roster stores an open `cli` string (ADR-0021: an adapter registers, shared code doesn't
// enumerate); this is the one seam that narrows it back to the closed `SessionCli` union.
export function sessionCliOf(session: { cli: string } | null): SessionCli {
  return session?.cli === 'codex' ? 'codex' : 'claude'
}
