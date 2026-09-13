import { CLAUDE_MODES, type ClaudeTurnSetup } from '@/core/sessions/contract'

type ClaudeMode = ClaudeTurnSetup['mode']

export const CYCLE_MODE = '\u001b[Z'
export const REDRAW = '\u000c'

// The footer each Mode draws in Claude Code 2.1.270; Shift+Tab cycles them.
const MODE_FOOTERS = {
  manual: 'manual mode on',
  acceptEdits: 'accept edits on',
  plan: 'plan mode on',
  auto: 'auto mode on',
  dontAsk: "don't ask on",
  bypassPermissions: 'bypass permissions on',
} satisfies Record<ClaudeMode, string>

const ESCAPE = '\u001b'
const BELL = '\u0007'
// A CSI, an OSC ended by BEL, or a two-byte escape: bytes that move the cursor, not text.
const TERMINAL_SEQUENCE = new RegExp(
  `${ESCAPE}(?:\\[[0-9;?]*[ -/]*[@-~]|\\][^${BELL}]*${BELL}|.)`,
  'g',
)

export function launchArguments(setup: ClaudeTurnSetup): string[] {
  return ['--model', setup.model, '--effort', setup.effort, '--permission-mode', setup.mode]
}

export function setupCommands(applied: ClaudeTurnSetup, requested: ClaudeTurnSetup): string[] {
  const modelChanged = applied.model !== requested.model
  return [
    ...(modelChanged ? [`/model ${requested.model}`] : []),
    // `/model` restores the new model's saved effort, so Effort follows every model change.
    ...(modelChanged || applied.effort !== requested.effort ? [`/effort ${requested.effort}`] : []),
  ]
}

export function footerMode(screen: string): ClaudeMode | null {
  const text = screen.replace(TERMINAL_SEQUENCE, ' ').replace(/\s+/g, ' ')
  const shown = CLAUDE_MODES.map((mode) => ({ mode, index: text.lastIndexOf(MODE_FOOTERS[mode]) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => right.index - left.index)
  return shown[0]?.mode ?? null
}
