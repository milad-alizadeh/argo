import type { StopReason, ToolCallStatus } from '@shared'
import type { SubagentRowModel } from './interiorSubagents'

// The Activity surface's state words. One word per state, spelled identically wherever the state
// appears (`cockpit-status-vocabulary.md`, the one rule): a subagent that is working and a tool call
// that is working both read `running`, so no reader has to learn that two words mean one state.

/** What a tool call's state is called. `in_progress` is an enum name, not a word a surface shows —
 * every one of these is the word, so nothing downstream reformats an identifier for display. */
export function stepWord(status: ToolCallStatus): string {
  switch (status) {
    case 'pending':
      return 'queued'
    case 'in_progress':
      return 'running'
    case 'completed':
      return 'done'
    case 'failed':
      return 'failed'
  }
}

/** What a subagent's state is called — the same three words its rows derive, unchanged. */
export const subagentWord = (status: SubagentRowModel['status']): string => status

/** What a turn's state is called: `running` while nothing stopped it, else the CLI's own stop
 * reason verbatim — `unknown` included, because a guessed reason is a fabricated fact. */
export const turnWord = (stopReason: StopReason | null): string =>
  stopReason === null ? 'running' : stopReason
