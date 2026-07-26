import type { OrbState } from './types'

/** The live level driving the orb's glow: the mic while listening, the TTS signal while
 * speaking, and a steady zero otherwise — thinking must read as composure, not flicker.
 * No `default` branch on purpose: a new `OrbState` fails to compile here until it decides. */
export function soundLevelFor(
  state: OrbState,
  levels: { micLevel: number; audioLevel: number },
): number {
  switch (state) {
    case 'listening':
      return levels.micLevel
    case 'speaking':
      return levels.audioLevel
    case 'idle':
    case 'thinking':
    case 'error':
      return 0
  }
}
