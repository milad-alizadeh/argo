import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import { CODEX_TURN_SETUP } from '../turn-setup/codex-turn-setup'
import type { TurnSetupChoices } from '../turn-setup/turn-setup'

export const SESSION_CLIS = ['claude', 'codex'] as const
export type SessionCli = (typeof SESSION_CLIS)[number]

// What each harness is called, and what it lets a person set for its next Turn.
export const HARNESSES: Record<SessionCli, { label: string; setup: TurnSetupChoices | null }> = {
  claude: { label: CLAUDE_TURN_SETUP.label, setup: CLAUDE_TURN_SETUP },
  codex: { label: CODEX_TURN_SETUP.label, setup: CODEX_TURN_SETUP },
}

// Only a Session not yet started can change the harness it runs on.
export type HarnessControl = { cli: SessionCli; onChange?: (cli: SessionCli) => void }
