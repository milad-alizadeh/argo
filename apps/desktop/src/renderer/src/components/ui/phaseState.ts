import type { AgentState } from './agentState'
import { CheckIcon, CircleHalfIcon, CircleIcon, type IconAtom } from './icons'

export const PHASE_STATES = ['done', 'run', 'wait'] as const

/** Where a Phase stands. A Phase is a grouping inside a Run, not an Actor, so it has its
 * own three-value state rather than reusing an Agent's. */
export type PhaseState = (typeof PHASE_STATES)[number]

type PhasePresentation = {
  /** The lowercase word the phase reports itself with — the same voice as an AgentRow's. */
  word: string
  /** The left rail's colour class. The rail IS the state indicator (timeline-spine idiom). */
  rail: string
  /** The status word's colour class, always the rail's own hue. */
  ink: string
  /** The glyph the collapsed run summary walks this phase with. */
  glyph: IconAtom
}

// One hue per state across the rail and the word; `wait` deliberately carries no hue at
// all — faint IS its value. Classes are written out per state rather than interpolated so
// Tailwind's scanner still sees each one literally.
export const PHASE_PRESENTATION: Record<PhaseState, PhasePresentation> = {
  done: { word: 'done', rail: 'border-tone-done/55', ink: 'text-tone-done', glyph: CheckIcon },
  run: { word: 'running', rail: 'border-tone-run', ink: 'text-tone-run', glyph: CircleHalfIcon },
  wait: { word: 'queued', rail: 'border-border', ink: 'text-foreground-faint', glyph: CircleIcon },
}

/** The phase IS its members' rollup, so a member suppresses a state word matching this. */
export const PHASE_ROLLUP_STATE: Record<PhaseState, AgentState> = {
  done: 'done',
  run: 'running',
  wait: 'queued',
}

/** Done phases collapse to their header and future phases are header-only, so only the
 * phase actually being worked opens itself. */
export function phaseOpensByDefault(state: PhaseState): boolean {
  return state === 'run'
}

/** The `pstat` that sits inline after the phase name. A phase with no members has no
 * fraction to report, so it stands on its word alone. */
export function phaseStatusText(state: PhaseState, memberCount: number, doneCount: number): string {
  const { word } = PHASE_PRESENTATION[state]
  if (memberCount === 0) return word
  return `${word} ${doneCount}/${memberCount}`
}
