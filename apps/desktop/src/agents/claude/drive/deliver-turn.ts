import { CYCLE_MODE, footerMode, REDRAW, setupCommands } from '@/agents/claude/drive/claude-setup'
import { claudeTurn } from '@/agents/claude/drive/claude-turn'
import { CLAUDE_MODES, type ClaudeTurnSetup } from '@/domains/sessions/contract/contract'

export type Wait = (milliseconds: number) => Promise<void>
export type ClaudeTurnRequest = { prompt: string; setup: ClaudeTurnSetup }

// The part of a managed Session a Turn is typed into; `screen` holds what the TUI drew last.
export type TurnTarget = {
  applied: ClaudeTurnSetup
  process: { write: (text: string) => void }
  screen: string
}

const SUBMIT_DELAY_MS = 150
// Measured against Claude Code 2.1.270: a slash command needs its menu to settle before and after Return.
const COMMAND_SUBMIT_DELAY_MS = 300
const COMMAND_SETTLE_MS = 1500
const MODE_PRESS_DELAY_MS = 400
const MODE_REDRAW_DELAY_MS = 800

export async function deliverTurn(session: TurnTarget, turn: ClaudeTurnRequest, wait: Wait) {
  for (const command of setupCommands(session.applied, turn.setup)) {
    session.process.write(command)
    await wait(COMMAND_SUBMIT_DELAY_MS)
    session.process.write('\r')
    await wait(COMMAND_SETTLE_MS)
  }
  session.applied = { ...session.applied, model: turn.setup.model, effort: turn.setup.effort }
  if (session.applied.mode !== turn.setup.mode) {
    session.applied = { ...session.applied, mode: await cycleMode(session, turn.setup.mode, wait) }
  }
  const paste = claudeTurn(turn.prompt)
  session.process.write(paste.paste)
  await wait(SUBMIT_DELAY_MS)
  session.process.write(paste.submit)
}

// Stops on the chosen Mode, or back where it began when Claude does not offer it.
async function cycleMode(session: TurnTarget, target: ClaudeTurnSetup['mode'], wait: Wait) {
  const starting = session.applied.mode
  for (const _press of CLAUDE_MODES) {
    session.process.write(CYCLE_MODE)
    await wait(MODE_PRESS_DELAY_MS)
    session.screen = ''
    session.process.write(REDRAW)
    await wait(MODE_REDRAW_DELAY_MS)
    const shown = footerMode(session.screen)
    if (shown === target || shown === starting) return shown
  }
  return starting
}
